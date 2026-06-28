import { query } from "@/lib/db"
import { extractEntities, inferFindingType } from "./entity-extractor"
import { calculateRiskScore } from "./risk-scoring"
import { getRecommendedActions } from "./recommendations"
import {
  createFindingFingerprint,
  ensureIntelSource,
  linkEntityToFinding,
  upsertIntelEntity,
  upsertIntelFinding,
} from "./persistence"

function getEvidenceText(row: any) {
  return [row.file_path, row.file_name, row.content].filter(Boolean).join("\n")
}

export async function normalizeIntelBatch(limit: number, afterId: number) {
  await ensureIntelSource("search_index_lines", "indexed_data", 70)

  const linesResult = await query(
    `SELECT id, file_path, file_name, line_number, content, file_type, country, indexed_at
     FROM search_index_lines
     WHERE id > $1
     ORDER BY id ASC
     LIMIT $2`,
    [afterId, limit]
  )

  if (!linesResult.success) {
    return { success: false, error: linesResult.error || "Failed to read indexed data" }
  }

  let processed = 0
  let entityCount = 0
  let findingCount = 0
  let relationshipCount = 0
  let lastId = afterId

  for (const row of linesResult.data || []) {
    lastId = Number(row.id)
    const evidenceText = getEvidenceText(row)
    const entities = extractEntities(evidenceText)
    if (entities.length === 0) {
      processed++
      continue
    }

    const findingType = inferFindingType(evidenceText)
    const confidence = Math.max(...entities.map((entity) => entity.confidence))
    const risk = calculateRiskScore({
      findingType,
      confidence,
      sourceReliability: 70,
      lastSeen: row.indexed_at,
      evidenceText,
      entities,
    })
    const recommendedActions = getRecommendedActions({ findingType, severity: risk.severity })
    const fingerprint = createFindingFingerprint(["search_index_lines", row.id, findingType])

    const findingResult = await upsertIntelFinding({
      findingType,
      severity: risk.severity,
      riskScore: risk.score,
      confidence,
      title: `${findingType.replace(/_/g, " ")} in ${row.file_name || "indexed data"}`,
      description: row.content?.slice(0, 500) || "Indexed data exposure detected.",
      sourceName: "search_index_lines",
      sourceType: "indexed_data",
      rawReference: {
        table: "search_index_lines",
        id: row.id,
        filePath: row.file_path,
        lineNumber: row.line_number,
      },
      evidence: {
        content: row.content,
        fileName: row.file_name,
        fileType: row.file_type,
        country: row.country,
        riskReasons: risk.reasons,
      },
      recommendedActions,
      fingerprint,
    })

    const finding = findingResult.data?.[0]
    if (finding) findingCount++

    for (const entity of entities) {
      const savedEntity = await upsertIntelEntity(entity, risk.score, [findingType])
      if (!savedEntity) continue
      entityCount++

      if (finding?.id) {
        const linkResult = await linkEntityToFinding(savedEntity.id, Number(finding.id), "mentioned_in", risk.score, {
          searchIndexLineId: row.id,
          lineNumber: row.line_number,
        })
        if (linkResult.success) relationshipCount++
      }
    }

    processed++
  }

  return {
    success: true,
    processed,
    entityCount,
    findingCount,
    relationshipCount,
    lastId,
    hasMore: (linesResult.data || []).length === limit,
  }
}
