// ================================================
// Intel Hub - Supply Chain / Dependency Vuln Intel
// Source: OSV.dev (Google Open Source Vulnerabilities, free no auth)
// ================================================
import { safeFetchJson, memGet, memSet } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { SupplyChainItem, CvssV3Severity } from "@/lib/intel/types"

const OSV_API = "https://api.osv.dev/v1"

// ---- OSV API types ----
interface OSVVuln {
  id: string
  summary?: string
  details?: string
  aliases?: string[]
  modified?: string
  published?: string
  severity?: { type: string; score: string }[]
  affected?: {
    package?: { name: string; ecosystem: string }
    ranges?: { type: string; events: Record<string, string>[] }[]
  }[]
  references?: { type: string; url: string }[]
}

// ---- Fetch vulns for a specific package ----
async function fetchOsvPackage(ecosystem: string, pkgName: string): Promise<SupplyChainItem[]> {
  const data = await safeFetchJson<{ vulns: OSVVuln[] }>(
    `${OSV_API}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "IntelForge/1.0" },
      body: JSON.stringify({ package: { name: pkgName, ecosystem } }),
    },
  )

  if (!data?.vulns) return []
  return data.vulns.map(parseOsvVuln)
}

// ---- Fetch recent vulns from OSV (batch query) ----
async function fetchOsvRecent(): Promise<SupplyChainItem[]> {
  // Query popular packages across ecosystems for recent vulns
  const popularPkgs = [
    { eco: "npm", pkg: "express" }, { eco: "npm", pkg: "react" },
    { eco: "npm", pkg: "next" }, { eco: "npm", pkg: "lodash" },
    { eco: "PyPI", pkg: "django" }, { eco: "PyPI", pkg: "flask" },
    { eco: "PyPI", pkg: "requests" }, { eco: "PyPI", pkg: "numpy" },
    { eco: "Maven", pkg: "org.springframework:spring-web" },
    { eco: "Maven", pkg: "org.apache.logging.log4j:log4j-core" },
    { eco: "Go", pkg: "github.com/gin-gonic/gin" },
    { eco: "Go", pkg: "github.com/labstack/echo" },
    { eco: "crates.io", pkg: "tokio" },
    { eco: "NuGet", pkg: "Microsoft.AspNetCore.App" },
  ]

  const results = await Promise.allSettled(
    popularPkgs.map(({ eco, pkg }) => fetchOsvPackage(eco, pkg)),
  )

  const all: SupplyChainItem[] = []
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value)
  }

  return all.filter(
    (v, i, arr) => arr.findIndex((x) => x.osvId === v.osvId) === i,
  ).slice(0, 100)
}

// ---- Parse OSV vuln ----
function parseOsvVuln(v: OSVVuln): SupplyChainItem {
  const cvssEntry = v.severity?.find((s) => s.type === "CVSS_V3") || v.severity?.[0]
  const cvssScore = cvssEntry ? parseFloat(cvssEntry.score) : undefined
  const severity: CvssV3Severity | undefined = cvssScore
    ? cvssScore >= 9 ? "CRITICAL" : cvssScore >= 7 ? "HIGH" : cvssScore >= 4 ? "MEDIUM" : "LOW"
    : undefined

  const firstAffected = v.affected?.[0]
  const rangeEvents = firstAffected?.ranges?.[0]?.events
    ? Object.entries(firstAffected.ranges[0].events).map(([, v]) => String(v))
    : undefined
  const fixedVersion = rangeEvents?.find((e) => e && e !== "0")

  return {
    osvId: v.id,
    packageName: firstAffected?.package?.name || "unknown",
    packageEcosystem: firstAffected?.package?.ecosystem,
    summary: v.summary,
    details: v.details,
    severity,
    cvssV3Score: cvssScore,
    aliases: v.aliases,
    fixedVersion,
    affectedVersions: rangeEvents,
    referencesUrls: v.references?.map((r) => r.url),
    publishedAt: v.published || new Date().toISOString(),
    modifiedAt: v.modified,
  }
}

// ---- Store to DB ----
async function storeSupplyChain(items: SupplyChainItem[]): Promise<number> {
  let stored = 0
  for (const s of items) {
    const result = await query(
      `INSERT INTO intel_supply_chain_cache
         (osv_id, package_name, package_ecosystem, summary, details,
          severity, cvss_v3_score, cvss_v3_vector, aliases, fixed_version,
          affected_versions, references_urls, published_at, modified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (osv_id) DO UPDATE SET
         severity=EXCLUDED.severity, cvss_v3_score=EXCLUDED.cvss_v3_score,
         fixed_version=EXCLUDED.fixed_version, modified_at=EXCLUDED.modified_at,
         fetched_at=NOW()`,
      [
        s.osvId, s.packageName, s.packageEcosystem || null, s.summary || null,
        s.details || null, s.severity || null, s.cvssV3Score ?? null,
        s.cvssV3Vector || null, s.aliases || null, s.fixedVersion || null,
        s.affectedVersions || null, s.referencesUrls || null,
        s.publishedAt, s.modifiedAt || null,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getSupplyChainFromDb(
  limit = 50,
  ecosystem?: string,
  severity?: string,
): Promise<SupplyChainItem[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (ecosystem) {
    params.push(ecosystem)
    conditions.push(`package_ecosystem = $${params.length}`)
  }
  if (severity) {
    params.push(severity.toUpperCase())
    conditions.push(`severity = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT osv_id, package_name, package_ecosystem, summary, details,
            severity, cvss_v3_score, cvss_v3_vector, aliases, fixed_version,
            affected_versions, references_urls, published_at, modified_at
     FROM intel_supply_chain_cache
     ${where}
     ORDER BY published_at DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    osvId: row.osv_id as string,
    packageName: row.package_name as string,
    packageEcosystem: row.package_ecosystem as string | undefined,
    summary: row.summary as string | undefined,
    details: row.details as string | undefined,
    severity: row.severity as CvssV3Severity | undefined,
    cvssV3Score: row.cvss_v3_score ? Number(row.cvss_v3_score) : undefined,
    cvssV3Vector: row.cvss_v3_vector as string | undefined,
    aliases: row.aliases as string[] | undefined,
    fixedVersion: row.fixed_version as string | undefined,
    affectedVersions: row.affected_versions as string[] | undefined,
    referencesUrls: row.references_urls as string[] | undefined,
    publishedAt: String(row.published_at || ""),
    modifiedAt: row.modified_at ? String(row.modified_at) : undefined,
  }))
}

