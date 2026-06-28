// ================================================
// GET /api/intel/automation/forecast-accuracy
// Returns the most recent backtest results per metric,
// plus the best method for each.
// ================================================
import { NextResponse } from "next/server"
import {
  getLatestAccuracy,
  getBestMethodPerMetric,
} from "@/lib/intel/automation/forecast-backtest"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const [latest, bestMap] = await Promise.all([
    getLatestAccuracy(50),
    getBestMethodPerMetric(),
  ])
  const best = [...bestMap.entries()].map(([metricKey, info]) => ({
    metricKey,
    ...info,
  }))
  return NextResponse.json({ success: true, latest, best })
}
