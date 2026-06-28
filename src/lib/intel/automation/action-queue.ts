// ================================================
// IntelForge Automation - Action Queue
// ------------------------------------------------
// Reads correlation clusters and anomalies, then
// emits prioritised, deduped actions for analysts.
// Deduped via action_key UNIQUE constraint.
// ================================================
import crypto from "crypto"
import { query } from "@/lib/db"
import { getTopClusters } from "./correlator"
import { listAnomalies } from "./forecast"
import { emitAutomationEvent } from "./events"
import type { FindingSeverity } from "@/lib/intel/risk-scoring"

export interface ActionItem {
  id?: number
  actionKey: string
  title: string
  description: string
  category: "patch" | "hunt" | "block" | "review" | "drill"
  priority: number
  severity: FindingSeverity
  sourceType: "cluster" | "anomaly" | "trend" | "briefing"
  sourceRef: string | null
  suggestedSteps: string[]
  metadata: Record<string, unknown>
  status?: "open" | "in_progress" | "done" | "dismissed"
  createdAt?: string
}

function key(parts: unknown[]) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32)
}

function severityToPriority(severity: string, base: number): number {
  const tier: Record<string, number> = {
    critical: 95,
    high: 80,
    medium: 60,
    low: 40,
    info: 25,
  }
  return Math.min(100, Math.max(0, tier[severity] ?? base))
}

async function upsertAction(item: ActionItem) {
  await query(
    `INSERT INTO intel_action_queue
        (action_key, title, description, category, priority, severity,
         source_type, source_ref, suggested_steps, metadata, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, 'open', NOW())
     ON CONFLICT (action_key) DO UPDATE SET
        title           = EXCLUDED.title,
        description     = EXCLUDED.description,
        priority        = GREATEST(intel_action_queue.priority, EXCLUDED.priority),
        severity        = EXCLUDED.severity,
        suggested_steps = EXCLUDED.suggested_steps,
        metadata        = intel_action_queue.metadata || EXCLUDED.metadata,
        updated_at      = NOW()`,
    [
      item.actionKey,
      item.title,
      item.description,
      item.category,
      item.priority,
      item.severity,
      item.sourceType,
      item.sourceRef,
      JSON.stringify(item.suggestedSteps),
      JSON.stringify(item.metadata),
    ],
  )
}

/**
 * Build action items from the current top clusters and anomalies.
 * Returns the count of (re-)written actions.
 */
