import { NextRequest, NextResponse } from "next/server"
import { getCampaigns, getCampaignTimeline } from "@/lib/intel/fetchers/apt-campaigns"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const threatActor = searchParams.get("actor") || undefined
  const isActive = searchParams.get("active") // "true" | "false" | undefined
  const view = searchParams.get("view") || undefined // "timeline" for timeline view
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "apt_campaigns")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  if (view === "timeline") {
    const timeline = await getCampaignTimeline()
    return NextResponse.json({ success: true, data: timeline })
  }

  const campaigns = await getCampaigns(
    maxItems,
    threatActor,
    isActive !== undefined ? isActive === "true" : undefined,
  )

  return NextResponse.json({ success: true, data: campaigns, total: campaigns.length, limit: gate.limit })
}
