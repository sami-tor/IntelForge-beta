// ================================================
// Detection Coverage Gap Analysis
// Cross-references MITRE techniques vs Sigma + YARA rules
// ================================================
import { query } from "@/lib/db"

export interface CoverageGap {
  techniqueId: string
  name: string
  tactic: string
  hasSigma: boolean
  hasYara: boolean
  sigmaRuleCount: number
  yaraRuleCount: number
  actorCount: number
  coverage: "COVERED" | "PARTIAL" | "GAP"
}

export interface CoverageStats {
  totalTechniques: number
  coveredCount: number
  partialCount: number
  gapCount: number
  coveragePercent: number
  byTactic: { tactic: string; total: number; covered: number; gap: number }[]
  criticalGaps: CoverageGap[]
}

export async function getCoverageAnalysis(): Promise<{
  stats: CoverageStats
  gaps: CoverageGap[]
}> {
  const [techniques, sigmaRefs, yaraRefs, actorTechs] = await Promise.all([
    query(
      `SELECT technique_id, name, tactic, platforms
       FROM intel_mitre_techniques
       ORDER BY technique_id`,
      [],
    ),
    query(
      `SELECT technique_id, COUNT(*) as cnt
       FROM intel_sigma_rules
       WHERE technique_id IS NOT NULL
       GROUP BY technique_id`,
      [],
    ),
    query(
      `SELECT unnest(mitre_techniques) as technique_id, COUNT(*) as cnt
       FROM intel_yara_rules
       WHERE mitre_techniques IS NOT NULL
       GROUP BY technique_id`,
      [],
    ),
    query(
      `SELECT unnest(techniques) as technique_id, COUNT(*) as cnt
       FROM intel_mitre_groups
       WHERE techniques IS NOT NULL
       GROUP BY technique_id`,
      [],
    ),
  ])

  const sigmaMap: Record<string, number> = {}
  for (const r of sigmaRefs.data || []) {
    sigmaMap[String(r.technique_id)] = Number(r.cnt)
  }

  const yaraMap: Record<string, number> = {}
  for (const r of yaraRefs.data || []) {
    yaraMap[String(r.technique_id)] = Number(r.cnt)
  }

  const actorMap: Record<string, number> = {}
  for (const r of actorTechs.data || []) {
    actorMap[String(r.technique_id)] = Number(r.cnt)
  }

  const gaps: CoverageGap[] = []
  const tacticStats: Record<string, { total: number; covered: number; gap: number }> = {}

  for (const t of techniques.data || []) {
    const tid = String(t.technique_id)
    const tactic = String(t.tactic || "Unknown")
    const sigmaCount = sigmaMap[tid] || 0
    const yaraCount = yaraMap[tid] || 0
    const actorCount = actorMap[tid] || 0

    const hasSigma = sigmaCount > 0
    const hasYara = yaraCount > 0

    let coverage: CoverageGap["coverage"]
    if (hasSigma && hasYara) coverage = "COVERED"
    else if (hasSigma || hasYara) coverage = "PARTIAL"
    else coverage = "GAP"

    gaps.push({
      techniqueId: tid,
      name: String(t.name),
      tactic,
      hasSigma,
      hasYara,
      sigmaRuleCount: sigmaCount,
      yaraRuleCount: yaraCount,
      actorCount,
      coverage,
    })

    if (!tacticStats[tactic]) tacticStats[tactic] = { total: 0, covered: 0, gap: 0 }
    tacticStats[tactic].total++
    if (coverage === "COVERED") tacticStats[tactic].covered++
    if (coverage === "GAP") tacticStats[tactic].gap++
  }

  const coveredCount = gaps.filter((g) => g.coverage === "COVERED").length
  const partialCount = gaps.filter((g) => g.coverage === "PARTIAL").length
  const gapCount = gaps.filter((g) => g.coverage === "GAP").length

  const stats: CoverageStats = {
    totalTechniques: gaps.length,
    coveredCount,
    partialCount,
    gapCount,
    coveragePercent: Math.round((coveredCount / Math.max(gaps.length, 1)) * 100),
    byTactic: Object.entries(tacticStats).map(([tactic, s]) => ({
      tactic,
      total: s.total,
      covered: s.covered,
      gap: s.gap,
    })),
    criticalGaps: gaps
      .filter((g) => g.coverage === "GAP" && g.actorCount > 0)
      .sort((a, b) => b.actorCount - a.actorCount)
      .slice(0, 20),
  }

  return { stats, gaps }
}
