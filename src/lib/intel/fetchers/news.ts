// ================================================
// Intel Hub - RSS News Aggregator
// Sources: BleepingComputer, TheHackerNews, Krebs,
//          CISA, DarkReading, SecurityWeek, TheRecord, NakedSecurity
// ================================================
import { safeFetchText, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { NewsItem, NewsCategory } from "@/lib/intel/types"
import crypto from "crypto"

const RSS_SOURCES = [
  // --- Tier 1: Major cybersecurity news ---
  {
    key: "bleepingcomputer",
    label: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "hackernews",
    label: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "krebs",
    label: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "cisa",
    label: "CISA Advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "darkreading",
    label: "Dark Reading",
    url: "https://www.darkreading.com/rss_simple.asp",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "securityweek",
    label: "SecurityWeek",
    url: "https://feeds.feedburner.com/securityweek",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "therecord",
    label: "The Record",
    url: "https://therecord.media/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "nakedsecurity",
    label: "Naked Security",
    url: "https://nakedsecurity.sophos.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  // --- Tier 2: Additional free RSS feeds ---
  {
    key: "schneier",
    label: "Schneier on Security",
    url: "https://www.schneier.com/feed/atom/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "threatpost",
    label: "Threatpost",
    url: "https://threatpost.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "grahamcluley",
    label: "Graham Cluley",
    url: "https://grahamcluley.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "infosecmag",
    label: "Infosecurity Magazine",
    url: "https://www.infosecurity-magazine.com/rss/news/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "csoonline",
    label: "CSO Online",
    url: "https://www.csoonline.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "scmagazine",
    label: "SC Magazine",
    url: "https://www.scmagazine.com/feed",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "cyberscoop",
    label: "CyberScoop",
    url: "https://cyberscoop.com/feed/",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "securityaffairs",
    label: "Security Affairs",
    url: "https://securityaffairs.com/feed",
    defaultCategory: "breach" as NewsCategory,
  },
  {
    key: "tripwire",
    label: "Tripwire State of Security",
    url: "https://www.tripwire.com/state-of-security/feed",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "uscert",
    label: "US-CERT Alerts",
    url: "https://www.cisa.gov/uscert/ncas/alerts.xml",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "ncsc",
    label: "UK NCSC",
    url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "cert_eu",
    label: "CERT-EU",
    url: "https://cert.europa.eu/publications/security-advisories/rss",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "sans_isc",
    label: "SANS ISC",
    url: "https://isc.sans.edu/rssfeed.xml",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "packetstorm",
    label: "Packet Storm Security",
    url: "https://packetstormsecurity.com/feeds/",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "zdnet_security",
    label: "ZDNet Security",
    url: "https://www.zdnet.com/topic/security/rss.xml",
    defaultCategory: "general" as NewsCategory,
  },
  {
    key: "sentinelone",
    label: "SentinelOne Labs",
    url: "https://www.sentinelone.com/labs/feed/",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "talosintel",
    label: "Cisco Talos Blog",
    url: "https://blog.talosintelligence.com/feeds/posts/default",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "welivesecurity",
    label: "WeLiveSecurity (ESET)",
    url: "https://www.welivesecurity.com/feed/",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "securelist",
    label: "Securelist (Kaspersky)",
    url: "https://securelist.com/feed/",
    defaultCategory: "apt" as NewsCategory,
  },
  {
    key: "mandiant_blog",
    label: "Mandiant Blog",
    url: "https://www.mandiant.com/resources/blog/rss.xml",
    defaultCategory: "apt" as NewsCategory,
  },
  {
    key: "microsoft_security",
    label: "Microsoft Security Blog",
    url: "https://www.microsoft.com/en-us/security/blog/feed/",
    defaultCategory: "vulnerability" as NewsCategory,
  },
  {
    key: "google_tag",
    label: "Google TAG",
    url: "https://blog.google/threat-analysis-group/rss/",
    defaultCategory: "apt" as NewsCategory,
  },
  {
    key: "unit42",
    label: "Unit 42 (Palo Alto)",
    url: "https://unit42.paloaltonetworks.com/feed/",
    defaultCategory: "apt" as NewsCategory,
  },
  {
    key: "proofpoint",
    label: "Proofpoint Threat Insight",
    url: "https://www.proofpoint.com/us/blog/threat-insight/feed",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "crowdstrike_blog",
    label: "CrowdStrike Blog",
    url: "https://www.crowdstrike.com/blog/feed/",
    defaultCategory: "apt" as NewsCategory,
  },
  {
    key: "elastic_security",
    label: "Elastic Security Labs",
    url: "https://www.elastic.co/security-labs/rss/feed.xml",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "trendmicro",
    label: "Trend Micro Research",
    url: "https://www.trendmicro.com/en_us/research.html/rss.xml",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "checkpoint",
    label: "Check Point Research",
    url: "https://research.checkpoint.com/feed/",
    defaultCategory: "malware" as NewsCategory,
  },
  {
    key: "zscaler",
    label: "Zscaler ThreatLabz",
    url: "https://www.zscaler.com/blogs/security-research/rss",
    defaultCategory: "malware" as NewsCategory,
  },
]

// ---- XML helpers ----
function extractTag(xml: string, tag: string): string {
  // CDATA-aware extraction
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, "i")
  const cdataMatch = xml.match(cdata)
  if (cdataMatch) return cdataMatch[1].trim()

  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i")
  const plainMatch = xml.match(plain)
  if (plainMatch) return plainMatch[1].trim()

  return ""
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i")
  const m = xml.match(re)
  return m ? m[1] : ""
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function guessCategory(title: string, desc: string): NewsCategory {
  const text = `${title} ${desc}`.toLowerCase()
  if (/ransomware|ransom/.test(text)) return "ransomware"
  if (/apt|advanced persistent|nation[- ]state|nation.state|state.sponsored/.test(text)) return "nation-state"
  if (/vulnerability|cve-|exploit|patch|zero.?day/.test(text)) return "vulnerability"
  if (/breach|data leak|stolen|credential/.test(text)) return "breach"
  if (/malware|trojan|botnet|worm|spyware|adware|backdoor/.test(text)) return "malware"
  if (/spy|espionage|intelligence|government|military/.test(text)) return "apt"
  return "general"
}

function parseRSS(xml: string, source: typeof RSS_SOURCES[0]): NewsItem[] {
  const items: NewsItem[] = []

  // Try RSS 2.0 first
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || []

  for (const block of itemBlocks.slice(0, 30)) {
    const title = stripHtml(extractTag(block, "title"))
    const link =
      extractTag(block, "link") ||
      extractAttr(block, "link", "href") ||
      ""
    const description = stripHtml(extractTag(block, "description") || extractTag(block, "summary"))
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "dc:date") || ""
    const author =
      extractTag(block, "dc:creator") ||
      extractTag(block, "author") ||
      extractTag(block, "name") ||
      ""
    const imageUrl =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "enclosure", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      ""

    if (!title || !link) continue

    const guid = crypto.createHash("md5").update(`${source.key}:${link}`).digest("hex")
    const category = guessCategory(title, description)

    items.push({
      id: guid,
      guid,
      title,
      description: description.slice(0, 500),
      url: link,
      source: source.key,
      sourceLabel: source.label,
      category,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      imageUrl: imageUrl || undefined,
      author: author || undefined,
    })
  }

  // Try Atom feed if no RSS items found
  if (items.length === 0) {
    const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
    for (const block of entryBlocks.slice(0, 30)) {
      const title = stripHtml(extractTag(block, "title"))
      const link = extractAttr(block, "link", "href") || extractTag(block, "id")
      const summary = stripHtml(extractTag(block, "summary") || extractTag(block, "content"))
      const published = extractTag(block, "published") || extractTag(block, "updated")
      const author = extractTag(block, "name")

      if (!title || !link) continue

      const guid = crypto.createHash("md5").update(`${source.key}:${link}`).digest("hex")
      items.push({
        id: guid,
        guid,
        title,
        description: summary.slice(0, 500),
        url: link,
        source: source.key,
        sourceLabel: source.label,
        category: guessCategory(title, summary),
        publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
        author: author || undefined,
      })
    }
  }

  return items
}

// ---- Store to DB ----
async function storeNewsItems(items: NewsItem[]): Promise<number> {
  let stored = 0
  for (const item of items) {
    try {
      const result = await query(
        `INSERT INTO intel_news_cache
           (guid, title, description, url, source, source_label, category, published_at, image_url, author)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (guid) DO NOTHING`,
        [
          item.guid,
          item.title,
          item.description,
          item.url,
          item.source,
          item.sourceLabel,
          item.category,
          item.publishedAt,
          item.imageUrl || null,
          item.author || null,
        ],
      )
      if (result.success) stored++
    } catch {
      // Skip individual failures
    }
  }
  return stored
}

// ---- Fetch from DB ----
export async function getNewsFromDb(limit = 50, category?: string): Promise<NewsItem[]> {
  const catFilter = category && category !== "all" ? "AND category = $2" : ""
  const params: (string | number)[] = [limit]
  if (category && category !== "all") params.push(category)

  const result = await query(
    `SELECT guid, title, description, url, source, source_label, category,
            published_at, image_url, author
     FROM intel_news_cache
     WHERE published_at > NOW() - INTERVAL '7 days'
     ${catFilter}
     ORDER BY published_at DESC
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    id: row.guid as string,
    guid: row.guid as string,
    title: row.title as string,
    description: row.description as string,
    url: row.url as string,
    source: row.source as string,
    sourceLabel: row.source_label as string,
    category: (row.category as NewsCategory) || "general",
    publishedAt: (row.published_at as Date).toISOString(),
    imageUrl: row.image_url as string | undefined,
    author: row.author as string | undefined,
  }))
}

// ---- Main fetch + sync ----
export async function fetchAndSyncNews(): Promise<{ fetched: number; stored: number }> {
  const allItems: NewsItem[] = []

  await Promise.allSettled(
    RSS_SOURCES.map(async (source) => {
      const xml = await safeFetchText(source.url, {
        headers: { "User-Agent": "IntelForge/1.0 CTI RSS Reader" },
      })
      if (!xml) return
      const items = parseRSS(xml, source)
      allItems.push(...items)
    }),
  )

  // Deduplicate by guid
  const seen = new Set<string>()
  const unique = allItems.filter((item) => {
    if (seen.has(item.guid)) return false
    seen.add(item.guid)
    return true
  })

  const stored = await storeNewsItems(unique)

  // Update memory cache
  const cached = await getNewsFromDb(100)
  memSet("intel:news:all", cached, TTL.NEWS)

  return { fetched: allItems.length, stored }
}

// ---- Public API ----
export async function getNews(limit = 50, category?: string): Promise<NewsItem[]> {
  const cacheKey = `intel:news:${category || "all"}:${limit}`
  const cached = memGet<NewsItem[]>(cacheKey)
  if (cached) return cached

  const items = await getNewsFromDb(limit, category)

  // If DB is empty, trigger a live fetch
  if (items.length === 0) {
    await fetchAndSyncNews()
    const fresh = await getNewsFromDb(limit, category)
    memSet(cacheKey, fresh, TTL.NEWS)
    return fresh
  }

  memSet(cacheKey, items, TTL.NEWS)
  return items
}
