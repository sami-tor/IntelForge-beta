// ================================================
// IntelForge Automation - Global Threat Score
// ------------------------------------------------
// Composite 0-100 score derived from cached intel.
// Pure function over query() results so it can be
// recomputed cheaply by the automation cron.
// ================================================
import { query } from "@/lib/db"
import { severityFromRiskScore, type FindingSeverity } from "@/lib/intel/risk-scoring"
import { emitAutomationEvent } from "./events"

export interface ThreatScoreComponents {
  kev: number
  criticalCves24h: number
  highCves24h: number
  ransomwareVictims7d: number
  ransomwareVictims30d: number
  activePhishing: number
  malware24h: number
  exploits24h: number
  darknetPosts24h: number
  feedFailures: number
}

export interface ThreatScoreResult {
  score: number
  severity: FindingSeverity
  components: ThreatScoreComponents
  drivers: string[]
  delta24h: number
}

const DEFAULT_COMPONENTS: ThreatScoreComponents = {
  kev: 0,
  criticalCves24h: 0,
  highCves24h: 0,
  ransomwareVictims7d: 0,
  ransomwareVictims30d: 0,
  activePhishing: 0,
  malware24h: 0,
  exploits24h: 0,
  darknetPosts24h: 0,
  feedFailures: 0,
}

async function safeCount(sql: string, params: unknown[] = []): Promise<number> {
  const r = await query(sql, params as any[])
  if (!r.success || !r.data?.length) return 0
  const row = r.data[0] as Record<string, unknown>
  const v = row.c ?? row.count ?? Object.values(row)[0]
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Pull every counter the score depends on in parallel.
 * Each query is wrapped with safeCount so a missing
 * table won't break scoring on a fresh deployment.
 */
async function collectComponents(): Promise<ThreatScoreComponents> {
  const [
    kev,
    criticalCves24h,
    highCves24h,
    ransomware7,
    ransomware30,
    phishing,
    malware,
    exploits,
    darknet,
    feedFailures,
  ] = await Promise.all([
    safeCount(`SELECT COUNT(*) c FROM intel_cve_cache WHERE is_kev = true`),
    safeCount(
      `SELECT COUNT(*) c FROM intel_cve_cache
       WHERE cvss_v3_severity = 'CRITICAL' AND published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_cve_cache
       WHERE cvss_v3_severity = 'HIGH' AND published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_ransomware_victims
       WHERE discovered_at > NOW() - INTERVAL '7 days'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_ransomware_victims
       WHERE discovered_at > NOW() - INTERVAL '30 days'`,
    ),
    safeCount(`SELECT COUNT(*) c FROM intel_phishing_cache WHERE active = true`),
    safeCount(
      `SELECT COUNT(*) c FROM intel_malware_cache
       WHERE first_seen > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_exploit_cache
       WHERE published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_darknet_posts
       WHERE discovered_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_feed_sync_log
       WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours'`,
    ),
  ])

  return {
    ...DEFAULT_COMPONENTS,
    kev,
    criticalCves24h,
    highCves24h,
    ransomwareVictims7d: ransomware7,
    ransomwareVictims30d: ransomware30,
    activePhishing: phishing,
    malware24h: malware,
    exploits24h: exploits,
    darknetPosts24h: darknet,
    feedFailures,
  }
}

/**
 * Weights are intentionally conservative — we want a score that
 * sits in the middle range under normal conditions and only
 * crosses 80+ when multiple high-impact signals fire together.
 */
function scoreFromComponents(c: ThreatScoreComponents): { score: number; drivers: string[] } {
  const drivers: string[] = []
  let raw = 30 // baseline floor

  // Critical CVEs in last 24h dominate the score
  if (c.criticalCves24h > 0) {
    const add = Math.min(25, c.criticalCves24h * 4)
    raw += add
    drivers.push(`${c.criticalCves24h} critical CVE${c.criticalCves24h > 1 ? "s" : ""} in last 24h`)
  }
  if (c.highCves24h > 0) {
    raw += Math.min(10, c.highCves24h * 1.2)
    if (c.highCves24h >= 5) drivers.push(`${c.highCves24h} high-severity CVEs in last 24h`)
  }

  // Active KEV catalog — running risk floor
  if (c.kev > 0) {
    raw += Math.min(10, Math.log10(c.kev + 1) * 4)
    if (c.kev >= 1000) drivers.push(`${c.kev} known-exploited vulnerabilities catalogued`)
  }

  // Ransomware activity
  if (c.ransomwareVictims7d > 0) {
    raw += Math.min(15, c.ransomwareVictims7d * 0.5)
    if (c.ransomwareVictims7d >= 20) {
      drivers.push(`${c.ransomwareVictims7d} new ransomware victims this week`)
    }
  }

  // Public exploits dropping
  if (c.exploits24h > 0) {
    raw += Math.min(10, c.exploits24h * 1.5)
    if (c.exploits24h >= 3) drivers.push(`${c.exploits24h} new public exploits in last 24h`)
  }

  // Phishing surface
  if (c.activePhishing > 0) {
    raw += Math.min(8, Math.log10(c.activePhishing + 1) * 3)
    if (c.activePhishing >= 5000) drivers.push(`${c.activePhishing.toLocaleString()} active phishing URLs tracked`)
  }

  // Fresh malware samples
  if (c.malware24h > 0) {
    raw += Math.min(6, c.malware24h * 0.05)
    if (c.malware24h >= 100) drivers.push(`${c.malware24h} new malware samples in last 24h`)
  }

  // Dark web noise
  if (c.darknetPosts24h > 0) {
    raw += Math.min(5, c.darknetPosts24h * 0.2)
    if (c.darknetPosts24h >= 25) drivers.push(`${c.darknetPosts24h} dark-web posts in last 24h`)
  }

  // Feed health penalty (visibility loss = blind spot)
  if (c.feedFailures > 0) {
    raw += Math.min(5, c.feedFailures * 0.4)
    if (c.feedFailures >= 5) drivers.push(`${c.feedFailures} feed sync failures in last 24h (visibility risk)`)
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)))
  if (drivers.length === 0) drivers.push("Steady-state baseline — no acute signals")
  return { score, drivers }
}

