// ================================================
// Intel Hub - Dark Web Leak Site Monitor
// Safe allowlisted collection for defensive OSINT only
// ================================================
import { safeFetchJson, memGet, memSet } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { DarknetPost } from "@/lib/intel/types"
import { getGroups, getVictims } from "@/lib/intel/fetchers/ransomware"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join, basename } from "path"

const RANSOMWIKI_API = "https://api.ransomware.live/v2"

function cleanText(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join("; ")
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${cleanText(v)}`)
      .join("; ")
  }
  return String(value)
}

function hashPostUid(source: string, title: string, content: string, url?: string) {
  return `darknet:${Buffer.from([source, title, content, url || ""].join("|")).toString("base64").slice(0, 48)}`
}

async function fetchRegisteredSources(): Promise<Array<Record<string, any>>> {
  const result = await query(
    `SELECT source_key, source_name, onion_url, source_type, enabled, reliability_score
     FROM intel_darknet_sources
     WHERE enabled = true
     ORDER BY updated_at DESC, created_at DESC`,
    [],
  )
  return result.success && Array.isArray(result.data) ? result.data : []
}

function determineSeverity(sector?: string, victimName?: string): string {
  const criticalSectors = ["government", "healthcare", "energy", "finance", "defense", "critical-infrastructure"]
  const highSectors = ["technology", "telecommunications", "education", "manufacturing"]
  const name = (sector || victimName || "").toLowerCase()

  if (criticalSectors.some((s) => name.includes(s))) return "critical"
  if (highSectors.some((s) => name.includes(s))) return "high"
  return "medium"
}

function detectLeakType(entry: Record<string, unknown>): string {
  if (entry.published === false) return "ransom_note"
  if (entry.screenshot) return "data_leak"
  return "general"
}

async function fetchRansomwarePosts(): Promise<DarknetPost[]> {
  try {
    const [groups, victims] = await Promise.all([
      getGroups(),
      getVictims(30, 200),
    ])

    const groupMap = new Map(groups.map((g) => [g.name.toLowerCase(), g]))
    const posts: DarknetPost[] = []

    for (const v of victims) {
      const groupName = v.groupName || "Unknown"
      const content = cleanText(v.description || `Victim: ${v.victimName}${v.sector ? ` | Sector: ${v.sector}` : ""}${v.country ? ` | Country: ${v.country}` : ""}`)
      const postUid = hashPostUid(groupName, v.victimName, content, v.url)

      posts.push({
        postUid,
        source: groupName,
        sourceType: "ransomware_blog",
        title: `${groupName} claims ${v.victimName}`,
        content,
        url: v.url,
        threatActor: groupName,
        victimName: v.victimName,
        victimSector: v.sector,
        victimCountry: v.country,
        leakType: "ransom_note",
        severity: determineSeverity(v.sector, v.victimName),
        tags: [groupName, "ransomware", "data-leak", v.sector || "unknown"].filter(Boolean) as string[],
        discoveredAt: v.discoveredAt || new Date().toISOString(),
      })
    }

    return posts
  } catch {
    return []
  }
}

async function fetchDarknetForumPosts(): Promise<DarknetPost[]> {
  const feedUrl = `${RANSOMWIKI_API}/recentvictims`
  const data = await safeFetchJson<Record<string, unknown>[]>(feedUrl, {
    headers: { "User-Agent": "IntelForge/1.0" },
  })

  if (!data || !Array.isArray(data)) return []

  return data.slice(0, 100).map((entry) => {
    const groupName = cleanText((entry.group_name as string) || (entry.group as string) || "Unknown")
    const victim = cleanText((entry.post as string) || (entry.victim as string) || "Unknown")
    const content = cleanText((entry.description as string) || `${groupName} targeting ${victim}`)
    const postUid = hashPostUid(groupName, victim, content, entry.url as string | undefined)

    return {
      postUid,
      source: groupName,
      sourceType: "ransomware_blog",
      title: `${groupName} - ${victim}`,
      content,
      url: (entry.url as string) || undefined,
      threatActor: groupName,
      victimName: victim,
      victimSector: (entry.activity as string) || (entry.industry as string) || (entry.sector as string),
      victimCountry: (entry.country as string),
      leakType: detectLeakType(entry),
      severity: determineSeverity(
        (entry.activity as string) || (entry.industry as string) || (entry.sector as string),
        victim,
      ),
      tags: [groupName, "ransomware", (entry.activity as string) || (entry.industry as string) || "unknown-sector"].filter(Boolean) as string[],
      discoveredAt: (entry.discovered as string) || new Date().toISOString(),
    }
  })
}

// ---- Telegram scraper messages (from scrapers/telegram-scraper/) ----

async function fetchTelegramPosts(): Promise<DarknetPost[]> {
  // Telegram scraper saves messages as /data/telegram-{chat_id}-{timestamp}-{msg_id}.txt
  const dataDirs = ["/data", join(process.cwd(), "data"), join(process.cwd(), "..", "data")]
  let dataDir = ""
  for (const d of dataDirs) {
    if (existsSync(d)) { dataDir = d; break }
  }
  if (!dataDir) return []

  try {
    const files = readdirSync(dataDir).filter((f) => f.startsWith("telegram-") && f.endsWith(".txt"))
    if (files.length === 0) return []

    const posts: DarknetPost[] = []
    const seenUids = new Set<string>()

    for (const file of files.slice(0, 200)) {
      try {
        const content = readFileSync(join(dataDir, file), "utf-8").trim()
        if (!content) continue

        // Parse filename: telegram-{chat_id}-{timestamp}-{msg_id}.txt
        const parts = file.replace(".txt", "").split("-")
        if (parts.length < 4) continue

        const chatId = parts[1]
        const msgId = parts[parts.length - 1]
        const postUid = `telegram:${chatId}:${msgId}`

        if (seenUids.has(postUid)) continue
        seenUids.add(postUid)

        // Extract potential IOCs and threat info from message content
        const contentLower = content.toLowerCase()
        const isRansomware = /ransom|lockbit|alphv|clop|conti|hive|blackcat|royal/i.test(contentLower)
        const isDataLeak = /leak|data breach|exposed|stolen|dump/i.test(contentLower)

        let threatActor: string | undefined
        const actorMatch = content.match(/(LockBit|ALPHV|Clop|Conti|Hive|BlackCat|Royal|Babuk|Ragnar)/i)
        if (actorMatch) threatActor = actorMatch[1]

        let victimName: string | undefined
        const victimMatch = content.match(/^(.{3,80})$/m)
        if (victimMatch) victimName = victimMatch[1].trim()

        posts.push({
          postUid,
          source: `telegram:${chatId}`,
          sourceType: "telegram",
          title: `Telegram message from chat ${chatId}`,
          content,
          url: undefined,
          threatActor,
          victimName,
          victimSector: undefined,
          victimCountry: undefined,
          leakType: isRansomware ? "ransom_note" : isDataLeak ? "data_leak" : "general",
          severity: isRansomware ? "high" : isDataLeak ? "medium" : "low",
          tags: ["telegram", `chat:${chatId}`, isRansomware ? "ransomware" : "general-chat"].filter(Boolean) as string[],
          discoveredAt: new Date().toISOString(),
        })
      } catch {
        // Skip unreadable files
      }
    }
    return posts
  } catch {
    return []
  }
}

// ---- Forum threads (from scrapers/services/forum_monitor/) ----

async function fetchForumPosts(): Promise<DarknetPost[]> {
  try {
    const result = await query(
      `SELECT thread_id, forum_name, forum_type, title, link, author,
              published_date, content
       FROM forum_threads
       WHERE published_date IS NOT NULL
         AND published_date > NOW() - INTERVAL '30 days'
       ORDER BY published_date DESC
       LIMIT 200`,
      [],
    )
    if (!result.success || !Array.isArray(result.data)) return []

    return result.data.map((row: Record<string, unknown>) => {
      const forumName = String(row.forum_name || "unknown")
      const title = String(row.title || "Untitled")
      const content = String(row.content || "")
      const link = String(row.link || "")
      const author = String(row.author || "anonymous")
      const postUid = hashPostUid(forumName, title, content, link)

      const contentLower = (title + " " + content).toLowerCase()
      const isRansomware = /ransom|lockbit|alphv|leak|breach|stolen/i.test(contentLower)
      const isExploit = /exploit|0day| payload|cve-\d{4}/i.test(contentLower)

      return {
        postUid,
        source: forumName,
        sourceType: "forum",
        title,
        content: content || undefined,
        url: link || undefined,
        author,
        threatActor: undefined,
        victimName: undefined,
        victimSector: undefined,
        victimCountry: undefined,
        leakType: isRansomware ? "data_leak" : isExploit ? "exploit" : "general",
        severity: isRansomware ? "high" : isExploit ? "medium" : "low",
        tags: ["forum", forumName, isRansomware ? "ransomware" : "general-forum"].filter(Boolean) as string[],
        discoveredAt: String(row.published_date || new Date().toISOString()),
      }
    })
  } catch {
    return []
  }
}

// ---- Ahmia scraped onions (from scrapers/services/ahmia_scraper/) ----

async function fetchAhmiaOnions(): Promise<DarknetPost[]> {
  try {
    const result = await query(
      `SELECT onion_url, domain, title, description, query_used, last_seen, scrape_count
       FROM ahmia_scraped_onions
       WHERE last_seen > NOW() - INTERVAL '30 days'
       ORDER BY scrape_count DESC, last_seen DESC
       LIMIT 200`,
      [],
    )
    if (!result.success || !Array.isArray(result.data)) return []

    return result.data.map((row: Record<string, unknown>) => {
      const url = String(row.onion_url || "")
      const domain = String(row.domain || "")
      const title = String(row.title || `Onion site: ${domain}`)
      const queryUsed = String(row.query_used || "")
      const postUid = hashPostUid("ahmia", domain, title, url)

      return {
        postUid,
        source: "ahmia",
        sourceType: "ahmia_search",
        title: title || `Onion: ${domain}`,
        content: String(row.description || `Discovered via Ahmia search for: ${queryUsed}`),
        url,
        threatActor: undefined,
        victimName: undefined,
        victimSector: undefined,
        victimCountry: undefined,
        leakType: "general",
        severity: "medium",
        tags: ["ahmia", "onion-index", `query:${queryUsed}`].filter(Boolean) as string[],
        discoveredAt: String(row.last_seen || new Date().toISOString()),
      }
    })
  } catch {
    return []
  }
}

async function fetchRegisteredSourcePosts(): Promise<DarknetPost[]> {
  const sources = await fetchRegisteredSources()
  const posts: DarknetPost[] = []

  for (const source of sources) {
    const title = cleanText(source.source_name || source.source_key)
    const content = cleanText(`Approved dark web source: ${source.source_type}. Manual collection only.`)
    posts.push({
      postUid: hashPostUid(String(source.source_key), title, content, String(source.onion_url || "")),
      source: title,
      sourceType: String(source.source_type || "forum_public"),
      title,
      content,
      url: String(source.onion_url || ""),
      threatActor: undefined,
      victimName: undefined,
      victimSector: undefined,
      victimCountry: undefined,
      leakType: "general",
      severity: "medium",
      tags: ["darkweb", String(source.source_type || "forum_public")],
      discoveredAt: new Date().toISOString(),
    })
  }

  return posts
}

async function storeDarknetPosts(posts: DarknetPost[]): Promise<number> {
  let stored = 0
  for (const p of posts) {
    const result = await query(
      `INSERT INTO intel_darknet_posts
         (post_uid, source, source_type, title, content, url, author,
          threat_actor, victim_name, victim_sector, victim_country,
          leak_type, severity, tags, discovered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (post_uid) DO UPDATE SET
         content=EXCLUDED.content, severity=EXCLUDED.severity,
         fetched_at=NOW()`,
      [
        p.postUid, p.source, p.sourceType || null, p.title || null,
        p.content || null, p.url || null, p.author || null,
        p.threatActor || null, p.victimName || null, p.victimSector || null,
        p.victimCountry || null, p.leakType || null, p.severity || null,
        p.tags || null, p.discoveredAt,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

export async function getDarknetPostsFromDb(
  limit = 50,
  severity?: string,
  threatActor?: string,
): Promise<DarknetPost[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (severity && severity !== "all") {
    params.push(severity)
    conditions.push(`severity = $${params.length}`)
  }
  if (threatActor) {
    params.push(threatActor)
    conditions.push(`threat_actor = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT post_uid, source, source_type, title, content, url, author,
            threat_actor, victim_name, victim_sector, victim_country,
            leak_type, severity, tags, discovered_at
     FROM intel_darknet_posts
     ${where}
     ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       discovered_at DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    postUid: row.post_uid as string,
    source: row.source as string,
    sourceType: row.source_type as string | undefined,
    title: row.title as string | undefined,
    content: row.content as string | undefined,
    url: row.url as string | undefined,
    author: row.author as string | undefined,
    threatActor: row.threat_actor as string | undefined,
    victimName: row.victim_name as string | undefined,
    victimSector: row.victim_sector as string | undefined,
    victimCountry: row.victim_country as string | undefined,
    leakType: row.leak_type as string | undefined,
    severity: row.severity as string | undefined,
    tags: row.tags as string[] | undefined,
    discoveredAt: String(row.discovered_at || ""),
  }))
}

