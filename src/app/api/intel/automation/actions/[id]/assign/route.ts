// ================================================
// PATCH /api/intel/automation/actions/[id]/assign
// Assign or unassign an action.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { assignAction } from "@/lib/intel/automation/action-collab"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  const numId = Number(id)
  if (!Number.isFinite(numId) || numId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const assigneeIdRaw = body.assigneeId
  const assigneeId =
    assigneeIdRaw === null || assigneeIdRaw === undefined
      ? null
      : Number(assigneeIdRaw)
  const assigneeName = body.assigneeName ? String(body.assigneeName) : null

  await assignAction(
    numId,
    assigneeId,
    assigneeName,
    auth.user.user_id,
    auth.user.username || auth.user.email,
  )
  return NextResponse.json({ success: true })
}