async function getPreviousScore(): Promise<number | null> {
  const r = await query(
    `SELECT score FROM intel_threat_score_history
     WHERE computed_at < NOW() - INTERVAL '20 hours'
     ORDER BY computed_at DESC LIMIT 1`,
    [],
  )
  if (!r.success || !r.data?.length) return null
  const v = Number((r.data[0] as Record<string, unknown>).score)
  return Number.isFinite(v) ? v : null
}

/**
 * Compute the current score, persist a snapshot, return it.
 * Safe to call repeatedly — each call appends a new row.
 */
export async function computeAndPersistThreatScore(): Promise<ThreatScoreResult> {
  const components = await collectComponents()
  const { score, drivers } = scoreFromComponents(components)
  const severity = severityFromRiskScore(score)

  const previous = await getPreviousScore()
  const delta24h = previous === null ? 0 : score - previous

  await query(
    `INSERT INTO intel_threat_score_history (score, severity, components, drivers, delta_24h)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
    [score, severity, JSON.stringify(components), JSON.stringify(drivers), delta24h],
  )

  await emitAutomationEvent("score.updated", {
    score,
    severity,
    delta24h,
  })

  return { score, severity, components, drivers, delta24h }
}

/**
 * Read latest score without recomputing — used by the dashboard.
 */
export async function getLatestThreatScore(): Promise<ThreatScoreResult | null> {
  const r = await query(
    `SELECT score, severity, components, drivers, delta_24h
     FROM intel_threat_score_history
     ORDER BY computed_at DESC LIMIT 1`,
    [],
  )
  if (!r.success || !r.data?.length) return null
  const row = r.data[0] as Record<string, unknown>
  return {
    score: Number(row.score),
    severity: row.severity as FindingSeverity,
    components: (row.components as ThreatScoreComponents) || DEFAULT_COMPONENTS,
    drivers: (row.drivers as string[]) || [],
    delta24h: Number(row.delta_24h) || 0,
  }
}

/**
 * Return the last `hours` of score history for the timeline chart.
 */
export async function getThreatScoreHistory(hours = 168) {
  const r = await query(
    `SELECT score, severity, delta_24h, computed_at
     FROM intel_threat_score_history
     WHERE computed_at > NOW() - ($1 || ' hours')::interval
     ORDER BY computed_at ASC`,
    [String(hours)],
  )
  if (!r.success) return []
  return (r.data || []).map((row: Record<string, unknown>) => ({
    score: Number(row.score),
    severity: row.severity as FindingSeverity,
    delta24h: Number(row.delta_24h) || 0,
    computedAt: (row.computed_at as Date).toISOString(),
  }))
}
