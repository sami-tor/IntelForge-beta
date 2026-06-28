import { NextRequest, NextResponse } from "next/server"
import { getGroups, getVictims, getRansomwareStats } from "@/lib/intel/fetchers/ransomware"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get("view") || "groups" // groups | victims | stats
  const days = parseInt(searchParams.get("days") || "30", 10)
  const limit = parseInt(searchParams.get("limit") || "100", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "ransomware")

  if (view === "stats") {
    const stats = await getRansomwareStats()
    return NextResponse.json({ success: true, data: stats })
  }

  if (view === "victims") {
    if (!gate.allowed) {
      return NextResponse.json({
        success: false,
        error: gate.reason,
        upgradeRequired: gate.upgradeRequired,
      }, { status: 403 })
    }
    const victims = await getVictims(days, Math.min(limit, 200))
    return NextResponse.json({ success: true, data: victims, total: victims.length })
  }

  // Default: groups listing (free users get first 5 only)
  const groups = await getGroups()
  const limited = !gate.allowed ? groups.slice(0, 5) : groups

  return NextResponse.json({
    success: true,
    data: limited,
    total: groups.length,
    limited: !gate.allowed,
    upgradeRequired: !gate.allowed ? gate.upgradeRequired : undefined,
  })
}
