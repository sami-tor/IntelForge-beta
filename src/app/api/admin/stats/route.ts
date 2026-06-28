import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { getDashboardStats } from "@/lib/admin-db"

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("[v0] Admin stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
