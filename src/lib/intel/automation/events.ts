// ================================================
// IntelForge Automation - Postgres pub/sub bridge
// ------------------------------------------------
// We use Postgres LISTEN/NOTIFY as a tiny event
// bus so the SSE endpoint can push immediately
// when the orchestrator finishes a stage, without
// polling.
// ================================================
import { Pool, PoolClient } from "pg"
import { query } from "@/lib/db"

export const CHANNEL = "intel_automation"

export type AutomationEventType =
  | "score.updated"
  | "cluster.upserted"
  | "anomaly.detected"
  | "action.created"
  | "briefing.published"
  | "pipeline.complete"

export interface AutomationEvent {
  type: AutomationEventType
  timestamp: string
  payload: Record<string, unknown>
}

/**
 * Emit an event over Postgres NOTIFY. Best-effort —
 * a failure here must never break the pipeline.
 */
export async function emitAutomationEvent(
  type: AutomationEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const event: AutomationEvent = {
      type,
      timestamp: new Date().toISOString(),
      payload,
    }
    // pg_notify(channel, text) - the payload is JSON-encoded then
    // size-truncated to ~7800 bytes (pg's limit is 8000).
    let body = JSON.stringify(event)
    if (body.length > 7800) {
      body = JSON.stringify({
        type,
        timestamp: event.timestamp,
        payload: { truncated: true },
      })
    }
    await query(`SELECT pg_notify($1, $2)`, [CHANNEL, body])
  } catch {
    // intentional: never throw from notify path
  }
}


// ================================================
// Listener side - dedicated long-lived connection.
// Each SSE client subscribes via subscribe(); we
// keep one Postgres LISTEN per process.
// ================================================
type Subscriber = (event: AutomationEvent) => void

let listenerPool: Pool | null = null
let listenerClient: PoolClient | null = null
const subscribers = new Set<Subscriber>()
let initInFlight: Promise<void> | null = null

async function initListener(): Promise<void> {
  if (listenerClient) return
  if (initInFlight) return initInFlight
  initInFlight = (async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not set")
    }
    listenerPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 0,
    })
    const client = await listenerPool.connect()
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return
      try {
        const event = JSON.parse(msg.payload) as AutomationEvent
        for (const sub of subscribers) {
          try {
            sub(event)
          } catch {
            // protect the listener from buggy subscribers
          }
        }
      } catch {
        // malformed payload, drop
      }
    })
    client.on("error", (err) => {
      console.error("[automation-events] listener error:", err)
    })
    await client.query(`LISTEN ${CHANNEL}`)
    listenerClient = client
  })()
  try {
    await initInFlight
  } finally {
    initInFlight = null
  }
}

/**
 * Register a subscriber callback. Returns an unsubscribe function.
 * Lazy-inits the LISTEN client on first call so the listener pool
 * is only created when something actually subscribes.
 */
export async function subscribe(
  fn: Subscriber,
): Promise<() => void> {
  await initListener()
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

/** For shutdown handlers / tests. */
export async function shutdownListener(): Promise<void> {
  subscribers.clear()
  try {
    if (listenerClient) {
      await listenerClient.query(`UNLISTEN ${CHANNEL}`).catch(() => {})
      listenerClient.release()
      listenerClient = null
    }
    if (listenerPool) {
      await listenerPool.end().catch(() => {})
      listenerPool = null
    }
  } catch {
    // ignore
  }
}
