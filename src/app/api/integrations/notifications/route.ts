import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { sendSlackNotification, sendTeamsNotification, buildAlertSlackMessage } from "@/lib/integrations/notifiers"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const result = await query(
    `SELECT * FROM integration_configs WHERE user_id = $1 AND integration_type IN ('slack', 'teams')`,
    [authResult.user.user_id]
  )

  const configs: Record<string, any> = {}
  for (const row of result.data || []) {
    configs[row.integration_type] = row
  }

  return NextResponse.json({ configs })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const { action, integration_type, webhookUrl, channel, username, title, themeColor, organization_id } = body

    if (action === "save") {
      if (!integration_type || !["slack", "teams"].includes(integration_type)) {
        return NextResponse.json({ error: "integration_type must be 'slack' or 'teams'" }, { status: 400 })
      }
      if (!webhookUrl) {
        return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 })
      }

      const config = integration_type === "slack"
        ? { webhookUrl, channel, username }
        : { webhookUrl, title, themeColor }

      const result = await query(
        `INSERT INTO integration_configs (user_id, organization_id, integration_type, name, config)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, integration_type)
         DO UPDATE SET config = $5, name = $4, organization_id = $2, updated_at = NOW()
         RETURNING *`,
        [authResult.user.user_id, organization_id || null, integration_type, body.name || integration_type, JSON.stringify(config)]
      )

      return NextResponse.json({ config: result.data?.[0] })
    }

    if (action === "test") {
      if (!integration_type || !["slack", "teams"].includes(integration_type)) {
        return NextResponse.json({ error: "integration_type must be 'slack' or 'teams'" }, { status: 400 })
      }

      const configResult = await query(
        `SELECT config FROM integration_configs WHERE user_id = $1 AND integration_type = $2`,
        [authResult.user.user_id, integration_type]
      )
      if (!configResult.data?.length) {
        return NextResponse.json({ error: "No configuration found for this type" }, { status: 404 })
      }

      const config = configResult.data[0].config
      const sampleAlert = {
        title: "Test Notification",
        severity: "medium",
        item_value: "test@example.com",
        item_type: "email",
        description: "This is a test notification from IntelForge.",
      }

      let success = false
      if (integration_type === "slack") {
        const { text, fields } = buildAlertSlackMessage(sampleAlert)
        success = await sendSlackNotification(text, fields, config)
      } else {
        success = await sendTeamsNotification(
          "Test Notification",
          "This is a test notification from IntelForge.",
          [
            { name: "Type", value: sampleAlert.item_type },
            { name: "Value", value: sampleAlert.item_value },
            { name: "Details", value: sampleAlert.description },
          ],
          config,
          "medium"
        )
      }

      if (success) {
        await query(
          `UPDATE integration_configs SET last_tested = NOW() WHERE user_id = $1 AND integration_type = $2`,
          [authResult.user.user_id, integration_type]
        )
      }

      return NextResponse.json({
        success,
        message: success ? "Test notification sent successfully" : "Failed to send test notification",
      })
    }

    return NextResponse.json({ error: "Invalid action. Use: save, test" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process notification request" }, { status: 500 })
  }
}
