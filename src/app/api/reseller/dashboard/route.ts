import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { getBrandingByUserId, getResellerStats } from "@/lib/tenant"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const branding = await getBrandingByUserId(authResult.user.user_id)
  if (!branding || !branding.is_reseller) {
    return NextResponse.json({ error: "Reseller access required" }, { status: 403 })
  }

  const stats = await getResellerStats(branding.id)
  const clientsResult = await query(
    `SELECT * FROM reseller_clients WHERE reseller_branding_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [branding.id]
  )

  // Commission history (monthly)
  const commissionResult = await query(
    `SELECT
       TO_CHAR(created_at, 'YYYY-MM') as month,
       COUNT(*) as new_clients,
       COALESCE(SUM(monthly_revenue), 0) as revenue,
       COALESCE(SUM(commission_earned), 0) as commission
     FROM reseller_clients
     WHERE reseller_branding_id = $1
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`,
    [branding.id]
  )

  return NextResponse.json({
    stats,
    clients: clientsResult.data || [],
    commissionHistory: commissionResult.data || [],
    branding,
  })
}
