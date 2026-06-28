import { getRecommendedActions } from "./recommendations"

export interface AnalystSummaryInput {
  title: string
  findingType?: string
  severity?: string
  riskScore?: number
  evidence?: string
  entityValue?: string
  entityType?: string
}

export function buildAnalystSummary(input: AnalystSummaryInput) {
  const severity = input.severity || "medium"
  const riskScore = input.riskScore ?? 50
  const whatHappened = input.entityValue
    ? `${input.entityType || "Entity"} ${input.entityValue} was observed in intelligence data related to ${input.findingType || "indexed exposure"}.`
    : input.title

  return {
    whatHappened,
    whyItMatters: `This is rated ${severity} with a risk score of ${riskScore}/100 because it may indicate exposed assets, credentials, infrastructure, or adversary activity requiring analyst review.`,
    evidence: input.evidence || "Review linked findings and source references for raw evidence.",
    confidence: riskScore >= 70 ? "High" : riskScore >= 45 ? "Medium" : "Low",
    recommendedActions: getRecommendedActions({
      findingType: input.findingType,
      severity,
      entityType: input.entityType as any,
      value: input.entityValue,
    }),
  }
}
