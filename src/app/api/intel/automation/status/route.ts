// ================================================
// GET /api/intel/automation/status
// Public read endpoint: latest threat score,
// score history, top correlation clusters,
// trend series and most recent briefing.
// All from local cache — no upstream calls.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { getLatestThreatScore, getThreatScoreHistory } from "@/lib/intel/automation/threat-score"
import { getTopClusters } from "@/lib/intel/automation/correlator"
import { getTrendSeries } from "@/lib/intel/automation/trends"
import { getLatestBriefing } from "@/lib/intel/automation/briefing-generator"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(_request: NextRequest) {
  const [score, history, clusters, trends, briefing] = await Promise.all([
    getLatestThreatScore(),
    getThreatScoreHistory(168),
    getTopClusters(10),
    getTrendSeries(14),
    getLatestBriefing("daily"),
  ])

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    threatScore: score,
    history,
    clusters,
    trends,
    briefing,
  })
}
