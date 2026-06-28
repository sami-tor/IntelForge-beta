import { query } from "@/lib/db"
import { buildWebhookPayload, type WebhookEvent } from "./event-types"

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, any>,
  orgId?: number
): Promise<void> {
  try {
    const payload = buildWebhookPayload(event, data)

    let webhooksResult
    if (orgId) {
      webhooksResult = await query(
        `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events) AND (organization_id = $2 OR organization_id IS NULL)`,
        [event, orgId]
      )
    } else {
      webhooksResult = await query(
        `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events)`,
        [event]
      )
    }

    const webhooks = webhooksResult.data || []
    if (!webhooks.length) return

    const payloadWithId = { ...payload }

    for (const webhook of webhooks) {
      const start = Date.now()
      payloadWithId.webhook_id = webhook.id

      try {
        const signature = webhook.secret
          ? await createHmacSignature(JSON.stringify(payloadWithId), webhook.secret)
          : undefined

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-IntelForge-Event": event,
          "X-Webhook-ID": String(webhook.id),
        }
        if (signature) headers["X-IntelForge-Signature"] = signature

        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payloadWithId),
          signal: AbortSignal.timeout(10000),
        })

        const responseBody = await response.text().catch(() => "")
        const duration = Date.now() - start

        await query(
          `INSERT INTO webhook_logs (webhook_id, event, request_body, response_code, response_body, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [webhook.id, event, JSON.stringify(payloadWithId), response.status, responseBody || null, duration]
        )

        if (response.ok) {
          await query(
            `UPDATE webhooks SET last_triggered = NOW(), failure_count = 0 WHERE id = $1`,
            [webhook.id]
          )
        } else {
          await query(
            `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
            [webhook.id]
          )
        }
      } catch (error: any) {
        const duration = Date.now() - start
        await query(
          `INSERT INTO webhook_logs (webhook_id, event, request_body, error, duration_ms)
           VALUES ($1, $2, $3, $4, $5)`,
          [webhook.id, event, JSON.stringify(payloadWithId), error.message || "Unknown error", duration]
        )
        await query(
          `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
          [webhook.id]
        )
      }
    }
  } catch (error) {
    console.error("[WebhookDispatcher] Error dispatching event:", error)
  }
}

async function createHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("")
}
