// ================================================
// /api/intel/automation/actions
// GET    list with filters: status, search, category, severity
// PATCH  update single action status (auth)
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { updateActionStatus } from "@/lib/intel/automation/action-queue"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

const STATUSES = ["open", "in_progress", "done", "dismissed", "all"] as const
type FilterStatus = (typeof STATUSES)[number]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get("status") || "open") as FilterStatus
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  const search = (searchParams.get("search") || "").trim().slice(0, 200)
  const category = (searchParams.get("category") || "").trim().slice(0, 40)
  const severity = (searchParams.get("severity") || "").trim().slice(0, 20)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 200)

  const conditions: string[] = []
  const params: unknown[] = []
  if (status !== "all") {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`)
  }
  if (category) {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }
  if (severity) {
    params.push(severity)
    conditions.push(`severity = $${params.length}`)
  }
  params.push(limit)

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
  const r = await query(
    `SELECT id, action_key, title, description, category, priority, severity,
            source_type, source_ref, suggested_steps, metadata, status, assigned_to, created_at
     FROM intel_action_queue
     ${where}
     ORDER BY priority DESC, created_at DESC
     LIMIT $${params.length}`,
    params,
  )
  const items = ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    actionKey: String(row.action_key),
    title: String(row.title),
    description: String(row.description || ""),
    category: String(row.category),
    priority: Number(row.priority),
    severity: String(row.severity),
    sourceType: String(row.source_type),
    sourceRef: row.source_ref as string | null,
    suggestedSteps: row.suggested_steps,
    metadata: row.metadata,
    status: String(row.status),
    assignedTo: row.assigned_to ? Number(row.assigned_to) : null,
    createdAt: (row.created_at as Date).toISOString(),
  }))
  return NextResponse.json({ success: true, items })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const id = Number(body.id)
  const status = String(body.status || "")
  const validStatuses = ["open", "in_progress", "done", "dismissed"] as const
  if (!id || !validStatuses.includes(status as (typeof validStatuses)[number])) {
    return NextResponse.json(
      { error: "Provide id and status in {open|in_progress|done|dismissed}" },
      { status: 400 },
    )
  }
  await updateActionStatus(
    id,
    status as (typeof validStatuses)[number],
    auth.user.user_id,
    auth.user.username || auth.user.email,
  )
  return NextResponse.json({ success: true })
}
