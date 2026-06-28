// ================================================
// IntelForge Automation - Geo + Sector Risk Index
// ------------------------------------------------
// Aggregates ransomware victims, phishing infra and
// dark-web posts per country/sector and computes a
// 0-100 risk score per dimension.
// ================================================
import { query } from "@/lib/db"

export interface GeoEntry {
  country: string
  countryCode: string | null
  ransomware: number
  phishing: number
  darknet: number
  total: number
  riskScore: number
}

export interface SectorEntry {
  sector: string
  ransomwareVictims: number
  phishingTargets: number
  darknetMentions: number
  cveRelevance: number
  total: number
  riskScore: number
}

function rankToScore(rank: number, total: number): number {
  if (total === 0) return 0
  // Top item gets near 100, lowest gets near 20
  const norm = (total - rank) / Math.max(1, total - 1)
  return Math.round(20 + norm * 80)
}

interface Row {
  k: string
  c: number
}

async function fetchGroupedCounts(sql: string): Promise<Row[]> {
  const r = await query(sql, [])
  if (!r.success) return []
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    k: String(row.k || "").trim(),
    c: Number(row.c) || 0,
  })).filter((row) => row.k.length > 0)
}

const COUNTRY_CODES: Record<string, string> = {
  "united states": "US", usa: "US", us: "US",
  "united kingdom": "GB", uk: "GB",
  germany: "DE", france: "FR", italy: "IT", spain: "ES",
  netherlands: "NL", belgium: "BE", sweden: "SE", norway: "NO", denmark: "DK",
  poland: "PL", "czech republic": "CZ", czechia: "CZ",
  canada: "CA", mexico: "MX", brazil: "BR", argentina: "AR", chile: "CL",
  australia: "AU", "new zealand": "NZ",
  japan: "JP", "south korea": "KR", korea: "KR", china: "CN", india: "IN",
  pakistan: "PK", bangladesh: "BD", indonesia: "ID", thailand: "TH",
  singapore: "SG", malaysia: "MY", philippines: "PH", vietnam: "VN",
  russia: "RU", ukraine: "UA", belarus: "BY",
  turkey: "TR", "saudi arabia": "SA", uae: "AE",
  israel: "IL", egypt: "EG", "south africa": "ZA", nigeria: "NG",
  ireland: "IE", switzerland: "CH", austria: "AT",
  finland: "FI", portugal: "PT", greece: "GR",
}

function toCode(country: string): string | null {
  const c = COUNTRY_CODES[country.toLowerCase().trim()]
  return c ?? null
}

/**
 * Compute today's geo + sector snapshots and persist them.
 */
