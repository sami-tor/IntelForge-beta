import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { getBrandingByUserId } from "@/lib/tenant"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const branding = await getBrandingByUserId(authResult.user.user_id)
  if (!branding || !branding.is_reseller) {
    return NextResponse.json({ error: "Reseller access required" }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "50")
  const offset = (page - 1) * limit

  let whereClause = `WHERE reseller_branding_id = $1`
  const params: any[] = [branding.id]

  if (status) {
    params.push(status)
    whereClause += ` AND status = $${params.length}`
  }

  params.push(limit, offset)

  const clientsResult = await query(
    `SELECT * FROM reseller_clients ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const countResult = await query(
    `SELECT COUNT(*) as total FROM reseller_clients WHERE reseller_branding_id = $1`,
    [branding.id]
  )

  return NextResponse.json({
    clients: clientsResult.data || [],
    total: countResult.data?.[0]?.total || 0,
    page,
    limit,
  })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const branding = await getBrandingByUserId(authResult.user.user_id)
  if (!branding || !branding.is_reseller) {
    return NextResponse.json({ error: "Reseller access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { client_name, client_email, subscription_plan, monthly_revenue } = body

    if (!client_name) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 })
    }

    const commission = (monthly_revenue || 0) * (branding.reseller_commission_percent / 100)

    const result = await query(
      `INSERT INTO reseller_clients (reseller_branding_id, client_name, client_email, subscription_plan, monthly_revenue, commission_earned)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [branding.id, client_name, client_email || null, subscription_plan || null, monthly_revenue || 0, commission]
    )

    return NextResponse.json({ client: result.data?.[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const branding = await getBrandingByUserId(authResult.user.user_id)
  if (!branding || !branding.is_reseller) {
    return NextResponse.json({ error: "Reseller access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { clientId, status, monthly_revenue, subscription_plan } = body

    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    if (status) { fields.push(`status = $${idx++}`); values.push(status) }
    if (monthly_revenue !== undefined) {
      fields.push(`monthly_revenue = $${idx++}`); values.push(monthly_revenue)
      const commission = monthly_revenue * (branding.reseller_commission_percent / 100)
      fields.push(`commission_earned = $${idx++}`); values.push(commission)
    }
    if (subscription_plan) { fields.push(`subscription_plan = $${idx++}`); values.push(subscription_plan) }

    if (!fields.length) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

    fields.push(`updated_at = NOW()`)
    values.push(clientId)

    const result = await query(
      `UPDATE reseller_clients SET ${fields.join(", ")}
       WHERE id = $${idx} AND reseller_branding_id = $${idx + 1}
       RETURNING *`,
      [...values, branding.id]
    )

    return NextResponse.json({ client: result.data?.[0] })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 })
  }
}
