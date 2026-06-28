import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = await requireAuth(request)
    if (auth.authorized && auth.user) return String(auth.user.id || "")
  } catch {}
  // Fallback: allow anonymous with session cookie
  const cookie = request.cookies.get("session")?.value || request.cookies.get("token")?.value
  return cookie || "anonymous"
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

  const r = await query(
    `SELECT id, entity_type, entity_value, label, notes, last_checked_at,
            change_count, is_active, created_at
     FROM user_watchlists
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  )

  return NextResponse.json({ success: true, data: r.data || [] })
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { entity_type, entity_value, label, notes } = body

  if (!entity_type || !entity_value) {
    return NextResponse.json({ success: false, error: "entity_type and entity_value required" }, { status: 400 })
  }

  const valid = ["cve", "domain", "actor", "hash", "ip", "keyword", "face"]
  if (!valid.includes(entity_type)) {
    return NextResponse.json({ success: false, error: "Invalid entity_type" }, { status: 400 })
  }

  try {
    const r = await query(
      `INSERT INTO user_watchlists (user_id, entity_type, entity_value, label, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, entity_type, entity_value)
       DO UPDATE SET label = EXCLUDED.label, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING id, entity_type, entity_value, label, created_at`,
      [userId, entity_type, entity_value, label || null, notes || null],
    )
    return NextResponse.json({ success: true, data: r.data?.[0] })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 })

  await query(
    `DELETE FROM user_watchlists WHERE id = $1 AND user_id = $2`,
    [parseInt(id), userId],
  )

  return NextResponse.json({ success: true })
}
