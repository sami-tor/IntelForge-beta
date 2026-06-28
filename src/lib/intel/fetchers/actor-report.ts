import { query } from "@/lib/db"
import { safeFetchJson } from "@/lib/intel/cache"
import type {
  CveItem,
  MitreGroup,
  NewsItem,
  ThreatActorRelationship,
  ThreatActorReport,
} from "@/lib/intel/types"

type DbRow = Record<string, unknown>

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function rel(
  source: string,
  target: string,
  relation: string,
  confidence: number,
  evidenceCount: number,
  sources: string[],
): ThreatActorRelationship {
  return {
    id: `${source}:${relation}:${target}`,
    source,
    target,
    relation,
    confidence,
    evidenceCount,
    sources: uniqueStrings(sources),
  }
}

async function getOtxPulses(queryText: string) {
  const key = process.env.OTX_API_KEY
  if (!key) return []

  const response = await safeFetchJson<{
    results?: Array<{
      id: string
      name: string
      modified: string
      tags?: string[]
      references?: string[]
      indicators_count?: number
    }>
  }>(
    `https://otx.alienvault.com/api/v1/search/pulses?q=${encodeURIComponent(queryText)}`,
    {
      headers: {
        "X-OTX-API-KEY": key,
        "User-Agent": "IntelForge/1.0",
      },
    },
    20000,
  )

  if (!response?.results?.length) return []
  return response.results.slice(0, 10).map((pulse) => ({
    id: pulse.id,
    name: pulse.name,
    modified: pulse.modified,
    tags: pulse.tags || [],
    references: pulse.references || [],
    indicatorsCount: Number(pulse.indicators_count || 0),
  }))
}

