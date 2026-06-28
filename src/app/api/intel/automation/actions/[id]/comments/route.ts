// ================================================
// /api/intel/automation/actions/[id]/comments
// GET   list comments + audit entries
// POST  add a comment (auth required)
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import {
  listComments,
  listAuditEntries,
  addComment,
} from "@/lib/intel/automation/action-collab"

export const dynamic = "force-dynamic"
export const revalidate = 0

function parseId(idStr: string): number | null {
  const n = Number(idStr)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const numId = parseId(id)
  if (!numId) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const [comments, audit] = await Promise.all([
    listComments(numId),
    listAuditEntries(numId, 50),
  ])
  return NextResponse.json({ success: true, comments, audit })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  const numId = parseId(id)
  if (!numId) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const text = String(body.body || "").trim()
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 })
  const comment = await addComment(
    numId,
    text,
    auth.user.user_id,
    auth.user.username || auth.user.email,
  )
  if (!comment) return NextResponse.json({ error: "Could not add" }, { status: 500 })
  return NextResponse.json({ success: true, comment }, { status: 201 })
}
