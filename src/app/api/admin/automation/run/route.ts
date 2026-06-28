// ================================================
// POST /api/admin/automation/run
// Admin-triggered "Run Now" button on the Command
// Center. Same orchestrator as the cron uses.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { runFullAutomation, getAutomationRuns } from "@/lib/intel/automation/orchestrator"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
  }

  try {
    const result = await runFullAutomation()
    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Automation failed" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status || 401 })
  }
  const runs = await getAutomationRuns(20)
  return NextResponse.json({ success: true, runs })
}