export async function generateThreatActorReport(queryText: string): Promise<ThreatActorReport> {
  const q = queryText.trim()
  const like = `%${q}%`

  const [actorsRes, malwareRes, cveRes, newsRes, ransomRes, victimRes] = await Promise.all([
    query(
      `SELECT stix_id, name, group_id, aliases, description, url, techniques
       FROM intel_mitre_groups
       WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR group_id ILIKE $1
       ORDER BY name ASC
       LIMIT 15`,
      [like],
    ),
    query(
      `SELECT malware_family, tags, iocs, source
       FROM intel_malware_cache
       WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR iocs::text ILIKE $1
       ORDER BY first_seen DESC NULLS LAST
       LIMIT 100`,
      [like],
    ),
    query(
      `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, published_at, last_modified,
              is_kev, kev_added_date, kev_due_date, kev_required_action, vendor, product, ref_urls
       FROM intel_cve_cache
       WHERE description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1
       ORDER BY is_kev DESC, cvss_v3_score DESC NULLS LAST, published_at DESC
       LIMIT 25`,
      [like],
    ),
    query(
      `SELECT guid, title, description, url, source, source_label, category, published_at, image_url, author
       FROM intel_news_cache
       WHERE title ILIKE $1 OR description ILIKE $1
       ORDER BY published_at DESC
       LIMIT 30`,
      [like],
    ),
    query(
      `SELECT name
       FROM intel_ransomware_groups
       WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1
       ORDER BY victim_count DESC
       LIMIT 20`,
      [like],
    ),
    query(
      `SELECT victim_name
       FROM intel_ransomware_victims
       WHERE victim_name ILIKE $1 OR group_name ILIKE $1 OR description ILIKE $1
       ORDER BY discovered_at DESC NULLS LAST
       LIMIT 30`,
      [like],
    ),
  ])

  const actorRows = (actorsRes.data || []) as DbRow[]
  const malwareRows = (malwareRes.data || []) as DbRow[]
  const cveRows = (cveRes.data || []) as DbRow[]
  const newsRows = (newsRes.data || []) as DbRow[]
  const ransomwareRows = (ransomRes.data || []) as DbRow[]
  const victimRows = (victimRes.data || []) as DbRow[]

  const actorMatches: MitreGroup[] = actorRows.map((row) => ({
    stixId: String(row.stix_id),
    name: String(row.name),
    groupId: row.group_id ? String(row.group_id) : undefined,
    aliases: (row.aliases as string[]) || [],
    description: row.description ? String(row.description) : undefined,
    url: row.url ? String(row.url) : undefined,
    techniques: (row.techniques as string[]) || [],
    software: [],
    sectors: [],
    countries: [],
  }))

  const relatedCves: CveItem[] = cveRows.map((row) => ({
    cveId: String(row.cve_id),
    description: String(row.description || ""),
    cvssV3Score: row.cvss_v3_score ? Number(row.cvss_v3_score) : undefined,
    cvssV3Severity: row.cvss_v3_severity ? String(row.cvss_v3_severity) as CveItem["cvssV3Severity"] : undefined,
    vendor: row.vendor ? String(row.vendor) : undefined,
    product: row.product ? String(row.product) : undefined,
    publishedAt: toIso(row.published_at),
    lastModified: toIso(row.last_modified),
    isKev: Boolean(row.is_kev),
    kevAddedDate: row.kev_added_date ? String(row.kev_added_date) : undefined,
    kevDueDate: row.kev_due_date ? String(row.kev_due_date) : undefined,
    kevRequiredAction: row.kev_required_action ? String(row.kev_required_action) : undefined,
    refUrls: (row.ref_urls as string[]) || [],
  }))

  const relatedNews: NewsItem[] = newsRows.map((row) => ({
    id: String(row.guid),
    guid: String(row.guid),
    title: String(row.title || ""),
    description: String(row.description || ""),
    url: String(row.url || ""),
    source: String(row.source || ""),
    sourceLabel: String(row.source_label || row.source || ""),
    category: (String(row.category || "general") as NewsItem["category"]),
    publishedAt: toIso(row.published_at),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    author: row.author ? String(row.author) : undefined,
  }))

  const aliases = uniqueStrings([
    ...actorMatches.flatMap((actor) => actor.aliases || []),
    ...actorMatches.map((actor) => actor.name),
  ])

  const relatedTechniques = uniqueStrings(actorMatches.flatMap((actor) => actor.techniques || [])).slice(0, 100)
  const relatedMalwareFamilies = uniqueStrings(
    malwareRows.flatMap((row) => ((row.malware_family as string[]) || [])),
  ).slice(0, 100)
  const relatedIocs = uniqueStrings(
    malwareRows.flatMap((row) => ((row.iocs as string[]) || [])),
  ).slice(0, 200)
  const relatedRansomwareGroups = uniqueStrings(ransomwareRows.map((row) => String(row.name || "")))
  const relatedVictims = uniqueStrings(victimRows.map((row) => String(row.victim_name || "")))
  const otxPulses = await getOtxPulses(q)

  const relationships: ThreatActorRelationship[] = []
  for (const actor of actorMatches) {
    for (const techniqueId of actor.techniques || []) {
      relationships.push(rel(actor.name, techniqueId, "uses-technique", 88, 1, ["cache"]))
    }
  }
  for (const family of relatedMalwareFamilies) {
    const confidence = aliases.some((alias) => family.toLowerCase().includes(alias.toLowerCase())) ? 82 : 65
    relationships.push(rel(q, family, "linked-malware-family", confidence, 1, ["cache"]))
  }
  for (const cve of relatedCves.slice(0, 20)) {
    const confidence = cve.isKev ? 78 : 64
    relationships.push(rel(q, cve.cveId, "mentions-cve", confidence, cve.refUrls?.length || 1, ["cache"]))
  }
  for (const ioc of relatedIocs.slice(0, 80)) {
    relationships.push(rel(q, ioc, "linked-ioc", 60, 1, ["cache"]))
  }
  for (const pulse of otxPulses) {
    relationships.push(rel(q, pulse.name, "intel-pulse", 72, Math.max(1, pulse.indicatorsCount), ["cache"]))
  }

  const dedupedRelationships = Object.values(
    relationships.reduce<Record<string, ThreatActorRelationship>>((acc, current) => {
      const existing = acc[current.id]
      if (!existing) {
        acc[current.id] = current
        return acc
      }
      acc[current.id] = {
        ...existing,
        confidence: Math.max(existing.confidence, current.confidence),
        evidenceCount: existing.evidenceCount + current.evidenceCount,
        sources: uniqueStrings([
          ...(existing.sources ?? []),
          ...(current.sources ?? []),
        ]),
      }
      return acc
    }, {}),
  ).sort((a, b) => b.confidence - a.confidence)

  const confidenceSummary = {
    high: dedupedRelationships.filter((item) => item.confidence >= 80).length,
    medium: dedupedRelationships.filter((item) => item.confidence >= 60 && item.confidence < 80).length,
    low: dedupedRelationships.filter((item) => item.confidence < 60).length,
  }

  return {
    query: q,
    generatedAt: new Date().toISOString(),
    actorMatches,
    aliases,
    relatedTechniques,
    relatedMalwareFamilies,
    relatedCves,
    relatedIocs,
    relatedNews,
    relatedRansomwareGroups,
    relatedVictims,
    otxPulses,
    relationships: dedupedRelationships,
    confidenceSummary,
  }
}
