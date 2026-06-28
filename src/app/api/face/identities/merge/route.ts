import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const body = await request.json().catch(() => ({}))
  const { identity_id, face_ids } = body

  if (!identity_id || !face_ids || !Array.isArray(face_ids) || face_ids.length === 0) {
    return NextResponse.json({ error: "identity_id and face_ids[] are required" }, { status: 400 })
  }

  const { data } = await query(
    `UPDATE face_identities
     SET merged_faces = ARRAY(SELECT DISTINCT unnest(merged_faces || $2::text[])),
         updated_at = NOW()
     WHERE id = $1 AND created_by = $3
     RETURNING *`,
    [identity_id, face_ids, userId],
  )

  if (!data?.length) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 })
  }

  return NextResponse.json({ identity: data[0] })
}
