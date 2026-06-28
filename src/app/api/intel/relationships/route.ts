import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error, authResult.status)
  }

  const { searchParams } = new URL(request.url)
  const entityId = Number(searchParams.get("entityId") || 0)
  const findingId = Number(searchParams.get("findingId") || 0)

  if (!entityId && !findingId) {
    return NextResponse.json({ error: "entityId or findingId is required" }, { status: 400 })
  }

  const where = entityId
    ? "r.source_entity_id = $1 OR r.target_entity_id = $1"
    : "r.finding_id = $1"
  const value = entityId || findingId

  const result = await query(
    `SELECT r.*, se.entity_type AS source_type, se.value AS source_value,
            te.entity_type AS target_type, te.value AS target_value,
            f.finding_type, f.title AS finding_title, f.risk_score AS finding_risk_score
     FROM intel_relationships r
     LEFT JOIN intel_entities se ON se.id = r.source_entity_id
     LEFT JOIN intel_entities te ON te.id = r.target_entity_id
     LEFT JOIN intel_findings f ON f.id = r.finding_id
     WHERE ${where}
     ORDER BY r.weight DESC, r.created_at DESC
     LIMIT 250`,
    [value]
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to load relationships" }, { status: 500 })
  }

  return NextResponse.json({ relationships: result.data || [] })
}
