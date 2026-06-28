// ================================================
// GET /api/intel/automation/briefings/export
// Returns the latest daily briefing as a PDF.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { getLatestBriefing } from "@/lib/intel/automation/briefing-generator"
import { generateBriefingPdf } from "@/lib/intel/automation/briefing-pdf"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(_request: NextRequest) {
  const briefing = await getLatestBriefing("daily")
  if (!briefing) {
    return NextResponse.json({ error: "No briefing available yet" }, { status: 404 })
  }

  try {
    const pdf = await generateBriefingPdf(briefing)
    const periodEnd = new Date(briefing.periodEnd).toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="intelforge-briefing-${periodEnd}.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 },
    )
  }
}
