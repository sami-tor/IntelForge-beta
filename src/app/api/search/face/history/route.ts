import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const { data } = await query(
    `SELECT id, image_hash, image_thumbnail, query_url, results_count, top_matches, search_time_ms, created_at
     FROM face_search_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  )

  return NextResponse.json({ history: data })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const { searchParams } = request.nextUrl
  const id = searchParams.get("id")

  if (id) {
    await query(`DELETE FROM face_search_history WHERE id = $1 AND user_id = $2`, [id, userId])
  } else {
    await query(`DELETE FROM face_search_history WHERE user_id = $1`, [userId])
  }

  return NextResponse.json({ success: true })
}
