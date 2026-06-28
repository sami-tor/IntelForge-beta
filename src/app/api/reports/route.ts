import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { generateIntelReport } from "@/lib/intel/report-generator"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const result = await query(
    `SELECT * FROM intel_reports
     WHERE user_id = $1 OR $2 = 'admin'
     ORDER BY created_at DESC
     LIMIT 100`,
    [authResult.user.id, authResult.user.role]
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ reports: result.data || [] })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const body = await request.json()
  const reportType = body.reportType || "entity_report"
  const entityId = body.entityId || null
  const caseId = body.caseId || null

  const entityResult = entityId ? await query(`SELECT * FROM intel_entities WHERE id = $1`, [entityId]) : { data: [] }
  const caseResult = caseId ? await query(`SELECT * FROM intel_cases WHERE id = $1`, [caseId]) : { data: [] }
  const findingsResult = entityId
    ? await query(
        `SELECT f.* FROM intel_findings f
         JOIN intel_relationships r ON r.finding_id = f.id
         WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
         ORDER BY f.risk_score DESC
         LIMIT 100`,
        [entityId]
      )
    : caseId
      ? await query(
          `SELECT f.* FROM intel_findings f
           JOIN intel_case_items ci ON ci.finding_id = f.id
           WHERE ci.case_id = $1
           ORDER BY f.risk_score DESC`,
          [caseId]
        )
      : { data: [] }

  const entity = entityResult.data?.[0] || null
  const caseRecord = caseResult.data?.[0] || null
  const title = body.title || caseRecord?.title || (entity ? `${entity.entity_type}: ${entity.value}` : "Intelligence Report")
  const reportBody = generateIntelReport({
    reportType,
    title,
    entity,
    caseRecord,
    findings: findingsResult.data || [],
  })

  const result = await query(
    `INSERT INTO intel_reports (user_id, case_id, entity_id, report_type, title, body, html)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [authResult.user.id, caseId, entityId, reportType, title, JSON.stringify(reportBody), null]
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ report: result.data?.[0] })
}
