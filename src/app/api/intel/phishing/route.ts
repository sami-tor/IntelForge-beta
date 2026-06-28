import { NextRequest, NextResponse } from "next/server"
import { getPhishing } from "@/lib/intel/fetchers/phishing"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const brand = searchParams.get("brand") || undefined
  const activeOnly = searchParams.get("active") === "1"
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "phishing_intel")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  const items = await getPhishing(maxItems, brand, activeOnly)

  return NextResponse.json({ success: true, data: items, total: items.length, limit: gate.limit })
}
