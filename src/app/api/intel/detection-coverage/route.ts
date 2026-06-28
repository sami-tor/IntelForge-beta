import { NextResponse } from "next/server"
import { getCoverageAnalysis } from "@/lib/intel/coverage"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { stats, gaps } = await getCoverageAnalysis()
    return NextResponse.json({ success: true, data: { stats, gaps } })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
