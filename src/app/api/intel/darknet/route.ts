import { NextRequest, NextResponse } from "next/server"
import { getDarknetPosts } from "@/lib/intel/fetchers/darknet-monitor"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const severity = searchParams.get("severity") || undefined
  const threatActor = searchParams.get("actor") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "darknet_monitor")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  const posts = await getDarknetPosts(maxItems, severity, threatActor)

  return NextResponse.json({ success: true, data: posts, total: posts.length, limit: gate.limit })
}
