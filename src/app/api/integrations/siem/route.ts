import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { formatCef, formatLeef, alertToSiemEvent } from "@/lib/integrations/siem-formatter"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const result = await query(
    `SELECT * FROM integration_configs WHERE user_id = $1 AND integration_type = 'siem'`,
    [authResult.user.user_id]
  )

  return NextResponse.json({ config: result.data?.[0] || null })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const { action } = body

    if (action === "save") {
      const { format, syslog_host, syslog_port, syslog_protocol, organization_id } = body
      if (!format || !["cef", "leef"].includes(format)) {
        return NextResponse.json({ error: "Format must be 'cef' or 'leef'" }, { status: 400 })
      }

      const config = { format, syslog_host, syslog_port: syslog_port || 514, syslog_protocol: syslog_protocol || "tcp" }

      const result = await query(
        `INSERT INTO integration_configs (user_id, organization_id, integration_type, name, config)
         VALUES ($1, $2, 'siem', $3, $4)
         ON CONFLICT (user_id, integration_type)
         DO UPDATE SET config = $4, name = $3, organization_id = $2, updated_at = NOW()
         RETURNING *`,
        [authResult.user.user_id, organization_id || null, body.name || `${format.toUpperCase()} SIEM Feed`, JSON.stringify(config)]
      )

      return NextResponse.json({ config: result.data?.[0] })
    }

    if (action === "preview") {
      const configResult = await query(
        `SELECT config FROM integration_configs WHERE user_id = $1 AND integration_type = 'siem'`,
        [authResult.user.user_id]
      )

      const siemConfig = configResult.data?.[0]?.config || { format: body.format || "cef" }
      const sampleAlert = {
        id: 0,
        title: body.alert?.title || "Sample Alert",
        description: body.alert?.description || "This is a test event",
        severity: body.alert?.severity || "medium",
        item_type: body.alert?.item_type || "domain",
        item_value: body.alert?.item_value || "example.com",
      }

      const siemEvent = alertToSiemEvent(sampleAlert)
      const formatted = siemConfig.format === "leef" ? formatLeef(siemEvent) : formatCef(siemEvent)

      return NextResponse.json({
        format: siemConfig.format,
        formatted,
        event: siemEvent,
      })
    }

    return NextResponse.json({ error: "Invalid action. Use: save, preview" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process SIEM request" }, { status: 500 })
  }
}