export async function captureGeoAndSector(): Promise<{
  geo: GeoEntry[]
  sectors: SectorEntry[]
}> {
  // ---- Geo ----
  const [ransGeo, phishGeo, darknetGeo] = await Promise.all([
    fetchGroupedCounts(
      `SELECT country AS k, COUNT(*) AS c FROM intel_ransomware_victims
       WHERE country IS NOT NULL
         AND discovered_at > NOW() - INTERVAL '30 days'
       GROUP BY country`,
    ),
    fetchGroupedCounts(
      `SELECT country AS k, COUNT(*) AS c FROM intel_phishing_cache
       WHERE country IS NOT NULL AND active = true
       GROUP BY country`,
    ),
    fetchGroupedCounts(
      `SELECT victim_country AS k, COUNT(*) AS c FROM intel_darknet_posts
       WHERE victim_country IS NOT NULL
         AND discovered_at > NOW() - INTERVAL '30 days'
       GROUP BY victim_country`,
    ),
  ])

  const merged = new Map<string, { ransomware: number; phishing: number; darknet: number }>()
  const ensure = (k: string) => {
    const lower = k.toLowerCase()
    if (!merged.has(lower)) merged.set(lower, { ransomware: 0, phishing: 0, darknet: 0 })
    return merged.get(lower)!
  }
  for (const r of ransGeo) ensure(r.k).ransomware += r.c
  for (const p of phishGeo) ensure(p.k).phishing += p.c
  for (const d of darknetGeo) ensure(d.k).darknet += d.c

  const candidates = [...merged.entries()].map(([country, counts]) => {
    const total =
      counts.ransomware * 4 + counts.phishing * 1.5 + counts.darknet * 2.5
    return { country, ...counts, total }
  })
  candidates.sort((a, b) => b.total - a.total)

  const geoEntries: GeoEntry[] = candidates.slice(0, 50).map((entry, idx) => {
    const score = rankToScore(idx, candidates.length)
    return {
      country: entry.country.replace(/\b\w/g, (m) => m.toUpperCase()),
      countryCode: toCode(entry.country),
      ransomware: entry.ransomware,
      phishing: entry.phishing,
      darknet: entry.darknet,
      total: Math.round(entry.total),
      riskScore: score,
    }
  })

  for (const e of geoEntries) {
    await query(
      `INSERT INTO intel_geo_threat
         (country, country_code, bucket_date, ransomware_count, phishing_count, darknet_count, total_signals, risk_score)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7)
       ON CONFLICT (country, bucket_date) DO UPDATE SET
         country_code     = EXCLUDED.country_code,
         ransomware_count = EXCLUDED.ransomware_count,
         phishing_count   = EXCLUDED.phishing_count,
         darknet_count    = EXCLUDED.darknet_count,
         total_signals    = EXCLUDED.total_signals,
         risk_score       = EXCLUDED.risk_score,
         captured_at      = NOW()`,
      [
        e.country,
        e.countryCode,
        e.ransomware,
        e.phishing,
        e.darknet,
        e.total,
        e.riskScore,
      ],
    )
  }

  // ---- Sector ----
  const [ransSector, phishSector, darknetSector] = await Promise.all([
    fetchGroupedCounts(
      `SELECT sector AS k, COUNT(*) AS c FROM intel_ransomware_victims
       WHERE sector IS NOT NULL
         AND discovered_at > NOW() - INTERVAL '60 days'
       GROUP BY sector`,
    ),
    fetchGroupedCounts(
      `SELECT target_brand AS k, COUNT(*) AS c FROM intel_phishing_cache
       WHERE target_brand IS NOT NULL AND active = true
       GROUP BY target_brand`,
    ),
    fetchGroupedCounts(
      `SELECT victim_sector AS k, COUNT(*) AS c FROM intel_darknet_posts
       WHERE victim_sector IS NOT NULL
         AND discovered_at > NOW() - INTERVAL '60 days'
       GROUP BY victim_sector`,
    ),
  ])

  const sectorMap = new Map<
    string,
    { ransomware: number; phishing: number; darknet: number }
  >()
  const ensureSector = (k: string) => {
    const lower = k.toLowerCase()
    if (!sectorMap.has(lower))
      sectorMap.set(lower, { ransomware: 0, phishing: 0, darknet: 0 })
    return sectorMap.get(lower)!
  }
  for (const r of ransSector) ensureSector(r.k).ransomware += r.c
  for (const p of phishSector) ensureSector(p.k).phishing += p.c
  for (const d of darknetSector) ensureSector(d.k).darknet += d.c

  const sectorCandidates = [...sectorMap.entries()].map(([sector, c]) => {
    const total = c.ransomware * 4 + c.phishing * 1.2 + c.darknet * 2.5
    return { sector, ...c, total }
  })
  sectorCandidates.sort((a, b) => b.total - a.total)

  const sectorEntries: SectorEntry[] = sectorCandidates.slice(0, 25).map((entry, idx) => {
    const score = rankToScore(idx, sectorCandidates.length)
    return {
      sector: entry.sector.replace(/\b\w/g, (m) => m.toUpperCase()),
      ransomwareVictims: entry.ransomware,
      phishingTargets: entry.phishing,
      darknetMentions: entry.darknet,
      cveRelevance: 0,
      total: Math.round(entry.total),
      riskScore: score,
    }
  })

  for (const s of sectorEntries) {
    await query(
      `INSERT INTO intel_sector_risk
         (sector, bucket_date, ransomware_victims, phishing_targets, darknet_mentions, cve_relevance, risk_score)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
       ON CONFLICT (sector, bucket_date) DO UPDATE SET
         ransomware_victims = EXCLUDED.ransomware_victims,
         phishing_targets   = EXCLUDED.phishing_targets,
         darknet_mentions   = EXCLUDED.darknet_mentions,
         cve_relevance      = EXCLUDED.cve_relevance,
         risk_score         = EXCLUDED.risk_score,
         captured_at        = NOW()`,
      [
        s.sector,
        s.ransomwareVictims,
        s.phishingTargets,
        s.darknetMentions,
        s.cveRelevance,
        s.riskScore,
      ],
    )
  }

  return { geo: geoEntries, sectors: sectorEntries }
}

export async function getLatestGeoSnapshot(limit = 30): Promise<GeoEntry[]> {
  const r = await query(
    `SELECT country, country_code, ransomware_count, phishing_count, darknet_count, total_signals, risk_score
     FROM intel_geo_threat
     WHERE bucket_date = (SELECT MAX(bucket_date) FROM intel_geo_threat)
     ORDER BY risk_score DESC
     LIMIT $1`,
    [limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    country: String(row.country),
    countryCode: (row.country_code as string) || null,
    ransomware: Number(row.ransomware_count),
    phishing: Number(row.phishing_count),
    darknet: Number(row.darknet_count),
    total: Number(row.total_signals),
    riskScore: Number(row.risk_score),
  }))
}

export async function getLatestSectorSnapshot(limit = 20): Promise<SectorEntry[]> {
  const r = await query(
    `SELECT sector, ransomware_victims, phishing_targets, darknet_mentions, cve_relevance, risk_score
     FROM intel_sector_risk
     WHERE bucket_date = (SELECT MAX(bucket_date) FROM intel_sector_risk)
     ORDER BY risk_score DESC
     LIMIT $1`,
    [limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    sector: String(row.sector),
    ransomwareVictims: Number(row.ransomware_victims),
    phishingTargets: Number(row.phishing_targets),
    darknetMentions: Number(row.darknet_mentions),
    cveRelevance: Number(row.cve_relevance),
    total: 0,
    riskScore: Number(row.risk_score),
  }))
}
