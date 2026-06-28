import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { dispatchWebhookEvent } from "@/lib/integrations/webhook-dispatcher"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const result = await query(
    `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
    [parseInt(id), authResult.user.user_id]
  )

  if (!result.data?.length) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  // Get recent logs
  const logs = await query(
    `SELECT * FROM webhook_logs WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [parseInt(id)]
  )

  return NextResponse.json({ webhook: result.data[0], logs: logs.data || [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const body = await request.json()

  const existing = await query(
    `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
    [parseInt(id), authResult.user.user_id]
  )
  if (!existing.data?.length) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  const fields: string[] = []
  const values: any[] = []
  let idx = 1

  for (const key of ["name", "url", "secret", "events", "is_active"]) {
    if (key in body) {
      fields.push(`${key} = $${idx++}`)
      values.push(body[key])
    }
  }

  if (!fields.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  fields.push(`updated_at = NOW()`)
  values.push(parseInt(id))

  const result = await query(
    `UPDATE webhooks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  )

  return NextResponse.json({ webhook: result.data?.[0] })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const result = await query(
    `DELETE FROM webhooks WHERE id = $1 AND user_id = $2`,
    [parseInt(id), authResult.user.user_id]
  )

  if (!result.success) {
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const webhookId = parseInt(id)

  // Test fire the webhook
  const webhookResult = await query(
    `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
    [webhookId, authResult.user.user_id]
  )
  if (!webhookResult.data?.length) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  const webhook = webhookResult.data[0]
  await dispatchWebhookEvent("search.completed", {
    test: true,
    message: "This is a test event from IntelForge",
    webhook_name: webhook.name,
  })

  // Return updated webhook with logs
  const logs = await query(
    `SELECT * FROM webhook_logs WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [webhookId]
  )

  return NextResponse.json({
    success: true,
    message: "Test event dispatched",
    latest_log: logs.data?.[0] || null,
  })
}