export async function generateActions(): Promise<{ created: number; total: number }> {
  const clusters = await getTopClusters(20)
  const anomalies = await listAnomalies(15)
  let created = 0

  // ---- From correlation clusters ----
  for (const cluster of clusters) {
    if (cluster.riskScore < 50) continue
    const cveId = cluster.signals?.cve?.cveId
    const hasExploit = cluster.tags.includes("exploit-available")
    const isKev = cluster.tags.includes("kev")

    let title = `Triage ${cluster.title}`
    let category: ActionItem["category"] = "review"
    let steps: string[] = []

    if (cveId && (hasExploit || isKev)) {
      title = `Patch ${cveId} now — exploit ${hasExploit ? "available" : "expected"}${isKev ? " · KEV listed" : ""}`
      category = "patch"
      steps = [
        `Confirm asset exposure to ${cveId} via vulnerability scanner.`,
        "Apply vendor patch or compensating control on internet-facing systems first.",
        "Search SIEM for indicators tied to known exploits of this CVE.",
        "Tag the rollout in your change calendar and alert the on-call.",
      ]
    } else if (cveId) {
      title = `Investigate ${cveId} — multiple intel sources active`
      category = "review"
      steps = [
        `Pull NVD record for ${cveId} and confirm affected products in your inventory.`,
        "Cross-reference with internal vulnerability scan results.",
        "Decide: patch, mitigate or accept based on exposure and exploit maturity.",
      ]
    } else {
      steps = ["Open the cluster details and review supporting signals."]
    }

    const priority = Math.min(100, cluster.riskScore + (hasExploit ? 5 : 0) + (isKev ? 5 : 0))
    const actionKey = key(["cluster", cluster.clusterKey])

    await upsertAction({
      actionKey,
      title,
      description:
        cluster.summary ||
        `Auto-correlated cluster with ${cluster.signalCount} signals across feeds.`,
      category,
      priority,
      severity: cluster.severity,
      sourceType: "cluster",
      sourceRef: cluster.clusterKey,
      suggestedSteps: steps,
      metadata: {
        clusterKey: cluster.clusterKey,
        cveId,
        signalCount: cluster.signalCount,
        tags: cluster.tags,
      },
    })
    created++
  }

  // ---- From anomalies ----
  for (const anomaly of anomalies) {
    if (anomaly.severity === "info" || anomaly.severity === "low") continue
    const direction = anomaly.direction === "spike" ? "Spike" : "Drop"
    const title = `${direction} in ${anomaly.metricLabel || anomaly.metricKey}`
    const description = anomaly.explanation
    const steps =
      anomaly.direction === "spike"
        ? [
            "Identify which feed is responsible for the spike — check the most recent run log.",
            "Confirm the data is genuine (not a parsing duplicate or feed-level outage backfill).",
            "If genuine, escalate to the relevant analyst track (CVE / ransomware / phishing).",
          ]
        : [
            "Suspect feed outage or upstream rate-limit — check feed health page.",
            "Run the relevant scraper manually and verify ingestion.",
            "Confirm scoring isn't masking a real-world drop.",
          ]

    const actionKey = key(["anomaly", anomaly.metricKey, anomaly.bucketDate])

    await upsertAction({
      actionKey,
      title,
      description,
      category: anomaly.direction === "spike" ? "hunt" : "review",
      priority: severityToPriority(anomaly.severity, 60),
      severity: anomaly.severity,
      sourceType: "anomaly",
      sourceRef: anomaly.metricKey,
      suggestedSteps: steps,
      metadata: {
        metricKey: anomaly.metricKey,
        bucketDate: anomaly.bucketDate,
        zScore: anomaly.zScore,
        value: anomaly.value,
        expected: anomaly.expectedValue,
      },
    })
    created++
  }

  // Auto-close items whose source no longer appears
  const totalRow = await query(
    `SELECT COUNT(*)::int as c FROM intel_action_queue WHERE status = 'open'`,
    [],
  )
  const total = Number((totalRow.data?.[0] as Record<string, unknown> | undefined)?.c ?? 0)

  if (created > 0) {
    await emitAutomationEvent("action.created", { count: created })
  }

  return { created, total }
}

/**
 * List open or in-progress actions ordered by priority for the UI.
 */
export async function listActions(
  status: "open" | "in_progress" | "done" | "all" = "open",
  limit = 30,
): Promise<ActionItem[]> {
  const where = status === "all" ? "" : "WHERE status = $1"
  const params = status === "all" ? [limit] : [status, limit]
  const limitIdx = status === "all" ? "$1" : "$2"

  const r = await query(
    `SELECT id, action_key, title, description, category, priority, severity,
            source_type, source_ref, suggested_steps, metadata, status, created_at
     FROM intel_action_queue
     ${where}
     ORDER BY priority DESC, created_at DESC
     LIMIT ${limitIdx}`,
    params,
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    actionKey: String(row.action_key),
    title: String(row.title),
    description: String(row.description || ""),
    category: row.category as ActionItem["category"],
    priority: Number(row.priority),
    severity: row.severity as FindingSeverity,
    sourceType: row.source_type as ActionItem["sourceType"],
    sourceRef: row.source_ref as string | null,
    suggestedSteps: (row.suggested_steps as string[]) || [],
    metadata: (row.metadata as Record<string, unknown>) || {},
    status: row.status as ActionItem["status"],
    createdAt: (row.created_at as Date).toISOString(),
  }))
}

export async function updateActionStatus(
  id: number,
  status: ActionItem["status"],
  userId?: number,
  userName?: string,
) {
  // Read current status for audit
  const prev = await query(
    `SELECT status FROM intel_action_queue WHERE id = $1`,
    [id],
  )
  const prevStatus = prev.success
    ? ((prev.data?.[0] as Record<string, unknown> | undefined)?.status as string) || null
    : null

  const isDone = status === "done" || status === "dismissed"
  await query(
    `UPDATE intel_action_queue
     SET status = $1,
         done_at = ${isDone ? "NOW()" : "NULL"},
         done_by = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [status, userId ?? null, id],
  )

  // Best-effort audit trail
  try {
    await query(
      `INSERT INTO intel_action_audit
         (action_id, actor_id, actor_name, event, from_value, to_value)
       VALUES ($1, $2, $3, 'status_change', $4, $5)`,
      [id, userId ?? null, userName ?? null, prevStatus, status],
    )
  } catch {
    // audit is best-effort
  }
}
