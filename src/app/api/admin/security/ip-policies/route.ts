import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { getDb } from "@/lib/db"

interface IPPolicy {
  id: number
  userId: number
  userEmail: string
  ipAddress: string
  status: "active" | "locked" | "unlocked"
  createdAt: string
  lastActivity: string
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()

    // Check if table exists, if not return empty array
    try {
      const result = await db.query(`
        SELECT 
          ip.id,
          ip.user_id,
          u.email as user_email,
          ip.ip_address,
          ip.status,
          ip.created_at,
          ip.last_activity
        FROM ip_lock_policies ip
        JOIN users u ON ip.user_id = u.id
        ORDER BY ip.last_activity DESC
        LIMIT 100
      `)

      const policies: IPPolicy[] = result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        ipAddress: row.ip_address,
        status: row.status,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
      }))

      return NextResponse.json({ policies })
    } catch (error: any) {
      // Table doesn't exist yet
      if (error.code === "42P01") {
        return NextResponse.json({ policies: [] })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin IP Policies] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch IP policies" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { policyId, status } = body

    if (!policyId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["active", "locked", "unlocked"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const db = getDb()

    try {
      await db.query(
        `UPDATE ip_lock_policies SET status = $1, last_activity = NOW() WHERE id = $2`,
        [status, policyId]
      )

      // Log admin action
      await db.query(
        "INSERT INTO admin_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [authResult.user.user_id, `${status}_ip_policy`, "ip_policy", JSON.stringify({ policyId, status })]
      ).catch(() => null)

      return NextResponse.json({ success: true })
    } catch (error: any) {
      if (error.code === "42P01") {
        return NextResponse.json({ success: false, error: "IP policies table not found" }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin IP Policies] PUT error:", error)
    return NextResponse.json({ error: "Failed to update IP policy" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { policyId } = body

    if (!policyId) {
      return NextResponse.json({ error: "Policy ID required" }, { status: 400 })
    }

    const db = getDb()

    try {
      await db.query("DELETE FROM ip_lock_policies WHERE id = $1", [policyId])

      // Log admin action
      await db.query(
        "INSERT INTO admin_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [authResult.user.user_id, "delete_ip_policy", "ip_policy", JSON.stringify({ policyId })]
      ).catch(() => null)

      return NextResponse.json({ success: true })
    } catch (error: any) {
      if (error.code === "42P01") {
        return NextResponse.json({ success: false, error: "IP policies table not found" }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin IP Policies] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete IP policy" }, { status: 500 })
  }
}
