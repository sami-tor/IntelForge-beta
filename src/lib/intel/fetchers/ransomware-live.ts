// ================================================
// Intel Hub - Ransomware Live Tracking
// Sources: ransomware.live API + ransomwatch
// Free, no API key required.
// ================================================
import { safeFetchJson } from "@/lib/intel/cache"
import { query } from "@/lib/db"

const RANSOMWARE_LIVE_URL = "https://api.ransomware.live/recentvictims"
const RANSOMWATCH_URL = "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json"

interface RansomwareLiveVictim {
  group_name?: string
  victim?: string
  country?: string
  activity?: string
  discovered?: string
  description?: string
}

export async function fetchAndSyncRansomwareLive(): Promise<{ fetched: number; stored: number }> {
  let totalFetched = 0
  let totalStored = 0

  // Source 1: ransomware.live
  try {
    const victims = await safeFetchJson<RansomwareLiveVictim[]>(RANSOMWARE_LIVE_URL, {
      headers: { "User-Agent": "IntelForge/1.0" },
    }, 20000)

    if (victims && Array.isArray(victims)) {
      totalFetched += victims.length
      for (const v of victims.slice(0, 200)) {
        if (!v.victim || !v.group_name) continue
        const result = await query(
          `INSERT INTO intel_ransomware_victims
             (victim_name, group_name, discovered_at, country, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            v.victim.slice(0, 300),
            v.group_name.toLowerCase().slice(0, 100),
            v.discovered ? new Date(v.discovered).toISOString() : new Date().toISOString(),
            v.country || null,
            v.description?.slice(0, 500) || null,
          ],
        )
        if (result.success) totalStored++
      }
    }
  } catch {
    // ransomware.live may be down
  }

  // Source 2: ransomwatch (GitHub JSON)
  try {
    const posts = await safeFetchJson<Array<{ group_name: string; post_title: string; discovered: string; description?: string }>>(
      RANSOMWATCH_URL,
      { headers: { "User-Agent": "IntelForge/1.0" } },
      30000,
    )

    if (posts && Array.isArray(posts)) {
      totalFetched += posts.length
      for (const p of posts.slice(-100)) { // last 100 entries
        if (!p.post_title || !p.group_name) continue
        const result = await query(
          `INSERT INTO intel_ransomware_victims
             (victim_name, group_name, discovered_at, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [
            p.post_title.slice(0, 300),
            p.group_name.toLowerCase().slice(0, 100),
            p.discovered ? new Date(p.discovered).toISOString() : new Date().toISOString(),
            p.description?.slice(0, 500) || null,
          ],
        )
        if (result.success) totalStored++
      }
    }
  } catch {
    // ransomwatch may be down
  }

  return { fetched: totalFetched, stored: totalStored }
}
