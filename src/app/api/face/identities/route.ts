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
    `SELECT * FROM face_identities WHERE created_by = $1 OR created_by = 'demo-system' ORDER BY updated_at DESC`,
    [userId],
  )

  return NextResponse.json({ identities: data })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const body = await request.json().catch(() => ({}))
  const { name, primary_face_id, merged_faces, threads_username, notes, tags } = body

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { data } = await query(
    `INSERT INTO face_identities (name, primary_face_id, merged_faces, threads_username, notes, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, primary_face_id || null, merged_faces || [], threads_username || null, notes || null, tags || [], userId],
  )

  return NextResponse.json({ identity: data?.[0] })
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const body = await request.json().catch(() => ({}))
  const { id, name, primary_face_id, threads_username, notes, tags, merged_faces } = body

  if (!id) {
    return NextResponse.json({ error: "Identity ID is required" }, { status: 400 })
  }

  const updates: string[] = []
  const params: any[] = []
  let paramIdx = 1

  if (name !== undefined) { updates.push(`name = $${paramIdx++}`); params.push(name) }
  if (primary_face_id !== undefined) { updates.push(`primary_face_id = $${paramIdx++}`); params.push(primary_face_id) }
  if (threads_username !== undefined) { updates.push(`threads_username = $${paramIdx++}`); params.push(threads_username) }
  if (notes !== undefined) { updates.push(`notes = $${paramIdx++}`); params.push(notes) }
  if (tags !== undefined) { updates.push(`tags = $${paramIdx++}`); params.push(tags) }
  if (merged_faces !== undefined) { updates.push(`merged_faces = $${paramIdx++}`); params.push(merged_faces) }

  updates.push(`updated_at = NOW()`)

  params.push(id, userId)
  const { data } = await query(
    `UPDATE face_identities SET ${updates.join(", ")} WHERE id = $${paramIdx - 2} AND created_by = $${paramIdx - 1} RETURNING *`,
    params,
  )

  if (!data?.length) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 })
  }

  return NextResponse.json({ identity: data?.[0] })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const userId = String(auth.user.userId)
  const { searchParams } = request.nextUrl
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Identity ID is required" }, { status: 400 })
  }

  await query(
    `DELETE FROM face_identities WHERE id = $1 AND created_by = $2`,
    [id, userId],
  )

  return NextResponse.json({ success: true })
}
