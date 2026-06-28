// ================================================
// Intel Hub - IP Blocklist Aggregator
// Sources: 12 free IP reputation/blocklist feeds
// No API key required. Plain text format.
// ================================================
import { safeFetchText, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"

const IP_FEEDS = [
  { key: "blocklist_de", label: "Blocklist.de (all attacks)", url: "http://lists.blocklist.de/lists/all.txt" },
  { key: "firehol_l1", label: "FireHOL Level 1", url: "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset" },
  { key: "firehol_l2", label: "FireHOL Level 2", url: "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level2.netset" },
  { key: "et_compromised", label: "Emerging Threats Compromised", url: "https://rules.emergingthreats.net/blockrules/compromised-ips.txt" },
  { key: "tor_exit", label: "Tor Exit Nodes", url: "https://check.torproject.org/torbulkexitlist" },
  { key: "spamhaus_drop", label: "Spamhaus DROP", url: "https://www.spamhaus.org/drop/drop.txt" },
  { key: "spamhaus_edrop", label: "Spamhaus EDROP", url: "https://www.spamhaus.org/drop/edrop.txt" },
  { key: "dshield", label: "DShield Top Attackers", url: "https://www.dshield.org/block.txt" },
  { key: "cinsscore", label: "CI Army Badguys", url: "https://cinsscore.com/list/ci-badguys.txt" },
  { key: "feodo_recommended", label: "Feodo Tracker C2", url: "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt" },
  { key: "binarydefense", label: "Binary Defense Banlist", url: "https://www.binarydefense.com/banlist.txt" },
  { key: "ssl_blacklist", label: "SSL Blacklist (abuse.ch)", url: "https://sslbl.abuse.ch/blacklist/sslipblacklist.txt" },
]

function parseIpList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith(";") && !l.startsWith("//"))
    .map((l) => l.split(/[\s;,]/)[0].trim())
    .filter((ip) => /^[\d.:\/]+$/.test(ip))
    .slice(0, 50000)
}

export async function fetchAndSyncIpBlocklists(): Promise<{ fetched: number; stored: number }> {
  let totalFetched = 0
  let totalStored = 0

  await query(
    `CREATE TABLE IF NOT EXISTS intel_ip_blocklist (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      source_key VARCHAR(60) NOT NULL,
      source_label VARCHAR(120),
      first_seen TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ip_address, source_key)
    )`,
    [],
  )

  for (const feed of IP_FEEDS) {
    try {
      const text = await safeFetchText(feed.url, {
        headers: { "User-Agent": "IntelForge/1.0 Threat Intel Aggregator" },
      })
      if (!text) continue
      const ips = parseIpList(text)
      totalFetched += ips.length

      // Batch upsert (chunks of 500)
      for (let i = 0; i < ips.length; i += 500) {
        const chunk = ips.slice(i, i + 500)
        const values = chunk
          .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
          .join(",")
        const params = chunk.flatMap((ip) => [ip, feed.key, feed.label])
        await query(
          `INSERT INTO intel_ip_blocklist (ip_address, source_key, source_label)
           VALUES ${values}
           ON CONFLICT (ip_address, source_key) DO UPDATE SET last_seen = NOW()`,
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

export async function getBlocklistedIp(ip: string) {
  const r = await query(
    `SELECT source_key, source_label, first_seen, last_seen
     FROM intel_ip_blocklist WHERE ip_address = $1`,
    [ip],
  )
  return r.data || []
}

export async function getBlocklistStats() {
  const r = await query(
    `SELECT source_key, source_label, COUNT(*) as count
     FROM intel_ip_blocklist GROUP BY source_key, source_label ORDER BY count DESC`,
    [],
  )
  return r.data || []
}
