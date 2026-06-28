import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { generateTwoFactorSecret } from "@/lib/2fa"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    if (process.env.NODE_ENV === "development") {
    }

    // Generate secret and QR code
    const { secret, backupCodes, qrCode, otpauth_url } = await generateTwoFactorSecret(user.email)

    // Don't save to DB yet - user must verify first
    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      backupCodes, // Show backup codes once
      message: "Scan QR code with Google Authenticator or similar app",
    })
  } catch (error) {
    console.error("[2FA] Setup error:", error)
    return NextResponse.json({ error: "Failed to setup 2FA" }, { status: 500 })
  }
}
