import { NextRequest, NextResponse } from "next/server"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"
import { generateThreatActorReport } from "@/lib/intel/fetchers/actor-report"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

async function getUnifiedActorData(q: string) {
  const like = `%${q}%`
  const [aptCampaigns, darknetPosts, ransomwareGroups, mitreGroup] = await Promise.all([
    query(
      `SELECT campaign_id, campaign_name, threat_actor, target_sectors, target_countries,
              is_active, confidence, description, cves, techniques, malware_families
       FROM intel_apt_campaigns
       WHERE threat_actor ILIKE $1 OR campaign_name ILIKE $1 OR description ILIKE $1
       ORDER BY start_date DESC LIMIT 10`,
      [like],
    ),
    query(
      `SELECT post_uid, source, title, threat_actor, victim_name, victim_sector,
              severity, leak_type, discovered_at
       FROM intel_darknet_posts
       WHERE threat_actor ILIKE $1 OR title ILIKE $1 OR victim_name ILIKE $1
       ORDER BY discovered_at DESC LIMIT 10`,
      [like],
    ),
    query(
      `SELECT slug, name, description, active, victim_count, sectors, aliases
       FROM intel_ransomware_groups
       WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1
       LIMIT 5`,
      [like],
    ),
    query(
      `SELECT name, group_id, aliases, techniques, sectors, description
       FROM intel_mitre_groups
       WHERE name ILIKE $1 OR aliases::text ILIKE $1
       LIMIT 1`,
      [like],
    ),
  ])

  return {
    aptCampaigns: aptCampaigns.data || [],
    darknetPosts: darknetPosts.data || [],
    ransomwareGroups: ransomwareGroups.data || [],
    mitreProfile: mitreGroup.data?.[0] || null,
  }
}

export async function GET(request: NextRequest) {
  const queryValue = request.nextUrl.searchParams.get("q")?.trim() || ""
  if (queryValue.length < 2) {
    return NextResponse.json({ success: false, error: "q must be at least 2 characters" }, { status: 400 })
  }

  try {
    let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
    try {
      const auth = await requireAuth(request)
      if (auth.authorized) user = auth.user
    } catch {
      user = null
    }

    const gate = await checkIntelAccess(user, "threat_actors")
    if (!gate.allowed) {
      return NextResponse.json({
        success: false,
        error: gate.reason,
        upgradeRequired: gate.upgradeRequired,
      }, { status: 429 })
    }

    const [report, unified] = await Promise.all([
      generateThreatActorReport(queryValue),
      getUnifiedActorData(queryValue),
    ])

    const data = {
      ...report,
      unified,
      relationships: report.relationships.map(({ sources: _omit, ...rest }) => {
        void _omit
        return rest
      }),
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[actor-report] Error generating report:", err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error generating report",
    }, { status: 500 })
  }
}
