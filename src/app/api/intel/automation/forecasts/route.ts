import { NextRequest, NextResponse } from "next/server"
import { getForecasts, listAnomalies } from "@/lib/intel/automation/forecast"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(_request: NextRequest) {
  const [grouped, anomalies] = await Promise.all([
    getForecasts(),
    listAnomalies(20),
  ])

  const forecasts = [...grouped.entries()].map(([metricKey, points]) => ({
    metricKey,
    metricLabel: points[0]?.metricLabel ?? metricKey,
    points,
  }))

  return NextResponse.json({ success: true, forecasts, anomalies })
}
