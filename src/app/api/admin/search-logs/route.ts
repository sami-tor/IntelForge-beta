import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const sql = `
      SELECT 
        sl.id, 
        COALESCE(u.username, sl.username, 'Anonymous') as username,
        COALESCE(sl.user_type, 'free') as user_type,
        COALESCE(sl.search_type, 'web') as search_type,
        sl.search_query, 
        sl.ip_address, 
        sl.results_count, 
        sl.created_at
      FROM search_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      ORDER BY sl.created_at DESC
      LIMIT 1000
    `

    const result = await query(sql)

    return NextResponse.json({
      success: true,
      logs: result.data || [],
    })
  } catch (error: any) {
    console.error("[v0] Failed to fetch search logs:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch logs" }, { status: 500 })
  }
}
