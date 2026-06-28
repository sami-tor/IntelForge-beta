import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { getDb } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

interface AuditLog {
  id: number
  adminId: number
  adminEmail: string
  action: string
  resource: string
  resourceId?: number
  details: Record<string, any>
  timestamp: string
  ipAddress?: string
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const limitParam = request.nextUrl.searchParams.get("limit") || "500"
    const offsetParam = request.nextUrl.searchParams.get("offset") || "0"
    const source = (request.nextUrl.searchParams.get("source") || "admin").toLowerCase()
    
    // SECURITY: Validate and cap pagination parameters to prevent DoS
    const limit = Math.min(Math.max(parseInt(limitParam) || 500, 1), 1000) // Max 1000 per page
    const offset = Math.max(parseInt(offsetParam) || 0, 0) // Min 0

    try {
      if (source === "security") {
        const result = await db.query(`
          SELECT 
            sal.id,
            sal.user_id,
            sal.event_type,
            sal.details,
            sal.severity,
            sal.ip_address,
            sal.user_agent,
            sal.created_at,
            u.email as user_email
          FROM security_audit_logs sal
          LEFT JOIN users u ON sal.user_id = u.id
          ORDER BY sal.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset])

        const logs = result.rows.map((row: any) => ({
          id: row.id,
          adminId: row.user_id,
          adminEmail: row.user_email,
          action: row.event_type,
          resource: row.severity,
          resourceId: undefined,
          details: typeof row.details === "string" ? safeJsonParse(row.details, {}) : row.details,
          timestamp: row.created_at,
          ipAddress: row.ip_address,
        }))

        const countResult = await db.query("SELECT COUNT(*) as count FROM security_audit_logs")
        const total = countResult.rows[0]?.count || 0
        return NextResponse.json({ logs, total, limit, offset })
      } else {
        const result = await db.query(`
          SELECT 
            al.id,
            al.admin_id,
            u.email as admin_email,
            al.action,
            al.target_type,
            al.target_id,
            al.details,
            al.created_at
          FROM admin_logs al
          JOIN users u ON al.admin_id = u.id
          ORDER BY al.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset])

        const logs: AuditLog[] = result.rows.map((row: any) => ({
          id: row.id,
          adminId: row.admin_id,
          adminEmail: row.admin_email,
          action: row.action,
          resource: row.target_type,
          resourceId: row.target_id,
          details: typeof row.details === "string" ? safeJsonParse(row.details, {}) : row.details,
          timestamp: row.created_at,
          ipAddress: undefined,
        }))

        const countResult = await db.query("SELECT COUNT(*) as count FROM admin_logs")
        const total = countResult.rows[0]?.count || 0

        return NextResponse.json({ logs, total, limit, offset })
      }
    } catch (error: any) {
      if (error.code === "42P01") {
        return NextResponse.json({ logs: [], total: 0, limit, offset })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin Audit Logs] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}

// Endpoint to export audit logs
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { format = "json", days = 30 } = body
    
    // SECURITY: Validate and cap days to prevent SQL injection and DoS
    const validatedDays = Math.max(1, Math.min(parseInt(days.toString()) || 30, 365)) // Between 1 and 365 days

    const db = getDb()

    try {
      const result = await db.query(`
        SELECT 
          al.id,
          al.admin_id,
          u.email as admin_email,
          al.action,
          al.target_type,
          al.target_id,
          al.details,
          al.created_at
        FROM admin_logs al
        JOIN users u ON al.admin_id = u.id
        WHERE al.created_at >= NOW() - INTERVAL '1 day' * $1
        ORDER BY al.created_at DESC
      `, [validatedDays])

      const logs = result.rows.map((row: any) => ({
        id: row.id,
        admin: row.admin_email,
        action: row.action,
        resource: row.target_type,
        resourceId: row.target_id,
        details: typeof row.details === "string" ? safeJsonParse(row.details, {}) : row.details,
        timestamp: row.created_at,
        ip: undefined,
      }))

      if (format === "csv") {
        // Convert to CSV
        const headers = ["ID", "Admin", "Action", "Resource", "Resource ID", "IP", "Timestamp", "Details"]
        const rows = logs.map((log: any) => [
          log.id,
          log.admin,
          log.action,
          log.resource,
          log.resourceId || "",
          log.ip || "",
          log.timestamp,
          JSON.stringify(log.details),
        ])

        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
          },
        })
      }

      return NextResponse.json({ logs })
    } catch (error: any) {
      if (error.code === "42P01") {
        return NextResponse.json({ logs: [] })
      }
      throw error
    }
  } catch (error) {
    console.error("[Admin Audit Logs Export] POST error:", error)
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 })
  }
}
