import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"

function toInt(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : parseInt(String(value || ""), 10)
  return Number.isFinite(num) ? num : fallback
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const result = await query(
      `SELECT id, source_key, source_name, onion_url, source_type, enabled,
              rate_limit_minutes, legal_basis, collection_policy, reliability_score,
              last_success_at, last_error, created_at, updated_at
       FROM intel_darknet_sources
       ORDER BY updated_at DESC, created_at DESC`,
      [],
    )
    if (!result.success) throw new Error(result.error || "Query failed")
    return NextResponse.json({ dataSources: result.data || [] })
  } catch (error: any) {
    console.error("Failed to fetch darkweb sources:", error)
    return NextResponse.json({ error: "Failed to fetch darkweb sources" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }

    const sourceKey = String(body.sourceKey || body.source_key || "").trim()
    const sourceName = String(body.sourceName || body.source_name || "").trim()
    const onionUrl = String(body.onionUrl || body.onion_url || "").trim()
    const sourceType = String(body.sourceType || body.source_type || "forum_public").trim()
    const enabled = body.enabled !== false
    const rateLimitMinutes = toInt(body.rateLimitMinutes || body.rate_limit_minutes, 1440)
    const reliabilityScore = toInt(body.reliabilityScore || body.reliability_score, 50)
    const legalBasis = String(body.legalBasis || body.legal_basis || "").trim()
    const collectionPolicy = String(body.collectionPolicy || body.collection_policy || "").trim()

    if (!sourceKey || !sourceName || !onionUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO intel_darknet_sources
         (source_key, source_name, onion_url, source_type, enabled, rate_limit_minutes,
          legal_basis, collection_policy, reliability_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (source_key) DO UPDATE SET
         source_name = EXCLUDED.source_name,
         onion_url = EXCLUDED.onion_url,
         source_type = EXCLUDED.source_type,
         enabled = EXCLUDED.enabled,
         rate_limit_minutes = EXCLUDED.rate_limit_minutes,
         legal_basis = EXCLUDED.legal_basis,
         collection_policy = EXCLUDED.collection_policy,
         reliability_score = EXCLUDED.reliability_score,
         updated_at = NOW()
       RETURNING id, source_key, source_name, onion_url, source_type, enabled,
                 rate_limit_minutes, legal_basis, collection_policy, reliability_score,
                 last_success_at, last_error, created_at, updated_at`,
      [sourceKey, sourceName, onionUrl, sourceType, enabled, rateLimitMinutes, legalBasis, collectionPolicy, reliabilityScore],
    )

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(result.error || "Insert failed")
    }

    return NextResponse.json({ success: true, source: result.data[0] })
  } catch (error: any) {
    console.error("Failed to create darkweb source:", error)
    return NextResponse.json({ error: error?.message || "Failed to create darkweb source" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }

    const id = toInt(body.id, 0)
    if (!id) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 })

    const fields: string[] = []
    const values: any[] = []
    const push = (sql: string, value: any) => {
      values.push(value)
      fields.push(`${sql} = $${values.length}`)
    }

    if (body.enabled !== undefined) push("enabled", !!body.enabled)
    if (body.rateLimitMinutes !== undefined || body.rate_limit_minutes !== undefined) push("rate_limit_minutes", toInt(body.rateLimitMinutes || body.rate_limit_minutes, 1440))
    if (body.legalBasis !== undefined || body.legal_basis !== undefined) push("legal_basis", String(body.legalBasis || body.legal_basis || ""))
    if (body.collectionPolicy !== undefined || body.collection_policy !== undefined) push("collection_policy", String(body.collectionPolicy || body.collection_policy || ""))
    if (body.reliabilityScore !== undefined || body.reliability_score !== undefined) push("reliability_score", toInt(body.reliabilityScore || body.reliability_score, 50))
    if (body.lastError !== undefined || body.last_error !== undefined) push("last_error", String(body.lastError || body.last_error || ""))

    if (fields.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    values.push(id)
    const result = await query(
      `UPDATE intel_darknet_sources
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, source_key, source_name, onion_url, source_type, enabled,
                 rate_limit_minutes, legal_basis, collection_policy, reliability_score,
                 last_success_at, last_error, created_at, updated_at`,
      values,
    )

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(result.error || "Update failed")
    }

    return NextResponse.json({ success: true, source: result.data[0] })
  } catch (error: any) {
    console.error("Failed to update darkweb source:", error)
    return NextResponse.json({ error: error?.message || "Failed to update darkweb source" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = toInt(searchParams.get("id"), 0)
    if (!id) return NextResponse.json({ error: "Invalid source ID" }, { status: 400 })

    const result = await query(`DELETE FROM intel_darknet_sources WHERE id = $1`, [id])
    if (!result.success) throw new Error(result.error || "Delete failed")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Failed to delete darkweb source:", error)
    return NextResponse.json({ error: error?.message || "Failed to delete darkweb source" }, { status: 500 })
  }
}
