import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { addResponseSignature } from "@/lib/response-signing"

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const result = await query(`
      SELECT id, name, type, connection_string, is_active, created_at
      FROM data_sources
      ORDER BY created_at DESC
    `)
    if (!result.success) {
      throw new Error(result.error || "Query failed")
    }

    const signed = addResponseSignature({ dataSources: result.data || [] })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("Failed to fetch data sources:", error)
    return NextResponse.json({ error: "Failed to fetch data sources" }, { status: 500 })
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
    const { name, type, connection_string } = body

    const result = await query(
      `
      INSERT INTO data_sources (name, type, connection_string, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, type, connection_string, is_active, created_at
    `,
      [name, type, connection_string],
    )
    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(result.error || "Insert failed")
    }

    const signed = addResponseSignature({ dataSource: result.data[0] })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("Failed to create data source:", error)
    return NextResponse.json({ error: "Failed to create data source" }, { status: 500 })
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
    const { id, is_active } = body

    await query(
      `
      UPDATE data_sources
      SET is_active = $1
      WHERE id = $2
    `,
      [is_active, id],
    )

    const signed = addResponseSignature({ success: true })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("Failed to update data source:", error)
    return NextResponse.json({ error: "Failed to update data source" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const id = searchParams.get("id")
    
    // SECURITY: Validate id is a number
    const dataSourceId = parseInt(id || "0")
    if (!dataSourceId || isNaN(dataSourceId)) {
      return NextResponse.json({ error: "Invalid data source ID" }, { status: 400 })
    }

    await query("DELETE FROM data_sources WHERE id = $1", [dataSourceId])

    const signed = addResponseSignature({ success: true })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("Failed to delete data source:", error)
    return NextResponse.json({ error: "Failed to delete data source" }, { status: 500 })
  }
}
