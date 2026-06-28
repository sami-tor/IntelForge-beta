// ================================================
// GET /api/intel/automation/briefings
// List recent briefings for the archive page.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { listBriefings } from "@/lib/intel/automation/briefing-generator"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100)
  const items = await listBriefings(limit)
  return NextResponse.json({ success: true, items })
}
