import { NextRequest, NextResponse } from "next/server"
import { generateAttackSurfaceReport } from "@/lib/intel/attack-surface"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.trim() || ""
  if (!domain || domain.length < 3) {
    return NextResponse.json({ success: false, error: "Domain required (at least 3 characters)" }, { status: 400 })
  }

  try {
    const report = await generateAttackSurfaceReport(domain)
    return NextResponse.json({ success: true, data: report })
  } catch (err) {
    console.error("[attack-surface] Error generating report:", err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error generating attack surface report",
    }, { status: 500 })
  }
}
