import { NextRequest, NextResponse } from "next/server"
import { getCves } from "@/lib/intel/fetchers/cve"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const severity = searchParams.get("severity") || undefined
  const kevOnly = searchParams.get("kev") === "1"
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "cve")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 500) : Math.min(limitParam, gate.limit)

  const cves = await getCves(maxItems, severity, kevOnly)

  return NextResponse.json({
    success: true,
    data: cves,
    total: cves.length,
    limit: gate.limit,
    kevOnly,
  })
}
