// ================================================
// IntelForge Automation - Cross-Source Correlator
// ------------------------------------------------
// Walks the cached feeds and produces "clusters":
// a CVE with its exploits, KEV flag, news mentions
// and ransomware references, all merged into one
// row in intel_correlation_clusters.
// Re-runnable: upserts on cluster_key.
// ================================================
import { query } from "@/lib/db"
import { severityFromRiskScore, type FindingSeverity } from "@/lib/intel/risk-scoring"
import { findAliasMatches, findFuzzyDescriptionMatches } from "./correlator-nlp"
import { emitAutomationEvent } from "./events"

export interface CorrelationSignal {
  type: "exploit" | "news" | "ransomware" | "phishing" | "malware" | "actor" | "kev"
  source?: string          // anonymous label, e.g. "exploit", "feed" — never raw provider name
  ref?: string
  title?: string
  detail?: string
  severity?: string
  publishedAt?: string
}

export interface ClusterPayload {
  cve?: {
    cveId: string
    score?: number
    severity?: string
    isKev?: boolean
    description?: string
    publishedAt?: string
  }
  signals: CorrelationSignal[]
  iocs?: string[]
  actors?: string[]
}

export interface CorrelatedCluster {
  clusterKey: string
  clusterType: "cve" | "actor" | "malware" | "ransomware"
  title: string
  summary: string
  riskScore: number
  severity: FindingSeverity
  signalCount: number
  signals: ClusterPayload
  tags: string[]
  firstSeen: string
  lastSeen: string
}

interface CveRow {
  cve_id: string
  description: string | null
  cvss_v3_score: number | null
  cvss_v3_severity: string | null
  epss_score: number | null
  is_kev: boolean | null
  published_at: Date | null
}

interface ExploitRow {
  exploit_id: string
  cve_id: string | null
  title: string | null
  exploit_type: string | null
  published_at: Date | null
  verified: boolean | null
}

interface NewsRow {
  guid: string
  title: string
  category: string | null
  published_at: Date | null
  description?: string | null
}

