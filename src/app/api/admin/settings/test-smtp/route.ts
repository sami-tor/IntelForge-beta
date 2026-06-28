import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import nodemailer from "nodemailer"

interface SMTPSettings {
  host: string
  port: number
  username: string
  password: string
  sender: string
  senderName: string
  tlsEnabled: boolean
}

export async function POST(request: NextRequest) {
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
    const settings: SMTPSettings = body

    // Validate settings
    if (!settings.host || !settings.port || !settings.username || !settings.password) {
      return NextResponse.json(
        { error: "Missing required SMTP settings" },
        { status: 400 }
      )
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.tlsEnabled,
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    })

    // Send test email
    const result = await transporter.sendMail({
      from: `${settings.senderName} <${settings.sender}>`,
      to: authResult.user.email,
      subject: "Intel Forge SMTP Test",
      html: `
        <h2>SMTP Configuration Test</h2>
        <p>Hello ${authResult.user.email},</p>
        <p>This is a test email from Intel Forge to verify your SMTP settings are working correctly.</p>
        <p><strong>Test sent at:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, your SMTP configuration is working!</p>
        <hr>
        <p style="font-size: 12px; color: #999;">
          This is an automated test email from your Intel Forge admin panel.
        </p>
      `,
    })


    return NextResponse.json({
      success: true,
      message: "Test email sent successfully!",
      messageId: result.messageId,
    })
  } catch (error) {
    console.error("[Admin SMTP Test] Error:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send test email"

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.toString() : "Unknown error",
      },
      { status: 500 }
    )
  }
}
