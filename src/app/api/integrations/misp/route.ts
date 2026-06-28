import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { query } from "@/lib/db"
import { testMispConnection, pushToMisp, createMispEventFromAlert, type MispConfig } from "@/lib/integrations/misp-connector"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const result = await query(
    `SELECT * FROM integration_configs WHERE user_id = $1 AND integration_type = 'misp'`,
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
      const { baseUrl, apiKey, verifySsl, defaultTags, autoPublish, sharingGroupId, organization_id } = body
      if (!baseUrl || !apiKey) {
        return NextResponse.json({ error: "baseUrl and apiKey are required" }, { status: 400 })
      }

      const config = { baseUrl, apiKey, verifySsl: verifySsl !== false, defaultTags: defaultTags || [], autoPublish: autoPublish || false, sharingGroupId }

      const result = await query(
        `INSERT INTO integration_configs (user_id, organization_id, integration_type, name, config)
         VALUES ($1, $2, 'misp', $3, $4)
         ON CONFLICT (user_id, integration_type)
         DO UPDATE SET config = $4, name = $3, organization_id = $2, updated_at = NOW()
         RETURNING *`,
        [authResult.user.user_id, organization_id || null, body.name || "MISP", JSON.stringify(config)]
      )

      return NextResponse.json({ config: result.data?.[0] })
    }

    if (action === "test") {
      const configResult = await query(
        `SELECT config FROM integration_configs WHERE user_id = $1 AND integration_type = 'misp'`,
        [authResult.user.user_id]
      )
      if (!configResult.data?.length) {
        return NextResponse.json({ error: "No MISP configuration found" }, { status: 404 })
      }

      const mispConfig = configResult.data[0].config as MispConfig
      const testResult = await testMispConnection(mispConfig)

      await query(
        `UPDATE integration_configs SET last_tested = NOW() WHERE user_id = $1 AND integration_type = 'misp'`,
        [authResult.user.user_id]
      )

      return NextResponse.json(testResult)
    }

    if (action === "push_alert") {
      const configResult = await query(
        `SELECT config FROM integration_configs WHERE user_id = $1 AND integration_type = 'misp'`,
        [authResult.user.user_id]
      )
      if (!configResult.data?.length) {
        return NextResponse.json({ error: "No MISP configuration found" }, { status: 404 })
      }

      const mispConfig = configResult.data[0].config as MispConfig
      const event = createMispEventFromAlert(body.alert, mispConfig)
      const pushResult = await pushToMisp(event, mispConfig)

      return NextResponse.json(pushResult)
    }

    return NextResponse.json({ error: "Invalid action. Use: save, test, push_alert" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process MISP request" }, { status: 500 })
  }
}
