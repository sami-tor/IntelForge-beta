// ================================================
// Intel Hub - Ransomware Feed
// Source: ransomware.live (free, no auth)
// API: https://api.ransomware.live/v2/
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { RansomwareGroup, RansomwareVictim, RansomwareStats } from "@/lib/intel/types"

const BASE = "https://api.ransomware.live/v2"

// ---- Ransomware.live API types ----
interface RLGroup {
  name: string
  description?: string
  "first-seen"?: string
  meta?: {
    active?: boolean
    locations?: string[]
    sectors?: string[]
    aliases?: string[]
  }
}

interface RLVictim {
  victim?: string
  post?: string
  group?: string
  group_name?: string
  discovered?: string
  country?: string
  industry?: string
  infostealer?: string
  description?: string
  screenshot?: string
  published?: boolean
  url?: string
}

// ---- Fetch from ransomware.live ----
async function fetchGroups(): Promise<RansomwareGroup[]> {
  const raw = await safeFetchJson<RLGroup[] | Record<string, RLGroup>>(
    `${BASE}/groups`,
    { headers: { "User-Agent": "IntelForge/1.0" } },
  )
  if (!raw) return []

  const items = Array.isArray(raw) ? raw : Object.values(raw)

  return items.map((g) => ({
    slug: g.name?.toLowerCase().replace(/\s+/g, "-") || "unknown",
    name: g.name || "Unknown",
    description: g.description,
    firstSeen: g["first-seen"],
    victimCount: 0,
    active: g.meta?.active !== false,
    locations: g.meta?.locations,
    sectors: g.meta?.sectors,
    aliases: g.meta?.aliases,
  }))
}

async function fetchRecentVictims(days = 30): Promise<RansomwareVictim[]> {
  // Try multiple endpoints that ransomware.live provides
  const endpoints = [
    `${BASE}/recentvictims`,
    `${BASE}/victims`,
  ]

  for (const endpoint of endpoints) {
    const raw = await safeFetchJson<RLVictim[]>(endpoint, {
      headers: { "User-Agent": "IntelForge/1.0" },
    })
    if (!raw || !Array.isArray(raw)) continue

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    return raw
      .filter((v) => {
        if (!v.discovered) return true
        return new Date(v.discovered) >= cutoff
      })
      .slice(0, 200)
      .map((v) => ({
        victimName: v.victim || v.post || "Unknown",
        url: v.url,
        groupName: v.group || v.group_name || "Unknown",
        discoveredAt: v.discovered,
        country: v.country,
        sector: v.industry || v.infostealer,
        description: v.description,
        screenshot: v.screenshot,
        published: v.published,
      }))
  }

  return []
}

// ---- Store to DB ----
async function storeGroups(groups: RansomwareGroup[]): Promise<void> {
  for (const g of groups) {
    await query(
      `INSERT INTO intel_ransomware_groups
         (slug, name, description, first_seen, active, locations, sectors, aliases, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name=EXCLUDED.name,
         description=EXCLUDED.description,
         active=EXCLUDED.active,
         locations=EXCLUDED.locations,
         sectors=EXCLUDED.sectors,
         aliases=EXCLUDED.aliases,
         updated_at=NOW()`,
      [
        g.slug,
        g.name,
        g.description || null,
        g.firstSeen || null,
        g.active,
        g.locations || null,
        g.sectors || null,
        g.aliases || null,
      ],
    )
  }
}

