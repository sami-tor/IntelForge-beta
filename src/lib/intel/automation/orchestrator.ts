// ================================================
// IntelForge Automation - Orchestrator
// ------------------------------------------------
// Runs every step end-to-end and records the run.
// Used by the cron at /api/cron/automation and by
// admins via "Run Now" in the Command Center.
// ================================================
import { query } from "@/lib/db"
import { computeAndPersistThreatScore } from "./threat-score"
import { runCorrelationPass, getTopClusters } from "./correlator"
import { runDeepCorrelationPass } from "./correlator-v2"
import { captureTrends } from "./trends"
import { generateDailyBriefing } from "./briefing-generator"
import { generateForecastsAndAnomalies, listAnomalies } from "./forecast"
import { generateActions } from "./action-queue"
import { captureGeoAndSector } from "./geo-sector"
import { notifyBriefing, notifyAnomalies, notifyCriticalClusters } from "./notifications"
import { runForecastBacktest } from "./forecast-backtest"
import { attributeRecentAnomalies } from "./anomaly-attribution"
import { emitAutomationEvent } from "./events"
import { pruneCronRateLog } from "./cron-rate-limit"

export interface AutomationRunOutput {
  threatScore: { score: number; severity: string; delta24h: number } | null
  correlation: { scanned: number; persisted: number } | null
  trends: { captured: number; emergingCount: number } | null
  briefing: { headline: string; threatScore: number; threatLevel: string } | null
  forecasts: { generated: number; anomalies: number } | null
  actions: { created: number; total: number } | null
  geoSector: { countries: number; sectors: number } | null
  notifications: { dispatched: number } | null
  backtest: { evaluated: number; bestMape: number | null } | null
  attribution: { anomaliesAttributed: number } | null
}

async function logRunStart(runType: string): Promise<number | null> {
  const r = await query(
    `INSERT INTO intel_automation_runs (run_type, status, started_at)
     VALUES ($1, 'running', NOW())
     RETURNING id`,
    [runType],
  )
  if (!r.success || !r.data?.length) return null
  return Number((r.data[0] as Record<string, unknown>).id)
}

async function logRunEnd(
  id: number | null,
  status: "success" | "failed",
  durationMs: number,
  output: Record<string, unknown>,
  error?: string,
) {
  if (id === null) return
  await query(
    `UPDATE intel_automation_runs
     SET status = $1, duration_ms = $2, output = $3::jsonb, error = $4, finished_at = NOW()
     WHERE id = $5`,
    [status, durationMs, JSON.stringify(output), error || null, id],
  )
}

/**
 * Run the full automation pipeline. Each step is isolated so a
 * failure in one stage doesn't tear down the rest.
 */
