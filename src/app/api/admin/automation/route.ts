import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"

async function runInternalCron(feed: string) {
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, error: "CRON_SECRET not configured" }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  const response = await fetch(`${baseUrl}/api/cron/intel-sync?feed=${encodeURIComponent(feed)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  })

  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)

  const [darkwebSources, alerts, reports, watchlists, searchHistory, intelSources, scraperRuns] = await Promise.all([
    query(`SELECT COUNT(*) as c, COUNT(*) FILTER (WHERE enabled = true) as enabled FROM intel_darknet_sources`, []),
    query(`SELECT COUNT(*) as c FROM monitoring_alerts WHERE created_at > NOW() - INTERVAL '7 days'`, []),
    query(`SELECT COUNT(*) as c FROM intel_reports WHERE created_at > NOW() - INTERVAL '7 days'`, []),
    query(`SELECT COUNT(*) as c FROM user_watchlists WHERE is_active = true`, []),
    query(`SELECT COUNT(*) as c FROM search_history WHERE created_at > NOW() - INTERVAL '24 hours'`, []),
    query(`SELECT COUNT(*) as c, COUNT(*) FILTER (WHERE enabled = true) as enabled FROM intel_sources`, []),
    query(`SELECT COUNT(*) as c, COUNT(*) FILTER (WHERE status = 'failed') as failed FROM intel_scraper_runs WHERE started_at > NOW() - INTERVAL '7 days'`, []),
  ])

  return NextResponse.json({
    success: true,
    automation: {
      intelSync: { enabled: true, lastRun: null, nextRun: null, status: "active" },
      monitoring: { enabled: true, lastRun: null, nextRun: null, status: "active" },
      search: { enabled: true, status: "active", includeDarkwebDefault: true },
      reports: { enabled: true, status: "active", cadence: "daily/weekly" },
    },
    metrics: {
      darkwebSources: Number(darkwebSources.data?.[0]?.c) || 0,
      enabledDarkwebSources: Number(darkwebSources.data?.[0]?.enabled) || 0,
      alerts7d: Number(alerts.data?.[0]?.c) || 0,
      reports7d: Number(reports.data?.[0]?.c) || 0,
      activeWatchlists: Number(watchlists.data?.[0]?.c) || 0,
      searches24h: Number(searchHistory.data?.[0]?.c) || 0,
      intelSources: Number(intelSources.data?.[0]?.c) || 0,
      enabledIntelSources: Number(intelSources.data?.[0]?.enabled) || 0,
      scraperRuns7d: Number(scraperRuns.data?.[0]?.c) || 0,
      scraperRunsFailed7d: Number(scraperRuns.data?.[0]?.failed) || 0,
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "").toLowerCase()

  if (action === "intel-sync") {
    const result = await runInternalCron("all")
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  }

  if (action === "darkweb-sync") {
    const result = await runInternalCron("darkweb")
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  }

  if (action === "monitoring") {
    const secret = process.env.CRON_SECRET
    if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 })
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/cron/monitoring`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await response.json().catch(() => ({}))
    return NextResponse.json({ ok: response.ok, status: response.status, data }, { status: response.ok ? 200 : 500 })
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 })
}
