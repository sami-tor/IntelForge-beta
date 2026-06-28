import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const caseResult = await query(
    `SELECT * FROM intel_cases WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')`,
    [id, authResult.user.id, authResult.user.role]
  )
  const caseRecord = caseResult.data?.[0]
  if (!caseRecord) return NextResponse.json({ error: "Case not found" }, { status: 404 })

  const itemsResult = await query(
    `SELECT ci.*, e.entity_type, e.value AS entity_value, f.title AS finding_title, f.risk_score
     FROM intel_case_items ci
     LEFT JOIN intel_entities e ON e.id = ci.entity_id
     LEFT JOIN intel_findings f ON f.id = ci.finding_id
     WHERE ci.case_id = $1
     ORDER BY ci.created_at DESC`,
    [id]
  )

  return NextResponse.json({ case: caseRecord, items: itemsResult.data || [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const body = await request.json()
  const result = await query(
    `UPDATE intel_cases
     SET status = COALESCE($1, status), severity = COALESCE($2, severity), summary = COALESCE($3, summary), updated_at = NOW()
     WHERE id = $4 AND (user_id = $5 OR $6 = 'admin')
     RETURNING *`,
    [body.status || null, body.severity || null, body.summary || null, id, authResult.user.id, authResult.user.role]
  )

  if (!result.data?.[0]) return NextResponse.json({ error: "Case not found" }, { status: 404 })
  return NextResponse.json({ case: result.data[0] })
}
