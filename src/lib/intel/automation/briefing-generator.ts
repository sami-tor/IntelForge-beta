// ================================================
// IntelForge Automation - Daily Briefing Generator
// ------------------------------------------------
// Produces a structured executive brief from cached
// intel + threat score + correlation clusters.
// No external LLM dependency — deterministic
// narrative built from real numbers so it works even
// when upstream APIs are down.
// ================================================
import { query } from "@/lib/db"
import { computeAndPersistThreatScore, type ThreatScoreResult } from "./threat-score"
import { getTopClusters, type CorrelatedCluster } from "./correlator"
import { getTrendSeries } from "./trends"
import { emitAutomationEvent } from "./events"
import { maybeRewriteSummary } from "./briefing-llm"
import type { FindingSeverity } from "@/lib/intel/risk-scoring"

export type BriefingType = "daily" | "weekly" | "flash"

export interface BriefingHighlight {
  title: string
  detail: string
  severity?: FindingSeverity | string
}

export interface BriefingMetrics {
  newCves24h: number
  criticalCves24h: number
  kev: number
  ransomwareVictims7d: number
  exploits24h: number
  phishingActive: number
  darknetPosts24h: number
  newsItems24h: number
}

export interface GeneratedBriefing {
  briefingType: BriefingType
  headline: string
  threatLevel: FindingSeverity
  threatScore: number
  summary: string
  summaryMethod?: "deterministic" | "llm"
  summaryProvider?: string
  highlights: BriefingHighlight[]
  topClusters: CorrelatedCluster[]
  metrics: BriefingMetrics
  recommendations: string[]
  periodStart: string
  periodEnd: string
}

async function safeCount(sql: string): Promise<number> {
  const r = await query(sql, [])
  if (!r.success || !r.data?.length) return 0
  const v = Number((r.data[0] as Record<string, unknown>).c)
  return Number.isFinite(v) ? v : 0
}

