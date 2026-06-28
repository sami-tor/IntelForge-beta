// ================================================
// Intel Hub - Vendor Threat Research Blog Aggregator
// Sources: 10 additional vendor research RSS feeds
// (beyond what's already in news.ts)
// ================================================
import { safeFetchText } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import crypto from "crypto"

const VENDOR_FEEDS = [
  { key: "fortinet", label: "Fortinet FortiGuard", url: "https://www.fortinet.com/blog/threat-research.xml" },
  { key: "sophos_xops", label: "Sophos X-Ops", url: "https://news.sophos.com/en-us/category/threat-research/feed/" },
  { key: "volexity", label: "Volexity", url: "https://www.volexity.com/blog/feed/" },
  { key: "reversinglabs", label: "ReversingLabs", url: "https://blog.reversinglabs.com/blog/rss.xml" },
  { key: "huntress", label: "Huntress", url: "https://www.huntress.com/blog/rss.xml" },
  { key: "rapid7", label: "Rapid7 Blog", url: "https://blog.rapid7.com/rss/" },
  { key: "qualys", label: "Qualys Threat Research", url: "https://blog.qualys.com/feed" },
  { key: "dragos", label: "Dragos (ICS/OT)", url: "https://www.dragos.com/blog/feed/" },
  { key: "flashpoint", label: "Flashpoint", url: "https://flashpoint.io/blog/feed/" },
  { key: "recorded_future", label: "Recorded Future Blog", url: "https://www.recordedfuture.com/feed" },
]

function extractTag(xml: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")
  const cdataMatch = xml.match(cdata)
  if (cdataMatch) return cdataMatch[1].trim()
  const plain = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i")
  const plainMatch = xml.match(plain)
  return plainMatch ? plainMatch[1].trim() : ""
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i")
  const m = xml.match(re)
  return m ? m[1] : ""
}

export async function fetchAndSyncVendorBlogs(): Promise<{ fetched: number; stored: number }> {
  let totalFetched = 0
  let totalStored = 0

  for (const feed of VENDOR_FEEDS) {
    try {
      const xml = await safeFetchText(feed.url, {
        headers: { "User-Agent": "IntelForge/1.0 Threat Research Monitor" },
      })
      if (!xml) continue

      const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
      totalFetched += items.length

      for (const block of items.slice(0, 20)) {
        const title = extractTag(block, "title").replace(/<[^>]*>/g, "").trim()
        const link = extractTag(block, "link") || extractAttr(block, "link", "href") || ""
        const description = extractTag(block, "description") || extractTag(block, "summary") || ""
        const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || ""

        if (!title || !link) continue

        const guid = crypto.createHash("md5").update(`${feed.key}:${link}`).digest("hex")
        const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()

        // Categorise based on keywords
        const text = `${title} ${description}`.toLowerCase()
        let category = "general"
        if (/ransomware|ransom/.test(text)) category = "ransomware"
        else if (/apt|nation.state|espionage/.test(text)) category = "apt"
        else if (/vulnerability|cve-|patch|zero.?day/.test(text)) category = "vulnerability"
        else if (/malware|trojan|botnet|backdoor/.test(text)) category = "malware"
        else if (/breach|data leak|stolen/.test(text)) category = "breach"

        const result = await query(
          `INSERT INTO intel_news_cache
             (guid, title, description, url, source, source_label, category, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (guid) DO NOTHING`,
          [guid, title.slice(0, 500), description.replace(/<[^>]*>/g, "").slice(0, 500), link, feed.key, feed.label, category, publishedAt],
        )
        if (result.success) totalStored++
      }
    } catch {
      // Skip failed feeds
    }
  }

  return { fetched: totalFetched, stored: totalStored }
}
