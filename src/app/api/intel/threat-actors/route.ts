import { NextRequest, NextResponse } from "next/server"
import { getMitreGroups } from "@/lib/intel/fetchers/mitre"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "100", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "threat_actors")

  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)
  const groups = await getMitreGroups(maxItems, search)

  return NextResponse.json({
    success: true,
    data: groups,
    total: groups.length,
    limited: !gate.allowed || (gate.limit !== -1 && groups.length >= gate.limit),
  })
}