async function collectMetrics(): Promise<BriefingMetrics> {
  const [
    newCves24h,
    criticalCves24h,
    kev,
    ransomware7,
    exploits24h,
    phishing,
    darknet,
    news24h,
  ] = await Promise.all([
    safeCount(
      `SELECT COUNT(*) c FROM intel_cve_cache
       WHERE published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_cve_cache
       WHERE cvss_v3_severity='CRITICAL' AND published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(`SELECT COUNT(*) c FROM intel_cve_cache WHERE is_kev=true`),
    safeCount(
      `SELECT COUNT(*) c FROM intel_ransomware_victims
       WHERE discovered_at > NOW() - INTERVAL '7 days'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_exploit_cache
       WHERE published_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(`SELECT COUNT(*) c FROM intel_phishing_cache WHERE active=true`),
    safeCount(
      `SELECT COUNT(*) c FROM intel_darknet_posts
       WHERE discovered_at > NOW() - INTERVAL '24 hours'`,
    ),
    safeCount(
      `SELECT COUNT(*) c FROM intel_news_cache
       WHERE published_at > NOW() - INTERVAL '24 hours'`,
    ),
  ])

  return {
    newCves24h,
    criticalCves24h,
    kev,
    ransomwareVictims7d: ransomware7,
    exploits24h,
    phishingActive: phishing,
    darknetPosts24h: darknet,
    newsItems24h: news24h,
  }
}

function buildHeadline(score: ThreatScoreResult, metrics: BriefingMetrics): string {
  if (score.severity === "critical" || metrics.criticalCves24h >= 5) {
    return `Threat level CRITICAL — ${metrics.criticalCves24h} new critical vulnerabilities and ${metrics.exploits24h} fresh exploits surfaced today`
  }
  if (score.severity === "high") {
    return `Elevated threat — ${metrics.criticalCves24h} critical CVEs disclosed; ${metrics.ransomwareVictims7d} ransomware victims this week`
  }
  if (metrics.ransomwareVictims7d >= 25) {
    return `Ransomware wave continues — ${metrics.ransomwareVictims7d} new victims tracked across leak sites this week`
  }
  if (metrics.criticalCves24h > 0) {
    return `Stable threat posture with ${metrics.criticalCves24h} critical CVE${metrics.criticalCves24h > 1 ? "s" : ""} requiring review`
  }
  return `Stable threat posture — no acute escalations in the last 24 hours`
}

function buildNarrative(score: ThreatScoreResult, metrics: BriefingMetrics): string {
  const sentences: string[] = []
  sentences.push(
    `Global threat score is ${score.score}/100 (${score.severity})${
      score.delta24h !== 0 ? `, ${score.delta24h > 0 ? "+" : ""}${score.delta24h} pts vs yesterday` : ""
    }.`,
  )
  if (metrics.newCves24h > 0) {
    sentences.push(
      `${metrics.newCves24h} new vulnerabilities entered the catalogue in the last 24 hours${
        metrics.criticalCves24h > 0 ? `, including ${metrics.criticalCves24h} rated critical` : ""
      }.`,
    )
  }
  if (metrics.exploits24h > 0) {
    sentences.push(
      `${metrics.exploits24h} new public exploit${metrics.exploits24h > 1 ? "s" : ""} surfaced — patch prioritisation should account for proof-of-concept availability.`,
    )
  }
  if (metrics.ransomwareVictims7d > 0) {
    sentences.push(
      `${metrics.ransomwareVictims7d} organisation${metrics.ransomwareVictims7d > 1 ? "s have" : " has"} appeared on ransomware leak sites in the last seven days.`,
    )
  }
  if (metrics.phishingActive > 0) {
    sentences.push(
      `Phishing surface remains active with ${metrics.phishingActive.toLocaleString()} URLs currently flagged.`,
    )
  }
  return sentences.join(" ")
}

function buildHighlights(
  score: ThreatScoreResult,
  metrics: BriefingMetrics,
  clusters: CorrelatedCluster[],
  emerging: Array<{ label: string; deltaPct: number }>,
): BriefingHighlight[] {
  const out: BriefingHighlight[] = []

  for (const driver of score.drivers.slice(0, 3)) {
    out.push({ title: "Score driver", detail: driver, severity: score.severity })
  }
  for (const cluster of clusters.slice(0, 4)) {
    out.push({
      title: cluster.title,
      detail: cluster.summary,
      severity: cluster.severity,
    })
  }
  for (const trend of emerging.slice(0, 3)) {
    out.push({
      title: `Emerging trend: ${trend.label}`,
      detail: `${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct.toFixed(1)}% vs prior bucket`,
      severity: "medium",
    })
  }
  if (out.length === 0) {
    out.push({ title: "Steady-state", detail: "No new drivers since last briefing", severity: "low" })
  }
  return out
}

function buildRecommendations(metrics: BriefingMetrics, clusters: CorrelatedCluster[]): string[] {
  const recs: string[] = []
  if (metrics.criticalCves24h > 0) {
    recs.push(`Triage the ${metrics.criticalCves24h} critical CVE${metrics.criticalCves24h > 1 ? "s" : ""} disclosed in the last 24h against your asset inventory.`)
  }
  if (clusters.some((c) => c.tags.includes("kev") && c.tags.includes("exploit-available"))) {
    recs.push("Prioritise patching for any KEV entries that now have public exploit code — see top correlation clusters.")
  }
  if (metrics.ransomwareVictims7d >= 20) {
    recs.push("Run a tabletop drill for ransomware response — leak-site activity is elevated this week.")
  }
  if (metrics.phishingActive >= 5000) {
    recs.push("Refresh phishing awareness training and verify that brand-impersonation alerts are reaching SOC.")
  }
  if (recs.length === 0) {
    recs.push("Maintain steady-state monitoring; no immediate escalations recommended.")
  }
  return recs
}

/**
 * Generate today's daily briefing and persist it.
 * Idempotent for the same period_start (uses UNIQUE constraint).
 */
export async function generateDailyBriefing(): Promise<GeneratedBriefing> {
  const score = await computeAndPersistThreatScore()
  const [metrics, clusters, trends] = await Promise.all([
    collectMetrics(),
    getTopClusters(8),
    getTrendSeries(7),
  ])

  const emerging = trends
    .filter((t) => t.isEmerging)
    .map((t) => ({ label: t.label, deltaPct: t.deltaPct }))

  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000)

  const headline = buildHeadline(score, metrics)
  let summary = buildNarrative(score, metrics)
  let summaryMethod: "deterministic" | "llm" = "deterministic"
  let summaryProvider: string | undefined

  // Optional LLM rewrite. The deterministic line is always the floor.
  try {
    const rewritten = await maybeRewriteSummary({
      headline,
      summary,
      metrics: metrics as unknown as Record<string, number>,
    })
    if (rewritten) {
      summary = rewritten.summary
      summaryMethod = rewritten.method
      summaryProvider = rewritten.provider
    }
  } catch {
    // fall back to deterministic
  }

  const highlights = buildHighlights(score, metrics, clusters, emerging)
  const recommendations = buildRecommendations(metrics, clusters)

  const briefing: GeneratedBriefing = {
    briefingType: "daily",
    headline,
    threatLevel: score.severity,
    threatScore: score.score,
    summary,
    summaryMethod,
    summaryProvider,
    highlights,
    topClusters: clusters.slice(0, 5),
    metrics,
    recommendations,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  }

  // Bucket by UTC day to make UNIQUE(briefing_type, period_start) stable
  const dayBucket = new Date(periodEnd)
  dayBucket.setUTCHours(0, 0, 0, 0)

  await query(
    `INSERT INTO intel_briefings
       (briefing_type, headline, threat_level, threat_score, summary,
        highlights, top_clusters, metrics, recommendations,
        period_start, period_end, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, NOW())
     ON CONFLICT (briefing_type, period_start) DO UPDATE SET
       headline        = EXCLUDED.headline,
       threat_level    = EXCLUDED.threat_level,
       threat_score    = EXCLUDED.threat_score,
       summary         = EXCLUDED.summary,
       highlights      = EXCLUDED.highlights,
       top_clusters    = EXCLUDED.top_clusters,
       metrics         = EXCLUDED.metrics,
       recommendations = EXCLUDED.recommendations,
       period_end      = EXCLUDED.period_end,
       generated_at    = NOW()`,
    [
      briefing.briefingType,
      briefing.headline,
      briefing.threatLevel,
      briefing.threatScore,
      briefing.summary,
      JSON.stringify(briefing.highlights),
      JSON.stringify(briefing.topClusters),
      JSON.stringify(briefing.metrics),
      JSON.stringify(briefing.recommendations),
      dayBucket.toISOString(),
      briefing.periodEnd,
    ],
  )

  await emitAutomationEvent("briefing.published", {
    threatLevel: briefing.threatLevel,
    threatScore: briefing.threatScore,
    headline: briefing.headline,
  })

  return briefing
}

