import { NextRequest, NextResponse } from "next/server"
import { getPrioritizedVulns, getPrioritizationStats } from "@/lib/intel/prioritize"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const minSeverity = request.nextUrl.searchParams.get("severity") || undefined
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50")

  try {
    const [vulns, stats] = await Promise.all([
      getPrioritizedVulns(limit, minSeverity),
      getPrioritizationStats(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        vulns,
        stats,
        patchNow: vulns.filter((v) => v.verdict === "PATCH_NOW").length,
        patchSoon: vulns.filter((v) => v.verdict === "PATCH_SOON").length,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
