import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const result = await query(
    `SELECT * FROM intel_cases
     WHERE user_id = $1 OR $2 = 'admin'
     ORDER BY updated_at DESC
     LIMIT 100`,
    [authResult.user.id, authResult.user.role]
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ cases: result.data || [] })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const body = await request.json()
  const title = String(body.title || "").trim()
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })

  const result = await query(
    `INSERT INTO intel_cases (user_id, title, status, severity, summary, recommendations, timeline)
     VALUES ($1, $2, 'open', $3, $4, $5::jsonb, $6::jsonb)
     RETURNING *`,
    [
      authResult.user.id,
      title,
      body.severity || "medium",
      body.summary || null,
      JSON.stringify(body.recommendations || []),
      JSON.stringify([{ at: new Date().toISOString(), event: "Case created", by: authResult.user.email }]),
    ]
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  const caseRecord = result.data?.[0]

  if (caseRecord && (body.entityId || body.findingId || body.alertId)) {
    await query(
      `INSERT INTO intel_case_items (case_id, entity_id, finding_id, alert_id, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [caseRecord.id, body.entityId || null, body.findingId || null, body.alertId || null, body.note || null]
    )
  }

  return NextResponse.json({ case: caseRecord })
}