/**
 * Read most recent briefing (used by dashboard/page).
 */
export async function getLatestBriefing(briefingType: BriefingType = "daily"): Promise<GeneratedBriefing | null> {
  const r = await query(
    `SELECT briefing_type, headline, threat_level, threat_score, summary,
            highlights, top_clusters, metrics, recommendations,
            period_start, period_end
     FROM intel_briefings
     WHERE briefing_type = $1
     ORDER BY generated_at DESC LIMIT 1`,
    [briefingType],
  )
  if (!r.success || !r.data?.length) return null
  const row = r.data[0] as Record<string, unknown>
  return {
    briefingType: row.briefing_type as BriefingType,
    headline: String(row.headline),
    threatLevel: row.threat_level as FindingSeverity,
    threatScore: Number(row.threat_score),
    summary: String(row.summary),
    highlights: (row.highlights as BriefingHighlight[]) || [],
    topClusters: (row.top_clusters as CorrelatedCluster[]) || [],
    metrics: (row.metrics as BriefingMetrics) || ({} as BriefingMetrics),
    recommendations: (row.recommendations as string[]) || [],
    periodStart: (row.period_start as Date).toISOString(),
    periodEnd: (row.period_end as Date).toISOString(),
  }
}

export async function listBriefings(limit = 30): Promise<GeneratedBriefing[]> {
  const r = await query(
    `SELECT briefing_type, headline, threat_level, threat_score, summary,
            highlights, top_clusters, metrics, recommendations,
            period_start, period_end
     FROM intel_briefings
     ORDER BY generated_at DESC LIMIT $1`,
    [limit],
  )
  if (!r.success) return []
  return (r.data || []).map((row: Record<string, unknown>) => ({
    briefingType: row.briefing_type as BriefingType,
    headline: String(row.headline),
    threatLevel: row.threat_level as FindingSeverity,
    threatScore: Number(row.threat_score),
    summary: String(row.summary),
    highlights: (row.highlights as BriefingHighlight[]) || [],
    topClusters: (row.top_clusters as CorrelatedCluster[]) || [],
    metrics: (row.metrics as BriefingMetrics) || ({} as BriefingMetrics),
    recommendations: (row.recommendations as string[]) || [],
    periodStart: (row.period_start as Date).toISOString(),
    periodEnd: (row.period_end as Date).toISOString(),
  }))
}
