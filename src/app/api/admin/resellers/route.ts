import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { isAdmin } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  if (!isAdmin(authResult.user)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  try {
    // Get all resellers from tenant_branding
    const resellersResult = await query(
      `SELECT tb.*, u.email, u.username,
        (SELECT COUNT(*) FROM reseller_clients rc WHERE rc.reseller_branding_id = tb.id) as client_count,
        (SELECT COALESCE(SUM(rc.monthly_revenue), 0) FROM reseller_clients rc WHERE rc.reseller_branding_id = tb.id AND rc.status = 'active') as total_mrr,
        (SELECT COALESCE(SUM(rc.commission_earned), 0) FROM reseller_clients rc WHERE rc.reseller_branding_id = tb.id) as total_commission
       FROM tenant_branding tb
       LEFT JOIN users u ON tb.user_id = u.id
       WHERE tb.is_reseller = true
       ORDER BY tb.created_at DESC`
    )

    // Aggregate stats
    const statsResult = await query(
      `SELECT
        (SELECT COUNT(*) FROM tenant_branding WHERE is_reseller = true) as total_resellers,
        (SELECT COUNT(*) FROM tenant_branding WHERE is_reseller = true) as active_resellers,
        (SELECT COUNT(*) FROM reseller_clients) as total_clients,
        (SELECT COALESCE(SUM(monthly_revenue), 0) FROM reseller_clients WHERE status = 'active') as total_revenue,
        (SELECT COALESCE(SUM(commission_earned), 0) FROM reseller_clients) as total_commission`
    )

    return NextResponse.json({
      resellers: resellersResult.data || [],
      stats: statsResult.data?.[0] || {
        total_resellers: 0, active_resellers: 0, total_clients: 0, total_revenue: 0, total_commission: 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch resellers" }, { status: 500 })
  }
}
