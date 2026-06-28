import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { memGet, memSet, TTL } from "@/lib/intel/cache"
import type { IntelStats } from "@/lib/intel/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const cacheKey = "intel:stats:dashboard"
  const cached = memGet<IntelStats>(cacheKey)
  if (cached) {
    return NextResponse.json({ success: true, data: cached })
  }

  const [
    newsTodayRes,
    newVulns24hRes,
    criticalCvesRes,
    kevTotalRes,
    activeGroupsRes,
    victims30dRes,
    malware24hRes,
    threatActorsRes,
  ] = await Promise.all([
    query(`SELECT COUNT(*) as c FROM intel_news_cache WHERE published_at > NOW() - INTERVAL '24 hours'`, []),
    query(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE published_at > NOW() - INTERVAL '24 hours'`, []),
    query(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE cvss_v3_severity = 'CRITICAL'`, []),
    query(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE is_kev = true`, []),
    query(`SELECT COUNT(*) as c FROM intel_ransomware_groups WHERE active = true`, []),
    query(`SELECT COUNT(*) as c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '30 days'`, []),
    query(`SELECT COUNT(*) as c FROM intel_malware_cache WHERE first_seen > NOW() - INTERVAL '24 hours'`, []),
    query(`SELECT COUNT(*) as c FROM intel_mitre_groups`, []),
  ])

  const stats: IntelStats = {
    newsToday: Number(newsTodayRes.data?.[0]?.c) || 0,
    newVulns24h: Number(newVulns24hRes.data?.[0]?.c) || 0,
    criticalCves: Number(criticalCvesRes.data?.[0]?.c) || 0,
    kevTotal: Number(kevTotalRes.data?.[0]?.c) || 0,
    activeRansomwareGroups: Number(activeGroupsRes.data?.[0]?.c) || 0,
    ransomwareVictims30d: Number(victims30dRes.data?.[0]?.c) || 0,
    malwareSamples24h: Number(malware24hRes.data?.[0]?.c) || 0,
    threatActors: Number(threatActorsRes.data?.[0]?.c) || 0,
    lastUpdated: new Date().toISOString(),
  }

  memSet(cacheKey, stats, TTL.STATS)
  return NextResponse.json({ success: true, data: stats })
}
