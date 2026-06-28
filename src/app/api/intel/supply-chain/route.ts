import { NextRequest, NextResponse } from "next/server"
import { getSupplyChain, searchSupplyChainByPackage } from "@/lib/intel/fetchers/supply-chain"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ecosystem = searchParams.get("ecosystem") || undefined
  const severity = searchParams.get("severity") || undefined
  const search = searchParams.get("search") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "supply_chain")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  let items
  if (search) {
    items = await searchSupplyChainByPackage(search, ecosystem)
  } else {
    items = await getSupplyChain(maxItems, ecosystem, severity)
  }

  return NextResponse.json({ success: true, data: items, total: items.length, limit: gate.limit })
}
