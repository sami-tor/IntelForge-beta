// ================================================
// Vulnerability Prioritization Engine
// Composite score: CVSS + EPSS + KEV + Exploit availability
// ================================================
import { query } from "@/lib/db"

export interface PriorityScore {
  cveId: string
  description: string
  cvssScore: number
  epssScore: number
  isKev: boolean
  hasExploit: boolean
  hasPoC: boolean
  compositeScore: number
  verdict: "PATCH_NOW" | "PATCH_SOON" | "MONITOR" | "LOW_PRIORITY"
  factors: string[]
}

// Weights: CVSS 40%, EPSS 30%, KEV 20%, Exploit 10%
function computeComposite(
  cvss: number,
  epss: number,
  isKev: boolean,
  hasExploit: boolean,
): { score: number; verdict: PriorityScore["verdict"]; factors: string[] } {
  const cvssNorm = Math.min(cvss / 10, 1)
  const epssNorm = Math.min(epss, 1)
  const kevScore = isKev ? 1 : 0
  const exploitScore = hasExploit ? 1 : 0

  const score = Math.round(
    (cvssNorm * 0.4 + epssNorm * 0.3 + kevScore * 0.2 + exploitScore * 0.1) * 100,
  )

  const factors: string[] = []
  if (cvss >= 9) factors.push("Critical CVSS")
  else if (cvss >= 7) factors.push("High CVSS")
  if (epss >= 0.5) factors.push(`High exploit probability (${Math.round(epss * 100)}%)`)
  if (isKev) factors.push("Known exploited in wild (KEV)")
  if (hasExploit) factors.push("Public exploit available")

  let verdict: PriorityScore["verdict"]
  if (score >= 70 || (isKev && cvss >= 7)) verdict = "PATCH_NOW"
  else if (score >= 50) verdict = "PATCH_SOON"
  else if (score >= 30) verdict = "MONITOR"
  else verdict = "LOW_PRIORITY"

  return { score, verdict, factors }
}

export async function getPrioritizedVulns(
  limit = 50,
  minSeverity?: string,
): Promise<PriorityScore[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (minSeverity) {
    const levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    const idx = levels.indexOf(minSeverity.toUpperCase())
    if (idx >= 0) {
      const incl = levels.slice(idx)
      params.push(...incl)
      conditions.push(`cvss_v3_severity = ANY($${params.length})`)
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const r = await query(
    `SELECT c.cve_id, c.description, c.cvss_v3_score, c.epss_score, c.is_kev,
            c.vendor, c.product,
            CASE WHEN e.exploit_id IS NOT NULL THEN true ELSE false END as has_exploit,
            CASE WHEN e.poc_url IS NOT NULL THEN true ELSE false END as has_poc
     FROM intel_cve_cache c
     LEFT JOIN intel_exploit_cache e ON UPPER(e.cve_id) = UPPER(c.cve_id)
     ${where}
     ORDER BY c.cvss_v3_score DESC NULLS LAST, c.epss_score DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  const results: PriorityScore[] = []
  for (const row of r.data || []) {
    const cvss = Number(row.cvss_v3_score || 0)
    const epss = Number(row.epss_score || 0)
    const isKev = Boolean(row.is_kev)
    const hasExploit = Boolean(row.has_exploit)

    const { score, verdict, factors } = computeComposite(cvss, epss, isKev, hasExploit)

    results.push({
      cveId: String(row.cve_id),
      description: String(row.description || ""),
      cvssScore: cvss,
      epssScore: epss,
      isKev,
      hasExploit,
      hasPoC: Boolean(row.has_poc),
      compositeScore: score,
      verdict,
      factors,
    })
  }

  return results.sort((a, b) => b.compositeScore - a.compositeScore)
}

export async function getPrioritizationStats() {
  const r = await query(
    `SELECT
       COUNT(*) FILTER (WHERE is_kev = true) as kev_count,
       COUNT(*) FILTER (WHERE cvss_v3_severity = 'CRITICAL') as critical_count,
       COUNT(*) FILTER (WHERE cvss_v3_severity = 'HIGH') as high_count,
       COUNT(*) FILTER (WHERE epss_score >= 0.5) as high_epss_count
     FROM intel_cve_cache`,
    [],
  )
  const row = r.data?.[0] || {}
  return {
    kevCount: Number(row.kev_count || 0),
    criticalCount: Number(row.critical_count || 0),
    highCount: Number(row.high_count || 0),
    highEpssCount: Number(row.high_epss_count || 0),
  }
}