export async function runFullAutomation(): Promise<AutomationRunOutput> {
  const runId = await logRunStart("full")
  const start = Date.now()
  const output: AutomationRunOutput = {
    threatScore: null,
    correlation: null,
    trends: null,
    briefing: null,
    forecasts: null,
    actions: null,
    geoSector: null,
    notifications: null,
    backtest: null,
    attribution: null,
  }
  const errors: string[] = []
  let dispatched = 0

  // 1. Threat score
  try {
    const score = await computeAndPersistThreatScore()
    output.threatScore = {
      score: score.score,
      severity: score.severity,
      delta24h: score.delta24h,
    }
  } catch (err) {
    errors.push(`threatScore: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 2. Correlation (deep multi-anchor v2 + legacy v1 to keep KEV-only clusters in line)
  try {
    const v2 = await runDeepCorrelationPass()
    const v1 = await runCorrelationPass().catch(() => ({ scanned: 0, persisted: 0 }))
    output.correlation = {
      scanned: v2.scanned + v1.scanned,
      persisted: v2.persisted + v1.persisted,
    }
  } catch (err) {
    errors.push(`correlation: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Trends
  try {
    const t = await captureTrends()
    output.trends = { captured: t.captured, emergingCount: t.emerging.length }
  } catch (err) {
    errors.push(`trends: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4. Forecasts + anomalies (depends on trends)
  try {
    const f = await generateForecastsAndAnomalies(7)
    output.forecasts = { generated: f.generated.length, anomalies: f.anomalies.length }
  } catch (err) {
    errors.push(`forecasts: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4b. Anomaly attribution (depends on forecasts)
  try {
    const attributed = await attributeRecentAnomalies()
    output.attribution = { anomaliesAttributed: attributed }
  } catch (err) {
    errors.push(`attribution: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4c. Forecast backtest — only when we have enough history
  try {
    const backtest = await runForecastBacktest(7)
    let bestMape: number | null = null
    if (backtest.length > 0) {
      bestMape = Math.min(...backtest.map((b) => b.mape))
    }
    output.backtest = { evaluated: backtest.length, bestMape }
  } catch (err) {
    errors.push(`backtest: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 5. Geo + sector (depends on cached feeds)
  try {
    const g = await captureGeoAndSector()
    output.geoSector = { countries: g.geo.length, sectors: g.sectors.length }
  } catch (err) {
    errors.push(`geoSector: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 6. Action queue (depends on clusters + anomalies)
  try {
    output.actions = await generateActions()
  } catch (err) {
    errors.push(`actions: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 7. Briefing (depends on score + clusters + trends)
  let briefingResult: Awaited<ReturnType<typeof generateDailyBriefing>> | null = null
  try {
    briefingResult = await generateDailyBriefing()
    output.briefing = {
      headline: briefingResult.headline,
      threatScore: briefingResult.threatScore,
      threatLevel: briefingResult.threatLevel,
    }
  } catch (err) {
    errors.push(`briefing: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 8. Notifications (best-effort, never blocks the pipeline)
  try {
    if (briefingResult) {
      await notifyBriefing(briefingResult)
      if (briefingResult.threatLevel === "critical" || briefingResult.threatLevel === "high") {
        dispatched++
      }
    }
    const recentAnomalies = await listAnomalies(10)
    await notifyAnomalies(recentAnomalies)
    dispatched += recentAnomalies.filter(
      (a) => a.severity === "critical" || a.severity === "high",
    ).length

    const top = await getTopClusters(5)
    await notifyCriticalClusters(top)
    dispatched += top.filter(
      (c) => (c.severity === "critical" || c.severity === "high") && c.riskScore >= 80,
    ).length

    output.notifications = { dispatched }
  } catch (err) {
    errors.push(`notifications: ${err instanceof Error ? err.message : String(err)}`)
  }

  const durationMs = Date.now() - start
  await logRunEnd(
    runId,
    errors.length === 0 ? "success" : "failed",
    durationMs,
    output as unknown as Record<string, unknown>,
    errors.length ? errors.join(" | ") : undefined,
  )

  // Periodic cleanup of the rate-limit log
  pruneCronRateLog().catch(() => {})

  // Data retention: prune old score history (keep 90 days)
  query(`DELETE FROM intel_threat_score_history WHERE computed_at < NOW() - INTERVAL '90 days'`, []).catch(() => {})
  // Prune old forecast accuracy (keep 30 days)
  query(`DELETE FROM intel_forecast_accuracy WHERE evaluated_at < NOW() - INTERVAL '30 days'`, []).catch(() => {})

  await emitAutomationEvent("pipeline.complete", {
    durationMs,
    success: errors.length === 0,
    score: output.threatScore?.score ?? null,
    severity: output.threatScore?.severity ?? null,
  })

  return output
}

/**
 * Last 20 automation runs for the admin Command Center.
 */
export async function getAutomationRuns(limit = 20) {
  const r = await query(
    `SELECT id, run_type, status, duration_ms, output, error, started_at, finished_at
     FROM intel_automation_runs
     ORDER BY started_at DESC LIMIT $1`,
    [limit],
  )
  if (!r.success) return []
  return (r.data || []).map((row: Record<string, unknown>) => ({
    id: Number(row.id),
    runType: String(row.run_type),
    status: String(row.status),
    durationMs: Number(row.duration_ms || 0),
    output: row.output ?? {},
    error: row.error as string | null,
    startedAt: (row.started_at as Date).toISOString(),
    finishedAt: row.finished_at ? (row.finished_at as Date).toISOString() : null,
  }))
}
