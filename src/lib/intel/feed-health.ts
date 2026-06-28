// ================================================
// Intel Feed Health Dashboard
// Shows data freshness, record counts, sync status per feed
// ================================================
import { query } from "@/lib/db"

export interface FeedHealth {
  feed: string
  label: string
  tableName: string
  recordCount: number
  newestEntry: string | null
  oldestEntry: string | null
  lastSync: string | null
  status: "healthy" | "stale" | "empty"
  icon: string
}

const FEEDS = [
  { feed: "news", label: "Cyber News", table: "intel_news_cache", dateCol: "published_at", syncCol: "fetched_at", icon: "Newspaper" },
  { feed: "cve", label: "CVE Database", table: "intel_cve_cache", dateCol: "published_at", syncCol: "fetched_at", icon: "ShieldAlert" },
  { feed: "ransomware_groups", label: "Ransomware Groups", table: "intel_ransomware_groups", dateCol: "fetched_at", syncCol: "fetched_at", icon: "Skull" },
  { feed: "ransomware_victims", label: "Ransomware Victims", table: "intel_ransomware_victims", dateCol: "discovered_at", syncCol: "fetched_at", icon: "Users" },
  { feed: "malware", label: "Malware Samples", table: "intel_malware_cache", dateCol: "first_seen", syncCol: "fetched_at", icon: "Bug" },
  { feed: "mitre_groups", label: "MITRE Groups", table: "intel_mitre_groups", dateCol: "fetched_at", syncCol: "fetched_at", icon: "Users" },
  { feed: "mitre_techniques", label: "MITRE Techniques", table: "intel_mitre_techniques", dateCol: "fetched_at", syncCol: "fetched_at", icon: "Grid3x3" },
  { feed: "exploit", label: "Exploit-DB", table: "intel_exploit_cache", dateCol: "published_at", syncCol: "fetched_at", icon: "Bomb" },
  { feed: "phishing", label: "Phishing Intel", table: "intel_phishing_cache", dateCol: "reported_at", syncCol: "fetched_at", icon: "Fish" },
  { feed: "supply_chain", label: "Supply Chain Vulns", table: "intel_supply_chain_cache", dateCol: "published_at", syncCol: "fetched_at", icon: "Package" },
  { feed: "sigma", label: "Sigma Rules", table: "intel_sigma_rules", dateCol: "fetched_at", syncCol: "fetched_at", icon: "FileCode" },
  { feed: "darknet", label: "Darknet Posts", table: "intel_darknet_posts", dateCol: "discovered_at", syncCol: "fetched_at", icon: "Eye" },
  { feed: "apt_campaigns", label: "APT Campaigns", table: "intel_apt_campaigns", dateCol: "start_date", syncCol: "fetched_at", icon: "CalendarClock" },
  { feed: "cert", label: "SSL Certificates", table: "intel_cert_cache", dateCol: "logged_at", syncCol: "fetched_at", icon: "Globe" },
  { feed: "typosquat", label: "Typosquatting", table: "intel_typosquat_cache", dateCol: "detected_at", syncCol: "fetched_at", icon: "AlertTriangle" },
  { feed: "github_secrets", label: "GitHub Secrets", table: "intel_github_secrets", dateCol: "discovered_at", syncCol: "fetched_at", icon: "Key" },
  { feed: "yara", label: "YARA Rules", table: "intel_yara_rules", dateCol: "fetched_at", syncCol: "fetched_at", icon: "Terminal" },
]

export async function getFeedHealth(): Promise<{ feeds: FeedHealth[]; summary: { healthy: number; stale: number; empty: number; totalRecords: number } }> {
  const results: FeedHealth[] = []

  for (const f of FEEDS) {
    try {
      const r = await query(
        `SELECT
           COUNT(*) as cnt,
           MAX(${f.dateCol}) as newest,
           MIN(${f.dateCol}) as oldest,
           MAX(${f.syncCol}) as last_sync
         FROM ${f.table}`,
        [],
      )
      const row = r.data?.[0] || {}
      const count = Number(row.cnt || 0)

      const newest = row.newest ? new Date(row.newest as Date) : null
      const lastSync = row.last_sync ? new Date(row.last_sync as Date) : null

      let status: FeedHealth["status"] = "empty"
      if (count > 0) {
        const now = Date.now()
        const syncAge = lastSync ? now - lastSync.getTime() : Infinity
        const dataAge = newest ? now - newest.getTime() : Infinity
        // Stale if no sync in 7 days or no new data in 30 days
        if (syncAge < 7 * 86400000 && dataAge < 30 * 86400000) status = "healthy"
        else status = "stale"
      }

      results.push({
        feed: f.feed,
        label: f.label,
        tableName: f.table,
        recordCount: count,
        newestEntry: newest?.toISOString() || null,
        oldestEntry: row.oldest ? new Date(row.oldest as Date).toISOString() : null,
        lastSync: lastSync?.toISOString() || null,
        status,
        icon: f.icon,
      })
    } catch {
      results.push({
        feed: f.feed,
        label: f.label,
        tableName: f.table,
        recordCount: 0,
        newestEntry: null,
        oldestEntry: null,
        lastSync: null,
        status: "empty",
        icon: f.icon,
      })
    }
  }

  return {
    feeds: results.sort((a, b) => b.recordCount - a.recordCount),
    summary: {
      healthy: results.filter((f) => f.status === "healthy").length,
      stale: results.filter((f) => f.status === "stale").length,
      empty: results.filter((f) => f.status === "empty").length,
      totalRecords: results.reduce((s, f) => s + f.recordCount, 0),
    },
  }
}
