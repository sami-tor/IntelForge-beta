import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { getDb } from "@/lib/db"

interface LoginActivity {
  id: number
  userId: number
  userEmail: string
  ipAddress: string
  status: "success" | "failed" | "suspicious"
  reason?: string
  timestamp: string
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const limitParam = request.nextUrl.searchParams.get("limit") || "100"
    
    // SECURITY: Validate and cap limit to prevent DoS
    const limit = Math.min(Math.max(parseInt(limitParam) || 100, 1), 1000) // Max 1000

    try {
      const result = await db.query(`
        SELECT 
          la.id,
          la.user_id,
          u.email as user_email,
          la.ip_address,
          la.status,
          la.reason,
          la.timestamp
        FROM login_activity la
        JOIN users u ON la.user_id = u.id
        ORDER BY la.timestamp DESC
        LIMIT $1
      `, [limit])

      const activities: LoginActivity[] = result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        ipAddress: row.ip_address,
        status: row.status,
        reason: row.reason,
        timestamp: row.timestamp,
      }))

      return NextResponse.json({ activities })
    } catch (error: any) {
      // Table doesn't exist yet
      if (error.code === "42P01") {
        return NextResponse.json({ activities: [] })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin Login Activity] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch login activity" }, { status: 500 })
  }
}

// Endpoint to clear old activity logs
export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const daysOldParam = request.nextUrl.searchParams.get("days") || "30"
    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    
    // SECURITY: Validate and parse daysOld to prevent SQL injection
    const daysOld = Math.max(1, Math.min(parseInt(daysOldParam) || 30, 365)) // Between 1 and 365 days

    try {
      const result = await db.query(
        `DELETE FROM login_activity WHERE timestamp < NOW() - INTERVAL '1 day' * $1`,
        [daysOld]
      )

      // Log admin action
      await db.query(
        "INSERT INTO admin_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [authResult.user.user_id, "clear_login_activity", "logs", JSON.stringify({ daysOld })]
      ).catch(() => null)

      return NextResponse.json({ 
        success: true, 
        message: `Cleared login activity logs older than ${daysOld} days` 
      })
    } catch (error: any) {
      if (error.code === "42P01") {
        return NextResponse.json({ success: false, error: "Login activity table not found" }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin Login Activity] DELETE error:", error)
    return NextResponse.json({ error: "Failed to clear login activity" }, { status: 500 })
  }
}
