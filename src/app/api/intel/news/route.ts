import { NextRequest, NextResponse } from "next/server"
import { getNews } from "@/lib/intel/fetchers/news"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  // Try to get user (optional auth - public feed with limits)
  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch {
    // Unauthenticated - apply free limits
  }

  const gate = await checkIntelAccess(user, "news")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  const news = await getNews(maxItems, category)

  return NextResponse.json({
    success: true,
    data: news,
    total: news.length,
    limit: gate.limit,
    plan: user
      ? (user.role === "admin" ? "admin" : user.subscription_type || "free")
      : "anonymous",
  })
}
