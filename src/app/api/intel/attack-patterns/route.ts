import { NextRequest, NextResponse } from "next/server"
import { getMitreTechniques } from "@/lib/intel/fetchers/mitre"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tactic = searchParams.get("tactic") || undefined
  const search = searchParams.get("search") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "100", 10)

  // Attack patterns are publicly readable (free tier full access)
  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const techniques = await getMitreTechniques(Math.min(limitParam, 300), tactic, search)

  return NextResponse.json({
    success: true,
    data: techniques,
    total: techniques.length,
  })
}
