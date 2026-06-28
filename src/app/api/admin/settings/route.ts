import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { getDb } from "@/lib/db"

interface SMTPSettings {
  host: string
  port: number
  username: string
  password: string
  sender: string
  senderName: string
  tlsEnabled: boolean
}

interface SystemSettings {
  searchQuotaFree: number
  maxResultsPerFile: number
  maxTotalResults: number
  maintenanceMode: boolean
}

// In-memory cache for settings (in production, use database)
let cachedSettings = {
  smtp: {
    host: process.env.SMTP_HOST || "mail.osintsearch.online",
    port: parseInt(process.env.SMTP_PORT || "585"),
    username: process.env.SMTP_USER || "sender@osintsearch.online",
    password: process.env.SMTP_PASSWORD || "",
    sender: process.env.SMTP_SENDER || "sender@osintsearch.online",
    senderName: process.env.SMTP_SENDER_NAME || "Intel Forge",
    tlsEnabled: process.env.SMTP_TLS_ENABLED !== "false",
  },
  system: {
    searchQuotaFree: parseInt(process.env.SEARCH_QUOTA_FREE || "50"),
    maxResultsPerFile: parseInt(process.env.MAX_RESULTS_PER_FILE || "5"),
    maxTotalResults: parseInt(process.env.MAX_TOTAL_RESULTS || "10000"),
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  },
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(cachedSettings)
  } catch (error) {
    console.error("[Admin Settings] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { section, data } = body

    if (section === "smtp") {
      // Validate SMTP settings
      if (!data.host || !data.port || !data.username || !data.sender) {
        return NextResponse.json({ error: "Missing required SMTP fields" }, { status: 400 })
      }

      cachedSettings.smtp = data as SMTPSettings

      // Store in environment (in production, use database)
      process.env.SMTP_HOST = data.host
      process.env.SMTP_PORT = data.port.toString()
      process.env.SMTP_USER = data.username
      process.env.SMTP_PASSWORD = data.password
      process.env.SMTP_SENDER = data.sender
      process.env.SMTP_SENDER_NAME = data.senderName
      process.env.SMTP_TLS_ENABLED = data.tlsEnabled.toString()

      // Log admin action
      const db = getDb()
      await db.query(
        "INSERT INTO admin_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [authResult.user.user_id, "update_smtp_settings", "settings", JSON.stringify(data)]
      ).catch(() => null) // Ignore if table doesn't exist
    } else if (section === "system") {
      // Validate system settings
      if (
        typeof data.searchQuotaFree !== "number" ||
        typeof data.maxResultsPerFile !== "number" ||
        typeof data.maxTotalResults !== "number"
      ) {
        return NextResponse.json({ error: "Invalid system settings" }, { status: 400 })
      }

      cachedSettings.system = data as SystemSettings

      // Store in environment
      process.env.SEARCH_QUOTA_FREE = data.searchQuotaFree.toString()
      process.env.MAX_RESULTS_PER_FILE = data.maxResultsPerFile.toString()
      process.env.MAX_TOTAL_RESULTS = data.maxTotalResults.toString()
      process.env.MAINTENANCE_MODE = data.maintenanceMode.toString()

      // Log admin action
      const db = getDb()
      await db.query(
        "INSERT INTO admin_logs (admin_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [authResult.user.user_id, "update_system_settings", "settings", JSON.stringify(data)]
      ).catch(() => null) // Ignore if table doesn't exist
    } else {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    return NextResponse.json({ success: true, settings: cachedSettings })
  } catch (error) {
    console.error("[Admin Settings] PUT error:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
