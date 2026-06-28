import { buildAnalystSummary } from "./analyst-summary"

export interface IntelReportInput {
  reportType: string
  title: string
  entity?: any
  findings?: any[]
  caseRecord?: any
}

export function generateIntelReport(input: IntelReportInput) {
  const topFinding = input.findings?.[0]
  const summary = buildAnalystSummary({
    title: input.title,
    findingType: topFinding?.finding_type,
    severity: topFinding?.severity || input.caseRecord?.severity,
    riskScore: topFinding?.risk_score || input.entity?.risk_score,
    evidence: topFinding?.description,
    entityType: input.entity?.entity_type,
    entityValue: input.entity?.value,
  })

  return {
    reportType: input.reportType,
    title: input.title,
    generatedAt: new Date().toISOString(),
    executiveSummary: summary,
    entity: input.entity || null,
    case: input.caseRecord || null,
    findings: input.findings || [],
    metrics: {
      findingCount: input.findings?.length || 0,
      maxRiskScore: Math.max(0, ...(input.findings || []).map((finding) => Number(finding.risk_score || 0))),
    },
  }
}