export async function getDarknetStats(): Promise<{
  totalPosts: number
  criticalLeaks: number
  activeGroups: number
  topSectors: { sector: string; count: number }[]
  recent24h: number
  ahmiaOnions: number
  telegramPosts: number
  forumPosts: number
}> {
  const results = await Promise.all([
    query(`SELECT COUNT(*) as c FROM intel_darknet_posts`, []),
    query(`SELECT COUNT(*) as c FROM intel_darknet_posts WHERE severity='critical'`, []),
    query(`SELECT COUNT(DISTINCT threat_actor) as c FROM intel_darknet_posts WHERE threat_actor IS NOT NULL`, []),
    query(
      `SELECT victim_sector as sector, COUNT(*) as count FROM intel_darknet_posts
       WHERE victim_sector IS NOT NULL
       GROUP BY victim_sector ORDER BY count DESC LIMIT 8`,
      [],
    ),
    query(`SELECT COUNT(*) as c FROM intel_darknet_posts WHERE discovered_at > NOW() - INTERVAL '24 hours'`, []),
    query(`SELECT COUNT(*) as c FROM ahmia_scraped_onions WHERE last_seen > NOW() - INTERVAL '30 days'`, []),
    query(`SELECT COUNT(*) as c FROM intel_darknet_posts WHERE source_type='telegram'`, []),
    query(
      `SELECT COUNT(*) as c FROM forum_threads WHERE published_date > NOW() - INTERVAL '30 days'`,
      [],
    ),
  ])

  return {
    totalPosts: Number(results[0].data?.[0]?.c) || 0,
    criticalLeaks: Number(results[1].data?.[0]?.c) || 0,
    activeGroups: Number(results[2].data?.[0]?.c) || 0,
    topSectors: (results[3].data || []).map((r: Record<string, unknown>) => ({
      sector: String(r.sector), count: Number(r.count),
    })),
    recent24h: Number(results[4].data?.[0]?.c) || 0,
    ahmiaOnions: Number(results[5].data?.[0]?.c) || 0,
    telegramPosts: Number(results[6].data?.[0]?.c) || 0,
    forumPosts: Number(results[7].data?.[0]?.c) || 0,
  }
}

