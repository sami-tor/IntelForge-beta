// ================================================
// Intel Hub - CVE / Vulnerability Feed
// Sources:
//   NVD API v2 (free, no auth)
//   CISA KEV (Known Exploited Vulnerabilities)
//   EPSS (Exploit Prediction Scoring System)
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { CveItem, CvssV3Severity } from "@/lib/intel/types"

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
const EPSS_BASE = "https://api.first.org/data/v1/epss"

// ---- NVD API types ----
interface NVDResponse {
  vulnerabilities?: NVDVuln[]
  resultsPerPage?: number
  totalResults?: number
}

interface NVDVuln {
  cve: {
    id: string
    descriptions?: { lang: string; value: string }[]
    published?: string
    lastModified?: string
    metrics?: {
      cvssMetricV31?: { cvssData: { baseScore: number; baseSeverity: string } }[]
      cvssMetricV30?: { cvssData: { baseScore: number; baseSeverity: string } }[]
      cvssMetricV2?: { cvssData: { baseScore: number } }[]
    }
    weaknesses?: { description: { value: string }[] }[]
    references?: { url: string }[]
    configurations?: unknown
  }
}

// ---- CISA KEV types ----
interface CISAKEVResponse {
  vulnerabilities?: CISAKEVEntry[]
}

interface CISAKEVEntry {
  cveID: string
  dateAdded: string
  dueDate: string
  requiredAction: string
  shortDescription?: string
  vulnerabilityName?: string
  product?: string
  vendorProject?: string
  notes?: string
}

// ---- EPSS types ----
interface EPSSResponse {
  data?: { cve: string; epss: string; percentile: string }[]
}

// ---- Parse NVD vuln ----
function parseNvdVuln(item: NVDVuln): CveItem {
  const cve = item.cve
  const desc =
    cve.descriptions?.find((d) => d.lang === "en")?.value ||
    cve.descriptions?.[0]?.value ||
    ""

  const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData
  const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData
  const v2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData

  const cvssData = v31 || v30
  const cvssScore = cvssData?.baseScore
  const cvssSeverity = cvssData?.baseSeverity as CvssV3Severity | undefined

  const cwes = (cve.weaknesses || [])
    .flatMap((w) => w.description.map((d) => d.value))
    .filter((v) => v.startsWith("CWE-"))

  const refUrls = (cve.references || []).map((r) => r.url).slice(0, 5)

  return {
    cveId: cve.id,
    description: desc,
    cvssV3Score: cvssScore,
    cvssV3Severity: cvssSeverity,
    cvssV2Score: v2?.baseScore,
    cwe: cwes.length > 0 ? cwes : undefined,
    publishedAt: cve.published || new Date().toISOString(),
    lastModified: cve.lastModified || new Date().toISOString(),
    isKev: false,
    refUrls: refUrls.length > 0 ? refUrls : undefined,
    epssScore: undefined,
    epssPercentile: undefined,
  }
}

// ---- Fetch NVD (paginated, recent 7 days) ----
async function fetchRecentNvdCves(limit = 100): Promise<CveItem[]> {
  const pubStartDate = new Date()
  pubStartDate.setDate(pubStartDate.getDate() - 7)
  const startStr = pubStartDate.toISOString().split(".")[0] + ".000"
  const endStr = new Date().toISOString().split(".")[0] + ".000"

  const url = `${NVD_BASE}?pubStartDate=${startStr}&pubEndDate=${endStr}&resultsPerPage=${Math.min(limit, 100)}`

  const data = await safeFetchJson<NVDResponse>(url, {
    headers: { "User-Agent": "IntelForge/1.0" },
  })

  if (!data?.vulnerabilities) return []
  return data.vulnerabilities.map(parseNvdVuln)
}

// ---- Fetch CISA KEV ----
async function fetchCisaKev(): Promise<{ cveIds: Set<string>; details: Map<string, CISAKEVEntry> }> {
  const data = await safeFetchJson<CISAKEVResponse>(CISA_KEV_URL, {
    headers: { "User-Agent": "IntelForge/1.0" },
  })

  const cveIds = new Set<string>()
  const details = new Map<string, CISAKEVEntry>()

  if (data?.vulnerabilities) {
    for (const entry of data.vulnerabilities) {
      cveIds.add(entry.cveID)
      details.set(entry.cveID, entry)
    }
  }

  return { cveIds, details }
}

// ---- Fetch EPSS scores for a batch of CVEs ----
async function fetchEpssScores(cveIds: string[]): Promise<Map<string, { score: number; percentile: number }>> {
  const scoreMap = new Map<string, { score: number; percentile: number }>()
  if (cveIds.length === 0) return scoreMap

  // EPSS API accepts comma-separated CVE list, limit 100/request
  for (let i = 0; i < cveIds.length; i += 100) {
    const batch = cveIds.slice(i, i + 100)
    const data = await safeFetchJson<EPSSResponse>(
      `${EPSS_BASE}?cve=${batch.join(",")}`,
      { headers: { "User-Agent": "IntelForge/1.0" } },
    )
    if (data?.data) {
      for (const item of data.data) {
        scoreMap.set(item.cve, {
          score: parseFloat(item.epss),
          percentile: parseFloat(item.percentile),
        })
      }
    }
  }
  return scoreMap
}

