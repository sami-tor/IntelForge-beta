// ================================================
// IntelForge Automation - Notifications
// ------------------------------------------------
// Fires webhooks when high-impact events emerge:
//   • critical/high briefing
//   • new high-severity anomaly
//   • cluster rises above threshold
// Logs every dispatch attempt to intel_notification_log.
// ================================================
import { query } from "@/lib/db"
import { dispatchWebhookEvent } from "@/lib/integrations/webhook-dispatcher"
import type { GeneratedBriefing } from "./briefing-generator"
import type { CorrelatedCluster } from "./correlator"
import type { AnomalyPoint } from "./forecast"

const HIGH_TIERS = new Set(["critical", "high"])

async function logNotification(
  event: string,
  channel: string,
  target: string | null,
  payload: Record<string, unknown>,
  status: "sent" | "failed" = "sent",
  error?: string,
) {
  try {
    await query(
      `INSERT INTO intel_notification_log (event, channel, target, payload, status, error)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [event, channel, target, JSON.stringify(payload), status, error ?? null],
    )
  } catch {
    // notification log is best-effort
  }
}

/**
 * If the briefing is high or critical, fire the webhook.
 * Reuses the existing 'alert.created' channel because that's
 * what existing webhook subscribers already understand.
 */
export async function notifyBriefing(briefing: GeneratedBriefing) {
  if (!HIGH_TIERS.has(briefing.threatLevel)) return

  const payload: Record<string, unknown> = {
    type: "intel.briefing",
    briefingType: briefing.briefingType,
    threatLevel: briefing.threatLevel,
    threatScore: briefing.threatScore,
    headline: briefing.headline,
    summary: briefing.summary,
    highlights: briefing.highlights.slice(0, 5),
    recommendations: briefing.recommendations.slice(0, 4),
    periodEnd: briefing.periodEnd,
  }

  try {
    await dispatchWebhookEvent("alert.created", payload)
    await logNotification("intel.briefing", "webhook", null, payload)
  } catch (err) {
    await logNotification(
      "intel.briefing",
      "webhook",
      null,
      payload,
      "failed",
      err instanceof Error ? err.message : String(err),
    )
  }
}

export async function notifyAnomalies(anomalies: AnomalyPoint[]) {
  for (const a of anomalies) {
    if (!HIGH_TIERS.has(a.severity)) continue
    const payload: Record<string, unknown> = {
      type: "intel.anomaly",
      metricKey: a.metricKey,
      metricLabel: a.metricLabel,
      value: a.value,
      expectedValue: a.expectedValue,
      zScore: a.zScore,
      direction: a.direction,
      severity: a.severity,
      explanation: a.explanation,
      bucketDate: a.bucketDate,
    }
    try {
      await dispatchWebhookEvent("alert.created", payload)
      await logNotification("intel.anomaly", "webhook", a.metricKey, payload)
    } catch (err) {
      await logNotification(
        "intel.anomaly",
        "webhook",
        a.metricKey,
        payload,
        "failed",
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

export async function notifyCriticalClusters(clusters: CorrelatedCluster[]) {
  for (const c of clusters) {
    if (!HIGH_TIERS.has(c.severity) || c.riskScore < 80) continue
    const payload: Record<string, unknown> = {
      type: "intel.cluster",
      clusterKey: c.clusterKey,
      title: c.title,
      summary: c.summary,
      severity: c.severity,
      riskScore: c.riskScore,
      tags: c.tags,
    }
    try {
      await dispatchWebhookEvent("alert.created", payload)
      await logNotification("intel.cluster", "webhook", c.clusterKey, payload)
    } catch (err) {
      await logNotification(
        "intel.cluster",
        "webhook",
        c.clusterKey,
        payload,
        "failed",
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

export interface NotificationLogEntry {
  id: number
  event: string
  channel: string
  target: string | null
  status: string
  error: string | null
  sentAt: string
}

export async function listNotifications(limit = 30): Promise<NotificationLogEntry[]> {
  const r = await query(
    `SELECT id, event, channel, target, status, error, sent_at
     FROM intel_notification_log
     ORDER BY sent_at DESC LIMIT $1`,
    [limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    event: String(row.event),
    channel: String(row.channel),
    target: (row.target as string) || null,
    status: String(row.status),
    error: (row.error as string) || null,
    sentAt: (row.sent_at as Date).toISOString(),
  }))
}
