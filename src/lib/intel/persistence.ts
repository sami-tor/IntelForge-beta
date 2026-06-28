import crypto from "crypto"
import { query } from "../db"
import type { EntityType, ExtractedEntity } from "./entity-extractor"
import type { FindingSeverity } from "./risk-scoring"

export interface IntelEntityRecord {
  id: number
  entity_type: EntityType
  value: string
  normalized_value: string
  risk_score: number
  confidence: number
}

export interface UpsertFindingInput {
  findingType: string
  severity: FindingSeverity
  riskScore: number
  confidence: number
  title: string
  description?: string
  sourceName?: string
  sourceType?: string
  rawReference?: Record<string, unknown>
  evidence?: Record<string, unknown>
  recommendedActions?: string[]
  fingerprint?: string
}

export function createFindingFingerprint(parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex")
}

export async function upsertIntelEntity(
  entity: ExtractedEntity,
  riskScore = 0,
  tags: string[] = []
): Promise<IntelEntityRecord | null> {
  const sql = `
    INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, metadata, first_seen, last_seen)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
    ON CONFLICT (entity_type, normalized_value)
    DO UPDATE SET
      value = EXCLUDED.value,
      risk_score = GREATEST(intel_entities.risk_score, EXCLUDED.risk_score),
      confidence = GREATEST(intel_entities.confidence, EXCLUDED.confidence),
      tags = (SELECT ARRAY(SELECT DISTINCT unnest(intel_entities.tags || EXCLUDED.tags))),
      metadata = intel_entities.metadata || EXCLUDED.metadata,
      last_seen = NOW(),
      updated_at = NOW()
    RETURNING id, entity_type, value, normalized_value, risk_score, confidence
  `

  const result = await query(sql, [
    entity.type,
    entity.value,
    entity.normalizedValue,
    riskScore,
    entity.confidence,
    tags,
    JSON.stringify(entity.metadata || {}),
  ])

  if (!result.success || !result.data?.[0]) return null
  return result.data[0] as IntelEntityRecord
}

export async function upsertIntelFinding(input: UpsertFindingInput) {
  const fingerprint = input.fingerprint || createFindingFingerprint([
    input.findingType,
    input.sourceName,
    input.rawReference,
    input.title,
  ])

  const sql = `
    INSERT INTO intel_findings (
      finding_type, severity, risk_score, confidence, title, description, source_name, source_type,
      raw_reference, evidence, recommended_actions, fingerprint, first_seen, last_seen
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, NOW(), NOW())
    ON CONFLICT (fingerprint)
    DO UPDATE SET
      severity = EXCLUDED.severity,
      risk_score = GREATEST(intel_findings.risk_score, EXCLUDED.risk_score),
      confidence = GREATEST(intel_findings.confidence, EXCLUDED.confidence),
      description = COALESCE(EXCLUDED.description, intel_findings.description),
      evidence = intel_findings.evidence || EXCLUDED.evidence,
      recommended_actions = EXCLUDED.recommended_actions,
      last_seen = NOW(),
      updated_at = NOW()
    RETURNING *
  `

  return query(sql, [
    input.findingType,
    input.severity,
    input.riskScore,
    input.confidence,
    input.title,
    input.description || null,
    input.sourceName || null,
    input.sourceType || null,
    JSON.stringify(input.rawReference || {}),
    JSON.stringify(input.evidence || {}),
    JSON.stringify(input.recommendedActions || []),
    fingerprint,
  ])
}

export async function linkEntityToFinding(
  entityId: number,
  findingId: number,
  relationshipType = "mentioned_in",
  weight = 50,
  evidence: Record<string, unknown> = {}
) {
  const sql = `
    INSERT INTO intel_relationships (source_entity_id, finding_id, relationship_type, weight, evidence)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (source_entity_id, target_entity_id, finding_id, relationship_type)
    DO UPDATE SET
      weight = GREATEST(intel_relationships.weight, EXCLUDED.weight),
      evidence = intel_relationships.evidence || EXCLUDED.evidence
    RETURNING *
  `

  return query(sql, [entityId, findingId, relationshipType, weight, JSON.stringify(evidence)])
}

export async function ensureIntelSource(name: string, sourceType = "indexed_data", reliability = 60) {
  const sql = `
    INSERT INTO intel_sources (name, source_type, reliability, is_enabled)
    VALUES ($1, $2, $3, true)
    ON CONFLICT (name)
    DO UPDATE SET
      source_type = EXCLUDED.source_type,
      reliability = EXCLUDED.reliability,
      updated_at = NOW()
    RETURNING *
  `

  return query(sql, [name, sourceType, reliability])
}
