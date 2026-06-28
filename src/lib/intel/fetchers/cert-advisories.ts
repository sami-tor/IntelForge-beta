// ================================================
// Intel Hub - Government CERT Advisory Aggregator
// Sources: 8 national CERT RSS feeds (free, no key)
// ================================================
import { safeFetchText, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import crypto from "crypto"

const CERT_FEEDS = [
  { key: "cert_fr", label: "CERT-FR (France)", url: "https://www.cert.ssi.gouv.fr/feed/" },
  { key: "cert_eu", label: "CERT-EU", url: "https://cert.europa.eu/publications/security-advisories/rss" },
  { key: "ncsc_uk", label: "UK NCSC", url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml" },
  { key: "uscert_ics", label: "ICS-CERT (CISA)", url: "https://www.cisa.gov/uscert/ics/advisories.xml" },
  { key: "bsi_de", label: "BSI (Germany)", url: "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml" },
  { key: "enisa_eu", label: "ENISA (EU)", url: "https://www.enisa.europa.eu/publications/rss" },
  { key: "sans_isc", label: "SANS ISC", url: "https://isc.sans.edu/rssfeed.xml" },
  { key: "nist_nvd_rss", label: "NIST NVD Recent", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml" },
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

export async function fetchAndSyncCertAdvisories(): Promise<{ fetched: number; stored: number }> {
  let totalFetched = 0
  let totalStored = 0

  for (const feed of CERT_FEEDS) {
    try {
      const xml = await safeFetchText(feed.url, {
        headers: { "User-Agent": "IntelForge/1.0 CERT Advisory Monitor" },
      })
      if (!xml) continue

      const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
      totalFetched += items.length

      for (const block of items.slice(0, 30)) {
        const title = extractTag(block, "title").replace(/<[^>]*>/g, "").trim()
        const link = extractTag(block, "link") || extractAttr(block, "link", "href") || ""
        const description = extractTag(block, "description") || extractTag(block, "summary") || ""
        const pubDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "dc:date") || ""

        if (!title || !link) continue

        const guid = crypto.createHash("md5").update(`${feed.key}:${link}`).digest("hex")
        const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()

        const result = await query(
          `INSERT INTO intel_news_cache
             (guid, title, description, url, source, source_label, category, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'vulnerability', $7)
           ON CONFLICT (guid) DO NOTHING`,
          [guid, title.slice(0, 500), description.replace(/<[^>]*>/g, "").slice(0, 500), link, feed.key, feed.label, publishedAt],
        )
        if (result.success) totalStored++
      }
    } catch {
      // Skip failed feeds
    }
  }

  return { fetched: totalFetched, stored: totalStored }
}
