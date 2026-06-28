import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { normalizeEntityValue, type EntityType } from "@/lib/intel/entity-extractor"
import { getRecommendedActions } from "@/lib/intel/recommendations"

function buildTimeline(entity: any, findings: any[], relationships: any[]) {
  const timeline: Array<Record<string, any>> = []

  if (entity?.first_seen) {
    timeline.push({ date: entity.first_seen, event: "Entity first seen", sourceType: "entity", detail: `${entity.entity_type}: ${entity.value}` })
  }

  if (entity?.last_seen) {
    timeline.push({ date: entity.last_seen, event: "Entity last seen", sourceType: "entity", detail: `${entity.entity_type}: ${entity.value}` })
  }

  for (const finding of findings.slice(0, 20)) {
    timeline.push({
      date: finding.last_seen || finding.first_seen || finding.created_at || finding.updated_at || null,
      event: finding.title || finding.name || "Linked finding",
      sourceType: finding.source_type || "finding",
      detail: finding.description || finding.summary || finding.severity || "Linked to entity",
      evidence: finding.id,
    })
  }

  for (const rel of relationships.slice(0, 20)) {
    const label = rel.relationship_type || "relationship"
    const direction = rel.source_entity_id === entity.id ? `${rel.source_value || rel.source_type} → ${rel.target_value || rel.target_type}` : `${rel.target_value || rel.target_type} ← ${rel.source_value || rel.source_type}`
    timeline.push({
      date: rel.created_at || null,
      event: `Relationship ${label}`,
      sourceType: "relationship",
      detail: `${direction}; confidence ${rel.confidence ?? rel.weight ?? "unknown"}`,
      evidence: rel.id,
    })
  }

  return timeline
    .filter((item) => item.date || item.event || item.detail)
    .sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime())
    .slice(0, 50)
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error, authResult.status)
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") as EntityType | null
  const value = searchParams.get("value") || ""

  if (!type || !value) {
    return NextResponse.json({ error: "type and value are required" }, { status: 400 })
  }

  const normalizedValue = normalizeEntityValue(type, value)

  const entityResult = await query(
    `SELECT * FROM intel_entities WHERE entity_type = $1 AND normalized_value = $2`,
    [type, normalizedValue]
  )

  if (!entityResult.success) {
    return NextResponse.json({ error: entityResult.error || "Failed to load entity" }, { status: 500 })
  }

  const entity = entityResult.data?.[0]
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const [findingsResult, relationshipsResult, alertsResult, casesResult, reportsResult, sightingsResult, demoCorpusResult] = await Promise.all([
    query(
      `SELECT f.*
       FROM intel_findings f
       JOIN intel_relationships r ON r.finding_id = f.id
       WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
       ORDER BY f.risk_score DESC, f.last_seen DESC
       LIMIT 100`,
      [entity.id]
    ),
    query(
      `SELECT r.*, se.entity_type AS source_type, se.value AS source_value,
              te.entity_type AS target_type, te.value AS target_value
       FROM intel_relationships r
       LEFT JOIN intel_entities se ON se.id = r.source_entity_id
       LEFT JOIN intel_entities te ON te.id = r.target_entity_id
       WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
       ORDER BY r.weight DESC, r.created_at DESC
       LIMIT 100`,
      [entity.id]
    ),
    query(
      `SELECT id, alert_type, severity, title, status, created_at, updated_at
       FROM monitoring_alerts
       WHERE title ILIKE $1 OR message ILIKE $1 OR details::text ILIKE $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [`%${entity.value}%`]
    ),
    query(
      `SELECT id, title, status, priority, created_at, updated_at, description
       FROM intel_cases
       WHERE title ILIKE $1 OR description ILIKE $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [`%${entity.value}%`]
    ),
    query(
      `SELECT id, title, report_type, status, created_at, updated_at, executive_summary
       FROM intel_reports
       WHERE title ILIKE $1 OR executive_summary ILIKE $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [`%${entity.value}%`]
    ),
    query(
      `SELECT id, source_type, source_name, title, summary, discovered_at, last_seen
       FROM intel_findings
       WHERE title ILIKE $1 OR summary ILIKE $1 OR evidence::text ILIKE $1
       ORDER BY last_seen DESC, created_at DESC
       LIMIT 50`,
      [`%${entity.value}%`]
    ),
    query(
      `SELECT id, timestamp AS created_at, doc_type AS source_type, source_name, title, summary, body AS description, severity, risk_score, confidence
       FROM intel_demo_corpus
       WHERE title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1 OR entities::text ILIKE $1 OR iocs::text ILIKE $1
       ORDER BY risk_score DESC, timestamp DESC
       LIMIT 50`,
      [`%${entity.value}%`]
    ),
  ])

  const findings = findingsResult.data || []
  const relationships = relationshipsResult.data || []
  const alerts = alertsResult.data || []
  const cases = casesResult.data || []
  const reports = reportsResult.data || []
  const sightings = sightingsResult.data || []
  const demoCorpus = demoCorpusResult.data || []

  return NextResponse.json({
    entity,
    findings,
    relationships,
    timeline: buildTimeline(entity, [...findings, ...alerts, ...cases, ...reports, ...sightings, ...demoCorpus], relationships),
    relatedWorkflow: {
      alerts,
      cases,
      reports,
      demoCorpus,
    },
    recommendedActions: getRecommendedActions({
      entityType: type,
      severity: entity.risk_score >= 70 ? "high" : entity.risk_score >= 45 ? "medium" : "low",
      value,
    }),
  })
}