async function storeVictims(victims: RansomwareVictim[]): Promise<number> {
  let stored = 0
  for (const v of victims) {
    const result = await query(
      `INSERT INTO intel_ransomware_victims
         (victim_name, url, group_name, discovered_at, country, sector, description, screenshot, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [
        v.victimName,
        v.url || null,
        v.groupName,
        v.discoveredAt || null,
        v.country || null,
        v.sector || null,
        v.description || null,
        v.screenshot || null,
        v.published || false,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Compute victim counts ----
async function updateVictimCounts(): Promise<void> {
  await query(
    `UPDATE intel_ransomware_groups g
     SET victim_count = (
       SELECT COUNT(*) FROM intel_ransomware_victims v
       WHERE LOWER(v.group_name) = LOWER(g.name)
     )`,
    [],
  )
}

// ---- Read from DB ----
export async function getGroupsFromDb(): Promise<RansomwareGroup[]> {
  const result = await query(
    `SELECT slug, name, description, first_seen, victim_count, active, locations, sectors, aliases
     FROM intel_ransomware_groups
     ORDER BY victim_count DESC, name ASC
     LIMIT 100`,
    [],
  )
  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | undefined,
    firstSeen: row.first_seen ? String(row.first_seen) : undefined,
    victimCount: Number(row.victim_count) || 0,
    active: Boolean(row.active),
    locations: row.locations as string[] | undefined,
    sectors: row.sectors as string[] | undefined,
    aliases: row.aliases as string[] | undefined,
  }))
}

export async function getVictimsFromDb(days = 30, limit = 100): Promise<RansomwareVictim[]> {
  const result = await query(
    `SELECT victim_name, url, group_name, discovered_at, country, sector, description, screenshot, published
     FROM intel_ransomware_victims
     WHERE discovered_at > NOW() - ($1 || ' days')::INTERVAL
        OR discovered_at IS NULL
     ORDER BY discovered_at DESC NULLS LAST
     LIMIT $2`,
    [String(days), limit],
  )
  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    victimName: row.victim_name as string,
    url: row.url as string | undefined,
    groupName: row.group_name as string,
    discoveredAt: row.discovered_at ? (row.discovered_at as Date).toISOString() : undefined,
    country: row.country as string | undefined,
    sector: row.sector as string | undefined,
    description: row.description as string | undefined,
    screenshot: row.screenshot as string | undefined,
    published: Boolean(row.published),
  }))
}

export async function getRansomwareStatsFromDb(): Promise<RansomwareStats> {
  const [groupsRes, victims30dRes, victims7dRes, sectorsRes, countriesRes, topGroupsRes] =
    await Promise.all([
      query(`SELECT COUNT(*) as total, SUM(CASE WHEN active THEN 1 ELSE 0 END) as active FROM intel_ransomware_groups`, []),
      query(`SELECT COUNT(*) as c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '30 days'`, []),
      query(`SELECT COUNT(*) as c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '7 days'`, []),
      query(
        `SELECT sector, COUNT(*) as count FROM intel_ransomware_victims
         WHERE sector IS NOT NULL AND discovered_at > NOW() - INTERVAL '90 days'
         GROUP BY sector ORDER BY count DESC LIMIT 8`,
        [],
      ),
      query(
        `SELECT country, COUNT(*) as count FROM intel_ransomware_victims
         WHERE country IS NOT NULL AND discovered_at > NOW() - INTERVAL '90 days'
         GROUP BY country ORDER BY count DESC LIMIT 8`,
        [],
      ),
      query(
        `SELECT group_name as name, COUNT(*) as count FROM intel_ransomware_victims
         WHERE discovered_at > NOW() - INTERVAL '30 days'
         GROUP BY group_name ORDER BY count DESC LIMIT 8`,
        [],
      ),
    ])

  const groupData = groupsRes.data?.[0] || {}
  return {
    totalGroups: Number(groupData.total) || 0,
    activeGroups: Number(groupData.active) || 0,
    victimsLast30Days: Number(victims30dRes.data?.[0]?.c) || 0,
    victimsLast7Days: Number(victims7dRes.data?.[0]?.c) || 0,
    topSectors: (sectorsRes.data || []).map((r: Record<string, unknown>) => ({
      sector: r.sector as string,
      count: Number(r.count),
    })),
    topCountries: (countriesRes.data || []).map((r: Record<string, unknown>) => ({
      country: r.country as string,
      count: Number(r.count),
    })),
    topGroups: (topGroupsRes.data || []).map((r: Record<string, unknown>) => ({
      name: r.name as string,
      count: Number(r.count),
    })),
  }
}

// ---- Main sync ----
export async function fetchAndSyncRansomware(): Promise<{ fetched: number; stored: number }> {
  const [groups, victims] = await Promise.all([fetchGroups(), fetchRecentVictims(60)])
  if (groups.length > 0) await storeGroups(groups)
  const stored = await storeVictims(victims)
  await updateVictimCounts()
  return { fetched: groups.length + victims.length, stored }
}

// ---- Public API ----
export async function getGroups(): Promise<RansomwareGroup[]> {
  const cacheKey = "intel:ransomware:groups"
  const cached = memGet<RansomwareGroup[]>(cacheKey)
  if (cached) return cached

  let groups = await getGroupsFromDb()
  if (groups.length === 0) {
    await fetchAndSyncRansomware()
    groups = await getGroupsFromDb()
  }

  memSet(cacheKey, groups, TTL.RANSOMWARE)
  return groups
}

export async function getVictims(days = 30, limit = 100): Promise<RansomwareVictim[]> {
  const cacheKey = `intel:ransomware:victims:${days}:${limit}`
  const cached = memGet<RansomwareVictim[]>(cacheKey)
  if (cached) return cached

  let victims = await getVictimsFromDb(days, limit)
  if (victims.length === 0) {
    await fetchAndSyncRansomware()
    victims = await getVictimsFromDb(days, limit)
  }

  memSet(cacheKey, victims, TTL.RANSOMWARE)
  return victims
}

export async function getRansomwareStats(): Promise<RansomwareStats> {
  const cacheKey = "intel:ransomware:stats"
  const cached = memGet<RansomwareStats>(cacheKey)
  if (cached) return cached

  const stats = await getRansomwareStatsFromDb()
  memSet(cacheKey, stats, TTL.RANSOMWARE)
  return stats
}
