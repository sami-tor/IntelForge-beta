// ================================================
// Intel Hub - Phishing Intelligence Feed
// Sources: OpenPhish (free), PhishTank (free, no auth)
// ================================================
import { safeFetchJson, safeFetchText, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { PhishingItem } from "@/lib/intel/types"

const OPENPHISH_URL = "https://openphish.com/feed.txt"
const PHISHTANK_URL = "https://data.phishtank.com/data/online-valid.json"

// ---- Fetch OpenPhish (URL list feed) ----
async function fetchOpenPhish(): Promise<PhishingItem[]> {
  const text = await safeFetchText(OPENPHISH_URL, {
    headers: { "User-Agent": "IntelForge/1.0" },
  })
  if (!text) return []

  const urls = text.split("\n").filter((l) => l.trim() && l.startsWith("http"))
  const now = new Date().toISOString()

  return urls.slice(0, 200).map((url) => {
    const trimmed = url.trim()
    const domain = extractDomain(trimmed)
    const phishId = `openphish:${Buffer.from(trimmed).toString("base64").slice(0, 40)}`
    return {
      phishId,
      url: trimmed,
      targetBrand: guessBrand(trimmed, domain),
      phishType: "credential_harvesting",
      active: true,
      verified: true,
      reportedAt: now,
      source: "openphish" as const,
      tags: ["phishing", "active"],
    }
  })
}

// ---- Fetch PhishTank (validated phish, JSON) ----
async function fetchPhishTank(): Promise<PhishingItem[]> {
  const data = await safeFetchJson<Record<string, unknown>[]>(PHISHTANK_URL, {
    headers: { "User-Agent": "IntelForge/1.0" },
  })
  if (!data || !Array.isArray(data)) return []

  return data.slice(0, 200).map((entry) => {
    const url = (entry.url as string) || ""
    const domain = extractDomain(url)
    const phishId = `phishtank:${entry.phish_id || entry.phishid_id || Buffer.from(url).toString("base64").slice(0, 40)}`
    const targetBrand = (entry.target as string) || guessBrand(url, domain)

    return {
      phishId: String(phishId),
      url,
      targetBrand,
      phishType: "credential_harvesting",
      verified: Boolean(entry.verified),
      active: (entry.online as string) === "yes" || Boolean(entry.online),
      reportedAt: (entry.submission_time as string) || (entry.created_at as string) || new Date().toISOString(),
      tags: ["phishing", "phishtank-verified"],
      source: "phishtank" as const,
    }
  })
}

// ---- Helpers ----
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch { return "" }
}

function guessBrand(_url: string, domain: string): string | undefined {
  const brandMap: Record<string, string> = {
    "paypal": "PayPal", "microsoft": "Microsoft", "google": "Google",
    "facebook": "Meta", "apple": "Apple", "amazon": "Amazon",
    "netflix": "Netflix", "dropbox": "Dropbox", "linkedin": "LinkedIn",
    "instagram": "Instagram", "twitter": "X/Twitter", "x.com": "X/Twitter",
    "whatsapp": "WhatsApp", "telegram": "Telegram", "discord": "Discord",
    "steam": "Steam", "spotify": "Spotify", "adobe": "Adobe",
    "dhl": "DHL", "fedex": "FedEx", "ups": "UPS", "usps": "USPS",
    "bankofamerica": "Bank of America", "chase": "Chase", "wellsfargo": "Wells Fargo",
    "citi": "Citibank", "hsbc": "HSBC", "barclays": "Barclays",
  }
  const lower = domain.toLowerCase()
  for (const [key, brand] of Object.entries(brandMap)) {
    if (lower.includes(key)) return brand
  }
  return undefined
}

// ---- Store to DB ----
async function storePhishing(items: PhishingItem[]): Promise<number> {
  let stored = 0
  for (const p of items) {
    const result = await query(
      `INSERT INTO intel_phishing_cache
         (phish_id, url, target_brand, phish_type, ip_address, country,
          verified, active, reported_at, tags, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (phish_id) DO UPDATE SET
         active=EXCLUDED.active,
         verified=EXCLUDED.verified,
         fetched_at=NOW()`,
      [
        p.phishId, p.url, p.targetBrand || null, p.phishType || null,
        p.ipAddress || null, p.country || null, p.verified, p.active,
        p.reportedAt, p.tags || null, p.source,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getPhishingFromDb(
  limit = 50,
  brand?: string,
  activeOnly = false,
): Promise<PhishingItem[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (brand) {
    params.push(`%${brand}%`)
    conditions.push(`target_brand ILIKE $${params.length}`)
  }
  if (activeOnly) {
    conditions.push(`active = true`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT phish_id, url, target_brand, phish_type, ip_address, asn, country,
            verified, active, reported_at, tags, source
     FROM intel_phishing_cache
     ${where}
     ORDER BY reported_at DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    phishId: row.phish_id as string,
    url: row.url as string,
    targetBrand: row.target_brand as string | undefined,
    phishType: row.phish_type as string | undefined,
    ipAddress: row.ip_address as string | undefined,
    asn: row.asn as string | undefined,
    country: row.country as string | undefined,
    verified: Boolean(row.verified),
    active: Boolean(row.active),
    reportedAt: String(row.reported_at || ""),
    tags: row.tags as string[] | undefined,
    source: row.source as "openphish" | "phishtank",
  }))
}

// ---- Stats ----
export async function getPhishingStats(): Promise<{
  totalActive: number
  topBrands: { brand: string; count: number }[]
  recent24h: number
}> {
  const [activeRes, brandsRes, recentRes] = await Promise.all([
    query(`SELECT COUNT(*) as c FROM intel_phishing_cache WHERE active = true`, []),
    query(
      `SELECT target_brand as brand, COUNT(*) as count FROM intel_phishing_cache
       WHERE active = true AND target_brand IS NOT NULL
       GROUP BY target_brand ORDER BY count DESC LIMIT 10`,
      [],
    ),
    query(`SELECT COUNT(*) as c FROM intel_phishing_cache WHERE reported_at > NOW() - INTERVAL '24 hours'`, []),
  ])

  return {
    totalActive: Number(activeRes.data?.[0]?.c) || 0,
    topBrands: (brandsRes.data || []).map((r: Record<string, unknown>) => ({
      brand: r.brand as string,
      count: Number(r.count),
    })),
    recent24h: Number(recentRes.data?.[0]?.c) || 0,
  }
}

// ---- Main sync ----
export async function fetchAndSyncPhishing(): Promise<{ fetched: number; stored: number }> {
  const [openphish, phishtank] = await Promise.all([
    fetchOpenPhish(),
    fetchPhishTank(),
  ])

  const all = [...openphish, ...phishtank]
  const stored = await storePhishing(all)

  const fresh = await getPhishingFromDb(100)
  memSet("intel:phishing:all", fresh, TTL.NEWS)

  return { fetched: all.length, stored }
}

// ---- Public API ----
export async function getPhishing(
  limit = 50,
  brand?: string,
  activeOnly = false,
): Promise<PhishingItem[]> {
  const cacheKey = `intel:phishing:${brand || "all"}:${activeOnly ? "active" : "all"}:${limit}`
  const cached = memGet<PhishingItem[]>(cacheKey)
  if (cached) return cached

  let items = await getPhishingFromDb(limit, brand, activeOnly)
  if (items.length === 0) {
    await fetchAndSyncPhishing()
    items = await getPhishingFromDb(limit, brand, activeOnly)
  }

  memSet(cacheKey, items, TTL.NEWS)
  return items
}
