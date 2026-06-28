// ================================================
// GET /api/admin/automation/runs
// Paginated, filterable run history with optional
// per-row JSON output payload.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID_STATUS = new Set(["running", "success", "failed"])

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 200)
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0)
  const runType = (searchParams.get("runType") || "").trim().slice(0, 60)
  const status = (searchParams.get("status") || "").trim()

  const conds: string[] = []
  const params: unknown[] = []
  if (runType) {
    params.push(runType)
    conds.push(`run_type = $${params.length}`)
  }
  if (VALID_STATUS.has(status)) {
    params.push(status)
    conds.push(`status = $${params.length}`)
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""

  params.push(limit)
  params.push(offset)

  const r = await query(
    `SELECT id, run_type, status, duration_ms, output, error, started_at, finished_at,
            COUNT(*) OVER() AS total_count
     FROM intel_automation_runs
     ${where}
     ORDER BY started_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  const rows = (r.data || []) as Array<Record<string, unknown>>
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const items = rows.map((row) => ({
    id: Number(row.id),
    runType: String(row.run_type),
    status: String(row.status),
    durationMs: Number(row.duration_ms || 0),
    output: row.output ?? {},
    error: row.error as string | null,
    startedAt: (row.started_at as Date).toISOString(),
    finishedAt: row.finished_at ? (row.finished_at as Date).toISOString() : null,
  }))
  return NextResponse.json({ success: true, items, total, limit, offset })
}
