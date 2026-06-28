import { NextRequest, NextResponse } from "next/server"
import { verifyTwoFactorToken, verifyHashedBackupCode } from "@/lib/2fa"
import { createSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { SECURE_COOKIE_OPTIONS } from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    const { token, temp2FAToken } = await request.json()

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    // SECURITY FIX: Never trust userId from request body - this allows account takeover!
    // Instead, get userId from temporary 2FA session token (set during login)
    let userId: number | null = null
    
    // Try to get token from request body first
    let sessionToken = temp2FAToken
    
    // Fallback: Check for pending 2FA token in cookies (more secure)
    if (!sessionToken) {
      sessionToken = request.cookies.get("pending_2fa_token")?.value || null
    }

    if (!sessionToken) {
      return NextResponse.json({ error: "No pending 2FA session found. Please login again." }, { status: 400 })
    }

    // Get userId from temporary 2FA session (stored server-side during login)
    const sessionResult = await query(
      "SELECT user_id FROM two_factor_sessions WHERE session_id = $1 AND expires_at > NOW()",
      [sessionToken]
    )
    
    if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
      return NextResponse.json({ error: "Invalid or expired 2FA session. Please login again." }, { status: 400 })
    }
    
    userId = sessionResult.data[0].user_id

    // Get user with 2FA secret
    const userResult = await query(
      "SELECT id, email, two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1 AND two_factor_enabled = true",
      [userId]
    )

    if (!userResult.success || !userResult.data || userResult.data.length === 0) {
      return NextResponse.json({ error: "2FA not enabled for user" }, { status: 400 })
    }

    const user = userResult.data[0]
    let isValidToken = false

    // Check if token is a TOTP code
    if (token.length === 6 && /^\d+$/.test(token)) {
      isValidToken = verifyTwoFactorToken(user.two_factor_secret, token)
    }
    // Check if token is a backup code
    else if (!isValidToken && user.two_factor_backup_codes && user.two_factor_backup_codes.length > 0) {
      isValidToken = verifyHashedBackupCode(token, user.two_factor_backup_codes)
      if (isValidToken) {
        // Remove used backup code
        const filteredCodes = user.two_factor_backup_codes.filter(
          (code: string) => code !== Buffer.from(token.toUpperCase()).toString("base64")
        )
        await query(
          "UPDATE users SET two_factor_backup_codes = $1::text[] WHERE id = $2",
          [filteredCodes, userId]
        )
        if (process.env.NODE_ENV === "development") {
        }
      }
    }

    if (!isValidToken) {
      console.warn("[2FA] Invalid token for user:", userId)
      return NextResponse.json({ error: "Invalid 2FA token" }, { status: 401 })
    }

    if (process.env.NODE_ENV === "development") {
    }

    // SECURITY: Delete the temporary 2FA session after successful verification
    await query(
      "DELETE FROM two_factor_sessions WHERE session_id = $1",
      [sessionToken]
    )

    // Create session
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const createSessionResult = await createSession(user.id, ipAddress, userAgent)

    if (!createSessionResult.success || !createSessionResult.data || createSessionResult.data.length === 0) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    const session = createSessionResult.data[0]
    const response = NextResponse.json({
      success: true,
      message: "2FA verification successful",
    })

    // Clear the pending 2FA cookie
    response.cookies.delete("pending_2fa_token")
    
    const forwardedProto = request.headers.get("x-forwarded-proto")
    const isHttps = forwardedProto ? forwardedProto.includes("https") : request.nextUrl.protocol === "https:"

    response.cookies.set("session_token", session.session_token, {
      ...SECURE_COOKIE_OPTIONS,
      secure: isHttps,
    })

    return response
  } catch (error) {
    console.error("[2FA] Login verification error:", error)
    return NextResponse.json({ error: "2FA verification failed" }, { status: 500 })
  }
}
