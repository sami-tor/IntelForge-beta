// ================================================
// Cron: Intel Feed Sync
// Call with: POST /api/cron/intel-sync
// Header:    Authorization: Bearer <CRON_SECRET>
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { fetchAndSyncNews } from "@/lib/intel/fetchers/news"
import { fetchAndSyncRansomware } from "@/lib/intel/fetchers/ransomware"
import { fetchAndSyncCves } from "@/lib/intel/fetchers/cve"
import { fetchAndSyncMalware } from "@/lib/intel/fetchers/malware"
import { fetchAndSyncMitre } from "@/lib/intel/fetchers/mitre"
import { fetchAndSyncExploits } from "@/lib/intel/fetchers/exploit"
import { fetchAndSyncPhishing } from "@/lib/intel/fetchers/phishing"
import { fetchAndSyncSupplyChain } from "@/lib/intel/fetchers/supply-chain"
import { fetchAndSyncSigma } from "@/lib/intel/fetchers/sigma"
import { fetchAndSyncDarknet } from "@/lib/intel/fetchers/darknet-monitor"
import { fetchAndSyncCampaigns } from "@/lib/intel/fetchers/apt-campaigns"
import { fetchAndSyncGithubSecrets } from "@/lib/intel/fetchers/github-secrets"
import { fetchAndSyncYara } from "@/lib/intel/fetchers/yara-rules"
import { fetchAndSyncIpBlocklists } from "@/lib/intel/fetchers/ip-blocklists"
import { fetchAndSyncDomainBlocklists } from "@/lib/intel/fetchers/domain-blocklists"
import { fetchAndSyncCertAdvisories } from "@/lib/intel/fetchers/cert-advisories"
import { fetchAndSyncVendorBlogs } from "@/lib/intel/fetchers/vendor-blogs"
import { fetchAndSyncRansomwareLive } from "@/lib/intel/fetchers/ransomware-live"
import { logFeedSync, feedNeedsRefresh, TTL } from "@/lib/intel/cache"
import { ensureScraperRunTables, logScraperRun } from "@/lib/intel/scraper-runner"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 300

async function syncDarkwebSources() {
  const result = await query(
    `UPDATE intel_darknet_sources
     SET last_success_at = NOW(), updated_at = NOW()
     WHERE enabled = true`,
    [],
  )
  return { fetched: 0, stored: result.success ? 1 : 0 }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || ""
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureScraperRunTables()

  const { searchParams } = new URL(request.url)
  const feed = searchParams.get("feed") || "all"
  const results: Record<string, { fetched: number; stored: number; skipped?: boolean; error?: string }> = {}

  async function runSync(
    name: string,
    ttlSeconds: number,
    fn: () => Promise<{ fetched: number; stored: number }>,
  ) {
    if (feed !== "all" && feed !== name) return

    const needsRefresh = await feedNeedsRefresh(name, ttlSeconds)
    if (!needsRefresh) {
      results[name] = { fetched: 0, stored: 0, skipped: true }
      await logScraperRun({ sourceKey: name, status: "skipped", fetched: 0, stored: 0, metadata: { reason: "ttl-not-expired", feed } })
      return
    }

    const start = Date.now()
    await logFeedSync(name, "running")
    await logScraperRun({ sourceKey: name, status: "running", metadata: { feed } })

    try {
      const r = await fn()
      const durationMs = Date.now() - start
      results[name] = r
      await logFeedSync(name, "success", r.fetched, r.stored, undefined, durationMs)
      await logScraperRun({ sourceKey: name, status: "success", fetched: r.fetched, stored: r.stored, durationMs, metadata: { feed } })
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      results[name] = { fetched: 0, stored: 0, error: msg }
      await logFeedSync(name, "failed", 0, 0, msg, durationMs)
      await logScraperRun({ sourceKey: name, status: "failed", fetched: 0, stored: 0, error: msg, durationMs, metadata: { feed } })
    }
  }

  await runSync("news", TTL.NEWS, fetchAndSyncNews)
  await runSync("malware", TTL.MALWARE, fetchAndSyncMalware)
  await runSync("ransomware", TTL.RANSOMWARE, fetchAndSyncRansomware)
  await runSync("cve", TTL.CVE, fetchAndSyncCves)
  await runSync("mitre", TTL.MITRE, fetchAndSyncMitre)
  await runSync("exploit", TTL.CVE, fetchAndSyncExploits)
  await runSync("phishing", TTL.NEWS, fetchAndSyncPhishing)
  await runSync("supply_chain", TTL.CVE, fetchAndSyncSupplyChain)
  await runSync("sigma", TTL.MITRE, fetchAndSyncSigma)
  await runSync("darknet", TTL.RANSOMWARE, fetchAndSyncDarknet)
  await runSync("apt_campaigns", TTL.MITRE, fetchAndSyncCampaigns)
  await runSync("github_secrets", 12 * 3600, fetchAndSyncGithubSecrets)
  await runSync("yara", TTL.MITRE, fetchAndSyncYara)
  await runSync("ip_blocklists", 6 * 3600, fetchAndSyncIpBlocklists)
  await runSync("domain_blocklists", 6 * 3600, fetchAndSyncDomainBlocklists)
  await runSync("cert_advisories", TTL.NEWS, fetchAndSyncCertAdvisories)
  await runSync("vendor_blogs", TTL.NEWS, fetchAndSyncVendorBlogs)
  await runSync("ransomware_live", TTL.RANSOMWARE, fetchAndSyncRansomwareLive)

  if (feed === "all" || feed === "darkweb") {
    const start = Date.now()
    try {
      const r = await syncDarkwebSources()
      results.darkweb_sources = r
      await logScraperRun({ sourceKey: "darkweb_sources", status: "success", fetched: r.fetched, stored: r.stored, durationMs: Date.now() - start, metadata: { feed } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.darkweb_sources = { fetched: 0, stored: 0, error: msg }
      await logScraperRun({ sourceKey: "darkweb_sources", status: "failed", error: msg, durationMs: Date.now() - start, metadata: { feed } })
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
