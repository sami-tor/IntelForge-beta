export const WEBHOOK_EVENTS = [
  "search.completed",
  "search.face.completed",
  "alert.created",
  "alert.resolved",
  "case.created",
  "case.updated",
  "case.closed",
  "monitoring.hit",
  "monitoring.resolved",
  "identity.created",
  "identity.merged",
  "watchlist.hit",
  "integration.connected",
  "integration.disconnected",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, any>
  webhook_id?: number
}

export function buildWebhookPayload(event: WebhookEvent, data: Record<string, any>): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  }
}
