import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { dispatchWebhookEvent } from "@/lib/integrations/webhook-dispatcher"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const url = new URL(request.url)
  const orgId = url.searchParams.get("orgId")

  let result
  if (orgId) {
    result = await query(
      `SELECT * FROM webhooks WHERE user_id = $1 AND (organization_id = $2 OR organization_id IS NULL) ORDER BY created_at DESC`,
      [authResult.user.user_id, parseInt(orgId)]
    )
  } else {
    result = await query(
      `SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [authResult.user.user_id]
    )
  }

  return NextResponse.json({ webhooks: result.data || [] })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const { name, url, events, secret, organization_id } = body

    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 })
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event must be specified" }, { status: 400 })
    }

    // Validate URL
    try {
      const parsed = new URL(url)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must use HTTP or HTTPS" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO webhooks (user_id, organization_id, name, url, secret, events)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [authResult.user.user_id, organization_id || null, name, url, secret || null, events]
    )

    return NextResponse.json({ webhook: result.data?.[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}
