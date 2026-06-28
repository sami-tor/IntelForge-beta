// ================================================
// PATCH /api/intel/automation/actions/bulk
// Bulk update status for multiple action ids.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { updateActionStatus } from "@/lib/intel/automation/action-queue"

export const dynamic = "force-dynamic"
export const revalidate = 0

const VALID = ["open", "in_progress", "done", "dismissed"] as const

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
    : []
  const status = String(body.status || "")
  if (!ids.length || !VALID.includes(status as (typeof VALID)[number])) {
    return NextResponse.json(
      { error: "Provide ids[] and status in {open|in_progress|done|dismissed}" },
      { status: 400 },
    )
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "Max 100 ids" }, { status: 400 })
  }
  let updated = 0
  for (const id of ids) {
    try {
      await updateActionStatus(
        id,
        status as (typeof VALID)[number],
        auth.user.user_id,
        auth.user.username || auth.user.email,
      )
      updated++
    } catch {
      // continue with others
    }
  }
  return NextResponse.json({ success: true, updated })
}
