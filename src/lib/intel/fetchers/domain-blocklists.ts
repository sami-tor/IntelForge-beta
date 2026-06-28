// ================================================
// Intel Hub - Domain/URL Blocklist Aggregator
// Sources: 6 free domain reputation feeds
// No API key required.
// ================================================
import { safeFetchText } from "@/lib/intel/cache"
import { query } from "@/lib/db"

const DOMAIN_FEEDS = [
  { key: "urlhaus_online", label: "URLhaus Malicious URLs", url: "https://urlhaus.abuse.ch/downloads/text_online/" },
  { key: "openphish", label: "OpenPhish Feed", url: "https://openphish.com/feed.txt" },
  { key: "phishing_database", label: "Phishing.Database Active", url: "https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt" },
  { key: "disconnect_malvert", label: "Disconnect Malvertising", url: "https://s3.amazonaws.com/lists.disconnect.me/simple_malvertising.txt" },
  { key: "nocoin_crypto", label: "NoCoin Cryptojacking", url: "https://raw.githubusercontent.com/nicehash/NoCoin/master/src/hosts" },
  { key: "threatfox_iocs", label: "ThreatFox Recent IOCs", url: "https://threatfox.abuse.ch/export/csv/recent/" },
]

function parseDomainList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//") && !l.startsWith(";"))
    .map((l) => {
      // Handle hosts file format: 0.0.0.0 domain.com
      if (l.startsWith("0.0.0.0") || l.startsWith("127.0.0.1")) {
        return l.split(/\s+/)[1] || ""
      }
      // Handle URL format: extract domain
      if (l.startsWith("http")) {
        try { return new URL(l).hostname } catch { return l }
      }
      // Handle CSV format (take first column that looks like a domain)
      const parts = l.split(",")
      for (const p of parts) {
        const clean = p.replace(/"/g, "").trim()
        if (clean.includes(".") && !clean.includes(" ") && clean.length < 255) return clean
      }
      return l.split(/[\s,;]/)[0].trim()
    })
    .filter((d) => d && d.includes(".") && d.length > 3 && d.length < 255)
    .slice(0, 100000)
}

export async function fetchAndSyncDomainBlocklists(): Promise<{ fetched: number; stored: number }> {
  let totalFetched = 0
  let totalStored = 0

  await query(
    `CREATE TABLE IF NOT EXISTS intel_domain_blocklist (
      id SERIAL PRIMARY KEY,
      domain VARCHAR(255) NOT NULL,
      source_key VARCHAR(60) NOT NULL,
      source_label VARCHAR(120),
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (domain, source_key)
    )`,
    [],
  )

  for (const feed of DOMAIN_FEEDS) {
    try {
      const text = await safeFetchText(feed.url, {
        headers: { "User-Agent": "IntelForge/1.0 Threat Intel Aggregator" },
      })
      if (!text) continue
      const domains = parseDomainList(text)
      totalFetched += domains.length

      for (let i = 0; i < domains.length; i += 500) {
        const chunk = domains.slice(i, i + 500)
        const values = chunk
          .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
          .join(",")
        const params = chunk.flatMap((d) => [d, feed.key, feed.label])
        await query(
          `INSERT INTO intel_domain_blocklist (domain, source_key, source_label)
           VALUES ${values}
           ON CONFLICT (domain, source_key) DO UPDATE SET last_seen = NOW()`,
          params,
        )
        totalStored += chunk.length
      }
    } catch {
      // Skip failed feeds
    }
  }

  return { fetched: totalFetched, stored: totalStored }
}

export async function getBlocklistedDomain(domain: string) {
  const r = await query(
    `SELECT source_key, source_label, first_seen, last_seen
     FROM intel_domain_blocklist WHERE domain = $1 OR domain LIKE $2`,
    [domain, `%.${domain}`],
  )
  return r.data || []
}
