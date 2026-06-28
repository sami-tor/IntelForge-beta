import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { getLoginActivity } from "@/lib/db"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const result = await getLoginActivity(authResult.user.user_id, 20)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to fetch login activity" }, { status: 500 })
    }

    return NextResponse.json({ activity: result.data || [] })
  } catch (error) {
    console.error("[v0] Login activity fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch login activity" }, { status: 500 })
  }
}