export async function fetchAndSyncDarknet(): Promise<{ fetched: number; stored: number }> {
  const [ransomwarePosts, darknetForumPosts, registeredPosts, ahmiaOnions, telegramPosts, forumPosts] = await Promise.all([
    fetchRansomwarePosts(),
    fetchDarknetForumPosts(),
    fetchRegisteredSourcePosts(),
    fetchAhmiaOnions(),
    fetchTelegramPosts(),
    fetchForumPosts(),
  ])

  const all = [...ransomwarePosts, ...darknetForumPosts, ...registeredPosts, ...ahmiaOnions, ...telegramPosts, ...forumPosts]
  const stored = await storeDarknetPosts(all)

  const fresh = await getDarknetPostsFromDb(100)
  memSet("intel:darknet:all", fresh, 60 * 60)

  return { fetched: all.length, stored }
}

export async function getDarknetPosts(
  limit = 50,
  severity?: string,
  threatActor?: string,
): Promise<DarknetPost[]> {
  const cacheKey = `intel:darknet:${severity || "all"}:${threatActor || "all"}:${limit}`
  const cached = memGet<DarknetPost[]>(cacheKey)
  if (cached) return cached

  let posts = await getDarknetPostsFromDb(limit, severity, threatActor)
  if (posts.length === 0) {
    await fetchAndSyncDarknet()
    posts = await getDarknetPostsFromDb(limit, severity, threatActor)
  }

  memSet(cacheKey, posts, 60 * 60)
  return posts
}