// ---- Search by package ----
export async function searchSupplyChainByPackage(
  packageName: string,
  ecosystem?: string,
): Promise<SupplyChainItem[]> {
  // Always try live lookup for specific package search
  const results: SupplyChainItem[] = []

  if (ecosystem) {
    const fresh = await fetchOsvPackage(ecosystem, packageName)
    if (fresh.length > 0) {
      await storeSupplyChain(fresh)
      return fresh
    }
  }

  // Try all major ecosystems
  const ecosystems = ["npm", "PyPI", "Maven", "Go", "crates.io", "NuGet"]
  const searches = ecosystems.map((eco) => fetchOsvPackage(eco, packageName))
  const settled = await Promise.allSettled(searches)

  for (const r of settled) {
    if (r.status === "fulfilled") results.push(...r.value)
  }

  if (results.length > 0) await storeSupplyChain(results)
  return results
}

// ---- Main sync ----
export async function fetchAndSyncSupplyChain(): Promise<{ fetched: number; stored: number }> {
  const items = await fetchOsvRecent()
  const stored = await storeSupplyChain(items)

  const fresh = await getSupplyChainFromDb(100)
  memSet("intel:supply_chain:all", fresh, 6 * 3600)

  return { fetched: items.length, stored }
}

// ---- Public API ----
export async function getSupplyChain(
  limit = 50,
  ecosystem?: string,
  severity?: string,
): Promise<SupplyChainItem[]> {
  const cacheKey = `intel:supply_chain:${ecosystem || "all"}:${severity || "all"}:${limit}`
  const cached = memGet<SupplyChainItem[]>(cacheKey)
  if (cached) return cached

  let items = await getSupplyChainFromDb(limit, ecosystem, severity)
  if (items.length === 0) {
    await fetchAndSyncSupplyChain()
    items = await getSupplyChainFromDb(limit, ecosystem, severity)
  }

  memSet(cacheKey, items, 6 * 3600)
  return items
}
