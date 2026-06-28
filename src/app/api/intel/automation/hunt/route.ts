// ================================================
// POST /api/intel/automation/hunt
// Threat-hunting query builder — translates a
// constrained DSL into parameterised SQL against
// the automation tables. No raw SQL exposure.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface HuntQuery {
  scope: "clusters" | "actions" | "anomalies" | "briefings" | "geo"
  severityIn?: string[]
  category?: string
  publishedSince?: string   // ISO date
  publishedBefore?: string  // ISO date
  search?: string
  riskScoreMin?: number
  riskScoreMax?: number
  limit?: number
}

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"])


function buildClusterQuery(q: HuntQuery): { sql: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (q.severityIn?.length) {
    const severities = q.severityIn.filter((s) => SEVERITIES.has(s))
    if (severities.length) {
      params.push(severities)
      conds.push(`severity = ANY($${params.length}::text[])`)
    }
  }
  if (q.publishedSince) {
    params.push(q.publishedSince)
    conds.push(`first_seen >= $${params.length}::timestamptz`)
  }
  if (q.publishedBefore) {
    params.push(q.publishedBefore)
    conds.push(`first_seen <= $${params.length}::timestamptz`)
  }
  if (q.search) {
    params.push(`%${q.search}%`)
    conds.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length})`)
  }
  if (typeof q.riskScoreMin === "number") {
    params.push(q.riskScoreMin)
    conds.push(`risk_score >= $${params.length}`)
  }
  if (typeof q.riskScoreMax === "number") {
    params.push(q.riskScoreMax)
    conds.push(`risk_score <= $${params.length}`)
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  params.push(limit)
  return {
    sql: `SELECT cluster_key, cluster_type, title, summary, risk_score, severity,
                 signal_count, tags, first_seen, last_seen
          FROM intel_correlation_clusters
          ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
          ORDER BY risk_score DESC, last_seen DESC
          LIMIT $${params.length}`,
    params,
  }
}

function buildActionQuery(q: HuntQuery): { sql: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (q.severityIn?.length) {
    params.push(q.severityIn.filter((s) => SEVERITIES.has(s)))
    conds.push(`severity = ANY($${params.length}::text[])`)
  }
  if (q.category) {
    params.push(q.category)
    conds.push(`category = $${params.length}`)
  }
  if (q.search) {
    params.push(`%${q.search}%`)
    conds.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`)
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  params.push(limit)
  return {
    sql: `SELECT id, action_key, title, description, category, priority, severity, status, created_at
          FROM intel_action_queue
          ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
          ORDER BY priority DESC, created_at DESC
          LIMIT $${params.length}`,
    params,
  }
}


function buildAnomalyQuery(q: HuntQuery): { sql: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (q.severityIn?.length) {
    params.push(q.severityIn.filter((s) => SEVERITIES.has(s)))
    conds.push(`severity = ANY($${params.length}::text[])`)
  }
  if (q.publishedSince) {
    params.push(q.publishedSince)
    conds.push(`detected_at >= $${params.length}::timestamptz`)
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  params.push(limit)
  return {
    sql: `SELECT id, metric_key, metric_label, bucket_date, value,
                 expected_value, z_score, severity, direction, explanation, caused_by, detected_at
          FROM intel_anomalies
          ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
          ORDER BY detected_at DESC
          LIMIT $${params.length}`,
    params,
  }
}

function buildBriefingQuery(q: HuntQuery): { sql: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (q.severityIn?.length) {
    params.push(q.severityIn.filter((s) => SEVERITIES.has(s)))
    conds.push(`threat_level = ANY($${params.length}::text[])`)
  }
  if (q.publishedSince) {
    params.push(q.publishedSince)
    conds.push(`generated_at >= $${params.length}::timestamptz`)
  }
  if (q.search) {
    params.push(`%${q.search}%`)
    conds.push(`(headline ILIKE $${params.length} OR summary ILIKE $${params.length})`)
  }
  const limit = Math.min(Math.max(Number(q.limit) || 30, 1), 100)
  params.push(limit)
  return {
    sql: `SELECT briefing_type, headline, threat_level, threat_score, summary,
                 period_start, period_end, generated_at
          FROM intel_briefings
          ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
          ORDER BY generated_at DESC
          LIMIT $${params.length}`,
    params,
  }
}

function buildGeoQuery(q: HuntQuery): { sql: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []
  if (q.search) {
    params.push(`%${q.search}%`)
    conds.push(`country ILIKE $${params.length}`)
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  params.push(limit)
  return {
    sql: `SELECT country, country_code, ransomware_count, phishing_count, darknet_count,
                 total_signals, risk_score, bucket_date
          FROM intel_geo_threat
          WHERE bucket_date = (SELECT MAX(bucket_date) FROM intel_geo_threat)
            ${conds.length ? "AND " + conds.join(" AND ") : ""}
          ORDER BY risk_score DESC
          LIMIT $${params.length}`,
    params,
  }
}

const BUILDERS = {
  clusters: buildClusterQuery,
  actions: buildActionQuery,
  anomalies: buildAnomalyQuery,
  briefings: buildBriefingQuery,
  geo: buildGeoQuery,
}

export async function POST(request: NextRequest) {
  const q = (await request.json().catch(() => ({}))) as HuntQuery
  const scope = q.scope
  if (!scope || !(scope in BUILDERS)) {
    return NextResponse.json(
      { error: "Invalid scope; must be one of clusters|actions|anomalies|briefings|geo" },
      { status: 400 },
    )
  }
  const { sql, params } = BUILDERS[scope](q)
  const r = await query(sql, params)
  return NextResponse.json({
    success: r.success,
    scope,
    items: r.success ? r.data : [],
    error: r.success ? undefined : r.error,
  })
}
