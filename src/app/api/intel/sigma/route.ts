import { NextRequest, NextResponse } from "next/server"
import { getSigmaRules } from "@/lib/intel/fetchers/sigma"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get("level") || undefined
  const product = searchParams.get("product") || undefined
  const techniqueId = searchParams.get("technique") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "sigma_rules")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  const rules = await getSigmaRules(maxItems, level, product, techniqueId)

  return NextResponse.json({ success: true, data: rules, total: rules.length, limit: gate.limit })
}
