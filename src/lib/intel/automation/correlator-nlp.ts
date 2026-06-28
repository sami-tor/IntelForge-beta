// ================================================
// IntelForge Automation - NLP-assisted Correlation
// ------------------------------------------------
// The base correlator (correlator.ts) only matches
// news to CVEs by literal CVE-id substring. That misses
// articles that say "Log4Shell", "MOVEit", "PrintNightmare"
// without the ID. This module adds a small named-entity
// match using known vulnerability aliases plus pg_trgm
// similarity on the news title.
// ================================================
import { query } from "@/lib/db"

/** Curated alias map: alias -> canonical CVE id. */
export const VULN_ALIASES: Record<string, string> = {
  log4shell: "CVE-2021-44228",
  log4j: "CVE-2021-44228",
  printnightmare: "CVE-2021-34527",
  moveit: "CVE-2023-34362",
  spring4shell: "CVE-2022-22965",
  followina: "CVE-2022-30190",
  proxyshell: "CVE-2021-34473",
  proxylogon: "CVE-2021-26855",
  zerologon: "CVE-2020-1472",
  bluekeep: "CVE-2019-0708",
  eternalblue: "CVE-2017-0144",
  heartbleed: "CVE-2014-0160",
  shellshock: "CVE-2014-6271",
  spectre: "CVE-2017-5753",
  meltdown: "CVE-2017-5754",
  citrixbleed: "CVE-2023-4966",
  regresshion: "CVE-2024-6387",
  curing: "CVE-2024-3094",   // xz backdoor
  xz: "CVE-2024-3094",
  "ivanti connect secure": "CVE-2024-21887",
}


interface NewsRow {
  guid: string
  title: string
  description: string | null
  published_at: Date | null
  category?: string | null
}

/**
 * For each known alias, search recent news that mentions the alias
 * but NOT the canonical CVE id (so we don't double-count what the
 * base correlator already matched).
 */
export async function findAliasMatches(
  cveIds: string[],
): Promise<Map<string, NewsRow[]>> {
  const out = new Map<string, NewsRow[]>()
  const wanted = new Set(cveIds)

  for (const [alias, cveId] of Object.entries(VULN_ALIASES)) {
    if (!wanted.has(cveId)) continue

    const r = await query(
      `SELECT guid, title, description, published_at
       FROM intel_news_cache
       WHERE published_at > NOW() - INTERVAL '14 days'
         AND (title ILIKE $1 OR description ILIKE $1)
         AND title NOT ILIKE $2
         AND (description IS NULL OR description NOT ILIKE $2)
       ORDER BY published_at DESC
       LIMIT 50`,
      [`%${alias}%`, `%${cveId}%`],
    )
    if (!r.success || !r.data?.length) continue
    const list = out.get(cveId) ?? []
    list.push(...((r.data as NewsRow[]) || []))
    out.set(cveId, list)
  }

  return out
}

/**
 * Use pg_trgm to find news whose title is similar to any anchor CVE
 * description. Returns matches whose similarity exceeds the threshold.
 */
export async function findFuzzyDescriptionMatches(
  cves: Array<{ cveId: string; description: string | null }>,
  threshold = 0.3,
): Promise<Map<string, NewsRow[]>> {
  const out = new Map<string, NewsRow[]>()
  for (const cve of cves) {
    if (!cve.description) continue
    // Take the first 8 keywords of the CVE description
    const keywords = cve.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .slice(0, 8)
      .join(" ")
    if (!keywords) continue

    const r = await query(
      `SELECT guid, title, description, published_at,
              similarity(title, $1) AS sim
       FROM intel_news_cache
       WHERE published_at > NOW() - INTERVAL '14 days'
         AND title % $1
         AND title NOT ILIKE $2
       ORDER BY sim DESC
       LIMIT 5`,
      [keywords, `%${cve.cveId}%`],
    )
    if (!r.success || !r.data?.length) continue
    const list: NewsRow[] = []
    for (const row of r.data as Array<NewsRow & { sim: number }>) {
      if (Number(row.sim) >= threshold) list.push(row)
    }
    if (list.length > 0) out.set(cve.cveId, list)
  }
  return out
}
