import type { ExtractedEntity } from "./entity-extractor"

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical"

export interface RiskScoreInput {
  findingType: string
  confidence?: number
  sourceReliability?: number
  firstSeen?: Date | string | null
  lastSeen?: Date | string | null
  evidenceText?: string | null
  recurrenceCount?: number
  entities?: ExtractedEntity[]
  monitoredValues?: string[]
}

export interface RiskScoreResult {
  score: number
  severity: FindingSeverity
  reasons: string[]
}

const FINDING_BASE_SCORE: Record<string, number> = {
  credential_exposure: 78,
  phishing_indicator: 70,
  malware_indicator: 82,
  indexed_exposure: 38,
  leaked_contact: 45,
  exposed_infrastructure: 58,
  crypto_wallet_exposure: 55,
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function severityFromRiskScore(score: number): FindingSeverity {
  if (score >= 90) return "critical"
  if (score >= 70) return "high"
  if (score >= 45) return "medium"
  if (score >= 20) return "low"
  return "info"
}

function daysSince(value?: Date | string | null) {
  if (!value) return null
  const date = typeof value === "string" ? new Date(value) : value
  const time = date.getTime()
  if (Number.isNaN(time)) return null
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000))
}

export function calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const reasons: string[] = []
  let score = FINDING_BASE_SCORE[input.findingType] ?? 35
  reasons.push(`${input.findingType} base risk`)

  const reliability = input.sourceReliability ?? 60
  score += (reliability - 60) * 0.25
  if (reliability >= 80) reasons.push("high source reliability")

  const confidence = input.confidence ?? 50
  score += (confidence - 50) * 0.2
  if (confidence >= 80) reasons.push("high extraction confidence")

  const evidence = (input.evidenceText || "").toLowerCase()
  if (/password|passwd|pwd|token|secret|api[_-]?key/.test(evidence)) {
    score += 15
    reasons.push("sensitive secret or credential terms present")
  }
  if (/admin|root|privileged|database|vpn|ssh/.test(evidence)) {
    score += 8
    reasons.push("privileged access indicators present")
  }

  const recurrence = input.recurrenceCount ?? 1
  if (recurrence > 1) {
    score += Math.min(12, recurrence * 2)
    reasons.push("repeated sightings across indexed data")
  }

  const lastSeenDays = daysSince(input.lastSeen)
  if (lastSeenDays !== null) {
    if (lastSeenDays <= 7) {
      score += 10
      reasons.push("recent sighting")
    } else if (lastSeenDays > 180) {
      score -= 8
      reasons.push("older sighting")
    }
  }

  const monitored = new Set((input.monitoredValues || []).map((value) => value.toLowerCase()))
  if (input.entities?.some((entity) => monitored.has(entity.normalizedValue))) {
    score += 12
    reasons.push("matches monitored asset")
  }

  if (input.entities?.some((entity) => entity.type === "email")) score += 4
  if (input.entities?.some((entity) => entity.type === "ip" || entity.type === "domain")) score += 3
  if (input.entities?.some((entity) => entity.type === "crypto_wallet")) score += 5

  const finalScore = clampScore(score)
  return {
    score: finalScore,
    severity: severityFromRiskScore(finalScore),
    reasons,
  }
}
