// ================================================
// GET /api/intel/automation/stream
// Server-Sent Events. Subscribes to the Postgres
// LISTEN/NOTIFY channel for true push, falls back
// to a 30-second heartbeat so proxies don't drop.
// ================================================
import { NextRequest } from "next/server"
import { getLatestThreatScore } from "@/lib/intel/automation/threat-score"
import { subscribe, type AutomationEvent } from "@/lib/intel/automation/events"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  let cancelled = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (cancelled) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          // controller closed
        }
      }
      const sendComment = (text: string) => {
        if (cancelled) return
        try {
          controller.enqueue(encoder.encode(`: ${text}\n\n`))
        } catch {
          // ignore
        }
      }

      // Initial snapshot
      const initial = await getLatestThreatScore()
      send("score", { snapshot: initial, timestamp: new Date().toISOString() })

      // Subscribe to Postgres NOTIFY events
      let unsubscribe: (() => void) | null = null
      try {
        unsubscribe = await subscribe((event: AutomationEvent) => {
          send(event.type, event)
        })
      } catch (err) {
        // Pub/sub init failed — keep the heartbeat-only fallback
        send("error", {
          message: err instanceof Error ? err.message : "subscribe failed",
        })
      }

      // Heartbeat every 30s so the connection stays alive across proxies
      const heartbeat = setInterval(() => {
        if (cancelled) return
        sendComment(`hb ${new Date().toISOString()}`)
      }, 30_000)

      request.signal.addEventListener("abort", () => {
        cancelled = true
        clearInterval(heartbeat)
        if (unsubscribe) {
          try {
            unsubscribe()
          } catch {
            // ignore
          }
        }
        try {
          controller.close()
        } catch {
          // ignore
        }
      })
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