/** Pull recent CVEs that already have at least one signal we care about. */
async function fetchAnchorCves(limit = 80): Promise<CveRow[]> {
  const r = await query(
    `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity,
            epss_score, is_kev, published_at
     FROM intel_cve_cache
     WHERE published_at > NOW() - INTERVAL '14 days'
        OR is_kev = true
     ORDER BY
       (CASE WHEN is_kev THEN 1 ELSE 0 END) DESC,
       cvss_v3_score DESC NULLS LAST,
       published_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  )
  return ((r.success && r.data) || []) as CveRow[]
}

async function fetchExploitsForCves(cveIds: string[]): Promise<Map<string, ExploitRow[]>> {
  if (cveIds.length === 0) return new Map()
  const r = await query(
    `SELECT exploit_id, cve_id, title, exploit_type, published_at, verified
     FROM intel_exploit_cache
     WHERE cve_id = ANY($1::text[])
     ORDER BY published_at DESC NULLS LAST`,
    [cveIds],
  )
  const out = new Map<string, ExploitRow[]>()
  for (const row of (r.data || []) as ExploitRow[]) {
    if (!row.cve_id) continue
    const list = out.get(row.cve_id) ?? []
    list.push(row)
    out.set(row.cve_id, list)
  }
  return out
}

async function fetchNewsForCves(cveIds: string[]): Promise<Map<string, NewsRow[]>> {
  if (cveIds.length === 0) return new Map()
  // Match CVE id literal in title or description
  const conditions = cveIds.map((_, i) => `(title ILIKE $${i + 1} OR description ILIKE $${i + 1})`).join(" OR ")
  const params = cveIds.map((id) => `%${id}%`)
  const r = await query(
    `SELECT guid, title, category, published_at, description
     FROM intel_news_cache
     WHERE published_at > NOW() - INTERVAL '14 days'
       AND (${conditions})
     ORDER BY published_at DESC
     LIMIT 200`,
    params,
  )
  const out = new Map<string, NewsRow[]>()
  for (const row of (r.data || []) as Array<NewsRow & { description?: string }>) {
    const haystack = `${row.title} ${row.description ?? ""}`
    for (const id of cveIds) {
      if (haystack.includes(id)) {
        const list = out.get(id) ?? []
        list.push(row)
        out.set(id, list)
        break
      }
    }
  }
  return out
}

function scoreCluster(payload: ClusterPayload): number {
  const cve = payload.cve
  let score = 30
  const cvssScore = Number(cve?.score ?? 0)
  if (cvssScore >= 9) score += 30
  else if (cvssScore >= 7) score += 20
  else if (cvssScore >= 4) score += 10

  if (cve?.isKev) score += 20
  if (payload.signals.some((s) => s.type === "exploit")) score += 15
  if (payload.signals.filter((s) => s.type === "news").length >= 2) score += 5
  if (payload.signals.some((s) => s.type === "ransomware")) score += 10

  return Math.max(0, Math.min(100, score))
}

function buildSummary(payload: ClusterPayload): string {
  const cve = payload.cve
  const parts: string[] = []
  if (cve) {
    const sev = cve.severity ? cve.severity.toLowerCase() : "unrated"
    parts.push(`${cve.cveId} (${sev}, CVSS ${cve.score ?? "n/a"})`)
    if (cve.isKev) parts.push("listed in KEV")
  }
  const exploits = payload.signals.filter((s) => s.type === "exploit").length
  if (exploits > 0) parts.push(`${exploits} public exploit${exploits > 1 ? "s" : ""} available`)
  const news = payload.signals.filter((s) => s.type === "news").length
  if (news > 0) parts.push(`${news} news mention${news > 1 ? "s" : ""}`)
  if (payload.actors?.length) parts.push(`linked actors: ${payload.actors.slice(0, 2).join(", ")}`)
  return parts.join(" · ")
}

/**
 * Run a full correlation pass and upsert clusters.
 * Returns the count of clusters touched.
 */
export async function runCorrelationPass(): Promise<{ scanned: number; persisted: number }> {
  const cves = await fetchAnchorCves(80)
  if (cves.length === 0) return { scanned: 0, persisted: 0 }

  const ids = cves.map((c) => c.cve_id)
  const [exploits, news, aliasMatches, fuzzyMatches] = await Promise.all([
    fetchExploitsForCves(ids),
    fetchNewsForCves(ids),
    findAliasMatches(ids),
    findFuzzyDescriptionMatches(
      cves.map((c) => ({ cveId: c.cve_id, description: c.description })),
    ),
  ])

  // Merge alias + fuzzy news matches into the news map
  // The NLP module returns rows with optional category; coerce to local shape.
  for (const [cveId, rows] of aliasMatches) {
    const existing = news.get(cveId) ?? []
    const seen = new Set(existing.map((n) => n.guid))
    for (const r of rows) {
      if (!seen.has(r.guid)) {
        existing.push({
          guid: r.guid,
          title: r.title,
          category: null,
          published_at: r.published_at,
          description: r.description,
        })
      }
    }
    news.set(cveId, existing)
  }
  for (const [cveId, rows] of fuzzyMatches) {
    const existing = news.get(cveId) ?? []
    const seen = new Set(existing.map((n) => n.guid))
    for (const r of rows) {
      if (!seen.has(r.guid)) {
        existing.push({
          guid: r.guid,
          title: r.title,
          category: null,
          published_at: r.published_at,
          description: r.description,
        })
      }
    }
    news.set(cveId, existing)
  }

  let persisted = 0

  for (const cve of cves) {
    const exploitRows = exploits.get(cve.cve_id) || []
    const newsRows = news.get(cve.cve_id) || []

    // Skip clusters with zero correlation evidence and no KEV flag
    if (!cve.is_kev && exploitRows.length === 0 && newsRows.length === 0) continue

    const signals: CorrelationSignal[] = []

    if (cve.is_kev) {
      signals.push({
        type: "kev",
        source: "kev",
        ref: cve.cve_id,
        title: "Known Exploited Vulnerability",
        detail: "Listed in CISA KEV catalog",
      })
    }

    for (const ex of exploitRows.slice(0, 5)) {
      signals.push({
        type: "exploit",
        source: "exploit",
        ref: ex.exploit_id,
        title: ex.title || `Exploit ${ex.exploit_id}`,
        detail: ex.exploit_type || undefined,
        publishedAt: ex.published_at?.toISOString(),
      })
    }

    for (const n of newsRows.slice(0, 4)) {
      signals.push({
        type: "news",
        source: "news",
        ref: n.guid,
        title: n.title,
        detail: n.category || undefined,
        publishedAt: n.published_at?.toISOString(),
      })
    }

    const payload: ClusterPayload = {
      cve: {
        cveId: cve.cve_id,
        score: cve.cvss_v3_score === null ? undefined : Number(cve.cvss_v3_score),
        severity: cve.cvss_v3_severity || undefined,
        isKev: !!cve.is_kev,
        description: cve.description ?? undefined,
        publishedAt: cve.published_at?.toISOString(),
      },
      signals,
    }

    const riskScore = scoreCluster(payload)
    const severity = severityFromRiskScore(riskScore)
    const summary = buildSummary(payload)
    const tags: string[] = []
    if (payload.cve?.isKev) tags.push("kev")
    if (signals.some((s) => s.type === "exploit")) tags.push("exploit-available")
    if (riskScore >= 80) tags.push("high-priority")

    await query(
      `INSERT INTO intel_correlation_clusters
        (cluster_key, cluster_type, title, summary, risk_score, severity, signal_count, signals, tags, first_seen, last_seen, auto_generated, updated_at)
       VALUES ($1, 'cve', $2, $3, $4, $5, $6, $7::jsonb, $8, NOW(), NOW(), true, NOW())
       ON CONFLICT (cluster_key) DO UPDATE SET
         title       = EXCLUDED.title,
         summary     = EXCLUDED.summary,
         risk_score  = GREATEST(intel_correlation_clusters.risk_score, EXCLUDED.risk_score),
         severity    = EXCLUDED.severity,
         signal_count= EXCLUDED.signal_count,
         signals     = EXCLUDED.signals,
         tags        = EXCLUDED.tags,
         last_seen   = NOW(),
         updated_at  = NOW()`,
      [
        cve.cve_id,
        cve.cve_id,
        summary,
        riskScore,
        severity,
        signals.length + 1, // +1 for the CVE anchor itself
        JSON.stringify(payload),
        tags,
      ],
    )

    persisted++
  }

  if (persisted > 0) {
    await emitAutomationEvent("cluster.upserted", { count: persisted })
  }

  return { scanned: cves.length, persisted }
}

/**
 * Public read helpers used by API and dashboard.
 */
export async function getTopClusters(limit = 10): Promise<CorrelatedCluster[]> {
  const r = await query(
    `SELECT cluster_key, cluster_type, title, summary, risk_score, severity,
            signal_count, signals, tags, first_seen, last_seen
     FROM intel_correlation_clusters
     ORDER BY risk_score DESC, last_seen DESC
     LIMIT $1`,
    [limit],
  )
  if (!r.success) return []
  return (r.data || []).map((row: Record<string, unknown>) => ({
    clusterKey: String(row.cluster_key),
    clusterType: String(row.cluster_type) as CorrelatedCluster["clusterType"],
    title: String(row.title),
    summary: String(row.summary || ""),
    riskScore: Number(row.risk_score),
    severity: String(row.severity) as FindingSeverity,
    signalCount: Number(row.signal_count),
    signals: (row.signals as ClusterPayload) || { signals: [] },
    tags: (row.tags as string[]) || [],
    firstSeen: (row.first_seen as Date).toISOString(),
    lastSeen: (row.last_seen as Date).toISOString(),
  }))
}
