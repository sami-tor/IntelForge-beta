import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET — list user's investigations
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || undefined
  const limit = parseInt(searchParams.get("limit") || "50", 10)

  const conditions = ["user_id = $1"]
  const params: (string | number)[] = [auth.user.user_id, limit]

  if (status) {
    params.splice(1, 0, status)  // insert before limit
    conditions.push(`status = $2`)
  }

  const r = await query(
    `SELECT id, title, description, query, status, search_results_count,
            linked_cves, linked_groups, linked_victims, linked_actors,
            linked_iocs, linked_news_urls, notes, tags, created_at, updated_at
     FROM intel_investigations
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  )

  if (!r.success) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  return NextResponse.json({ success: true, data: r.data || [] })
}

// POST — create a new investigation
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const {
    title, description, query: searchQuery,
    searchResultsCount, linkedCves, linkedGroups, linkedVictims,
    linkedActors, linkedIocs, linkedNewsUrls, notes, tags,
  } = body as Record<string, unknown>

  if (!title || !searchQuery) {
    return NextResponse.json({ error: "title and query are required" }, { status: 400 })
  }

  const r = await query(
    `INSERT INTO intel_investigations
       (user_id, title, description, query, search_results_count,
        linked_cves, linked_groups, linked_victims, linked_actors,
        linked_iocs, linked_news_urls, notes, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, title, status, created_at`,
    [
      auth.user.user_id,
      String(title),
      description ? String(description) : null,
      String(searchQuery),
      Number(searchResultsCount) || 0,
      Array.isArray(linkedCves) ? linkedCves : null,
      Array.isArray(linkedGroups) ? linkedGroups : null,
      Array.isArray(linkedVictims) ? linkedVictims : null,
      Array.isArray(linkedActors) ? linkedActors : null,
      Array.isArray(linkedIocs) ? linkedIocs : null,
      Array.isArray(linkedNewsUrls) ? linkedNewsUrls : null,
      notes ? String(notes) : null,
      Array.isArray(tags) ? tags : null,
    ],
  )

  if (!r.success || !r.data?.[0]) return NextResponse.json({ error: "Failed to create" }, { status: 500 })
  return NextResponse.json({ success: true, data: r.data[0] }, { status: 201 })
}

// PATCH — update status or notes
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { id, status, notes, tags } = body as Record<string, unknown>
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const updates: string[] = ["updated_at=NOW()"]
  const params: (string | number | null | string[])[] = [Number(id), auth.user.user_id]

  if (status) { params.push(String(status)); updates.push(`status=$${params.length}`) }
  if (notes !== undefined) { params.push(notes ? String(notes) : null as unknown as string); updates.push(`notes=$${params.length}`) }
  if (tags !== undefined) { params.push(Array.isArray(tags) ? tags as string[] : null as unknown as string[]); updates.push(`tags=$${params.length}`) }

  const r = await query(
    `UPDATE intel_investigations SET ${updates.join(",")}
     WHERE id=$1 AND user_id=$2
     RETURNING id, status, updated_at`,
    params,
  )
  if (!r.success || !r.data?.[0]) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 })
  return NextResponse.json({ success: true, data: r.data[0] })
}

// DELETE — remove investigation
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await query(
    `DELETE FROM intel_investigations WHERE id=$1 AND user_id=$2`,
    [parseInt(id), auth.user.user_id],
  )
  return NextResponse.json({ success: true })
}
