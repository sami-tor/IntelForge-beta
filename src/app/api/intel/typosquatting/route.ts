import { NextRequest, NextResponse } from "next/server"
import { detectTyposquatting } from "@/lib/intel/fetchers/typosquatting"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get("domain") || searchParams.get("q") || ""

  if (!domain) {
    return NextResponse.json({ success: false, error: "Domain parameter required" }, { status: 400 })
  }

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "typosquatting")
  if (!gate.allowed) {
    return NextResponse.json({ success: false, error: gate.reason, upgradeRequired: gate.upgradeRequired }, { status: 403 })
  }

  const results = await detectTyposquatting(domain)

  return NextResponse.json({
    success: true,
    data: {
      originalDomain: domain,
      totalVariants: results.length,
      highRisk: results.filter((r) => r.riskScore >= 50).length,
      resolving: results.filter((r) => r.dnsResolves).length,
      results,
    },
  })
}
