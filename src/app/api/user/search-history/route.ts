import { NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  // Use JWT authentication
  const authResult = await requireAuth(request)
  
  if (!authResult.authorized || !authResult.user) {
    return createAuthResponse("Authentication required", 401)
  }
  
  const user = authResult.user

  try {
    const result = await query(
      `SELECT id, query, results_count, ip_address, created_at 
       FROM search_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [user.user_id],
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to fetch search history" }, { status: 500 })
    }

    return NextResponse.json({ history: result.data || [] })
  } catch (error) {
    console.error("[v0] Failed to fetch search history:", error)
    return NextResponse.json({ error: "Failed to fetch search history" }, { status: 500 })
  }
}
