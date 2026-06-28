import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { deleteAISettings, defaultModelForProvider, getAISettings, isValidProvider, saveAISettings } from "@/lib/ai-settings"

function safeSettings(settings: Awaited<ReturnType<typeof getAISettings>>) {
  if (!settings) return null
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    enabled: settings.enabled,
    hasApiKey: true,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return createAuthResponse(auth.error, auth.status)

  try {
    const settings = await getAISettings(auth.user.user_id)
    return NextResponse.json({ success: true, settings: safeSettings(settings) }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load AI settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return createAuthResponse(auth.error, auth.status)

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)

    const provider = String(body.provider || "openai").toLowerCase()
    if (!isValidProvider(provider)) {
      return NextResponse.json({ success: false, error: "Unsupported AI provider" }, { status: 400 })
    }

    const apiKey = String(body.apiKey || "").trim()
    if (!apiKey || apiKey.length < 8 || apiKey.length > 500) {
      return NextResponse.json({ success: false, error: "Valid API key is required" }, { status: 400 })
    }

    const model = String(body.model || defaultModelForProvider(provider)).trim().slice(0, 120)
    const baseUrl = body.baseUrl ? String(body.baseUrl).trim().slice(0, 500) : null

    if (provider === "custom" && !baseUrl) {
      return NextResponse.json({ success: false, error: "Custom provider requires base URL" }, { status: 400 })
    }

    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl)
        if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol")
      } catch {
        return NextResponse.json({ success: false, error: "Invalid base URL" }, { status: 400 })
      }
    }

    const result = await saveAISettings(auth.user.user_id, {
      provider,
      model,
      apiKey,
      baseUrl,
      enabled: body.enabled !== false,
    })

    if (!result.success) throw new Error("save failed")

    return NextResponse.json({
      success: true,
      settings: {
        provider,
        model,
        baseUrl,
        enabled: body.enabled !== false,
        hasApiKey: true,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Failed to save AI settings" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return createAuthResponse(auth.error, auth.status)

  try {
    const body = await request.json().catch(() => ({}))
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)

    await deleteAISettings(auth.user.user_id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete AI settings" }, { status: 500 })
  }
}