// ---- Store to DB ----
async function storeCves(cves: CveItem[]): Promise<number> {
  let stored = 0
  for (const c of cves) {
    const result = await query(
       `INSERT INTO intel_cve_cache
         (cve_id, description, cvss_v3_score, cvss_v3_severity, cvss_v2_score,
          epss_score, epss_percentile, cwe, published_at, last_modified,
          is_kev, kev_added_date, kev_due_date, kev_required_action, ref_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (cve_id) DO UPDATE SET
         cvss_v3_score=EXCLUDED.cvss_v3_score,
         cvss_v3_severity=EXCLUDED.cvss_v3_severity,
         epss_score=EXCLUDED.epss_score,
         epss_percentile=EXCLUDED.epss_percentile,
         is_kev=EXCLUDED.is_kev,
         kev_added_date=EXCLUDED.kev_added_date,
         kev_due_date=EXCLUDED.kev_due_date,
         kev_required_action=EXCLUDED.kev_required_action,
         last_modified=EXCLUDED.last_modified,
         fetched_at=NOW()`,
      [
        c.cveId,
        c.description,
        c.cvssV3Score ?? null,
        c.cvssV3Severity ?? null,
        c.cvssV2Score ?? null,
        c.epssScore ?? null,
        c.epssPercentile ?? null,
        c.cwe || null,
        c.publishedAt,
        c.lastModified,
        c.isKev,
        c.kevAddedDate || null,
        c.kevDueDate || null,
        c.kevRequiredAction || null,
        c.refUrls || null,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getCvesFromDb(
  limit = 50,
  severity?: string,
  kevOnly = false,
): Promise<CveItem[]> {
  const conditions: string[] = []
  const params: (string | number | boolean)[] = [limit]

  if (severity && severity !== "all") {
    params.push(severity.toUpperCase())
    conditions.push(`cvss_v3_severity = $${params.length}`)
  }
  if (kevOnly) {
    conditions.push(`is_kev = true`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, cvss_v2_score,
            epss_score, epss_percentile, cwe, published_at, last_modified,
            is_kev, kev_added_date, kev_due_date, kev_required_action, ref_urls
     FROM intel_cve_cache
     ${where}
     ORDER BY ${kevOnly ? "kev_added_date" : "published_at"} DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    cveId: row.cve_id as string,
    description: row.description as string,
    cvssV3Score: row.cvss_v3_score ? Number(row.cvss_v3_score) : undefined,
    cvssV3Severity: row.cvss_v3_severity as CvssV3Severity | undefined,
    cvssV2Score: row.cvss_v2_score ? Number(row.cvss_v2_score) : undefined,
    epssScore: row.epss_score ? Number(row.epss_score) : undefined,
    epssPercentile: row.epss_percentile ? Number(row.epss_percentile) : undefined,
    cwe: row.cwe as string[] | undefined,
    publishedAt: (row.published_at as Date).toISOString(),
    lastModified: (row.last_modified as Date).toISOString(),
    isKev: Boolean(row.is_kev),
    kevAddedDate: row.kev_added_date ? String(row.kev_added_date) : undefined,
    kevDueDate: row.kev_due_date ? String(row.kev_due_date) : undefined,
    kevRequiredAction: row.kev_required_action as string | undefined,
    refUrls: row.ref_urls as string[] | undefined,
  }))
}

// ---- Main sync ----
export async function fetchAndSyncCves(): Promise<{ fetched: number; stored: number }> {
  const [recentCves, { cveIds: kevIds, details: kevDetails }] = await Promise.all([
    fetchRecentNvdCves(100),
    fetchCisaKev(),
  ])

  // Mark KEV items
  for (const cve of recentCves) {
    if (kevIds.has(cve.cveId)) {
      const kevEntry = kevDetails.get(cve.cveId)!
      cve.isKev = true
      cve.kevAddedDate = kevEntry.dateAdded
      cve.kevDueDate = kevEntry.dueDate
      cve.kevRequiredAction = kevEntry.requiredAction
      cve.vendor = kevEntry.vendorProject
      cve.product = kevEntry.product
    }
  }

  // Fetch EPSS scores for batch
  const cveIdList = recentCves.map((c) => c.cveId)
  const epssMap = await fetchEpssScores(cveIdList)
  for (const cve of recentCves) {
    const e = epssMap.get(cve.cveId)
    if (e) {
      cve.epssScore = e.score
      cve.epssPercentile = e.percentile
    }
  }

  // Also store standalone KEV entries not in recent NVD
  const kevOnlyEntries: CveItem[] = []
  for (const [cveId, entry] of kevDetails.entries()) {
    if (!recentCves.find((c) => c.cveId === cveId)) {
      kevOnlyEntries.push({
        cveId,
        description: entry.shortDescription || entry.vulnerabilityName || "Known exploited vulnerability",
        publishedAt: entry.dateAdded,
        lastModified: entry.dateAdded,
        isKev: true,
        kevAddedDate: entry.dateAdded,
        kevDueDate: entry.dueDate,
        kevRequiredAction: entry.requiredAction,
        vendor: entry.vendorProject,
        product: entry.product,
      })
    }
  }

  const all = [...recentCves, ...kevOnlyEntries]
  const stored = await storeCves(all)

  // Refresh memory cache
  const fresh = await getCvesFromDb(100)
  memSet("intel:cve:all", fresh, TTL.CVE)
  const kevFresh = await getCvesFromDb(100, undefined, true)
  memSet("intel:cve:kev", kevFresh, TTL.CVE_KEV)

  return { fetched: all.length, stored }
}

// ---- Public API ----
export async function getCves(
  limit = 50,
  severity?: string,
  kevOnly = false,
): Promise<CveItem[]> {
  const cacheKey = `intel:cve:${kevOnly ? "kev" : severity || "all"}:${limit}`
  const cached = memGet<CveItem[]>(cacheKey)
  if (cached) return cached

  let cves = await getCvesFromDb(limit, severity, kevOnly)
  if (cves.length === 0) {
    await fetchAndSyncCves()
    cves = await getCvesFromDb(limit, severity, kevOnly)
  }

  memSet(cacheKey, cves, kevOnly ? TTL.CVE_KEV : TTL.CVE)
  return cves
}
