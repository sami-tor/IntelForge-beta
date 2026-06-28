import { NextRequest, NextResponse } from "next/server"
import { getLatestGeoSnapshot, getLatestSectorSnapshot } from "@/lib/intel/automation/geo-sector"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(_request: NextRequest) {
  const [geo, sectors] = await Promise.all([
    getLatestGeoSnapshot(50),
    getLatestSectorSnapshot(20),
  ])
  return NextResponse.json({ success: true, geo, sectors })
}
