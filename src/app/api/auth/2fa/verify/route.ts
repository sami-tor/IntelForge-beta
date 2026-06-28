import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
import { verifyTwoFactorToken, hashBackupCodes } from "@/lib/2fa"
import { query } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { secret, token, backupCodes } = await request.json()

    if (!secret || !token || !backupCodes || backupCodes.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the token
    if (!verifyTwoFactorToken(secret, token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    const user = authResult.user
    if (process.env.NODE_ENV === "development") {
    }

    // Hash backup codes before storing
    const hashedCodes = hashBackupCodes(backupCodes)

    // Enable 2FA for user
    const sql = `
      UPDATE users 
      SET 
        two_factor_enabled = true,
        two_factor_secret = $1,
        two_factor_backup_codes = $2::text[]
      WHERE id = $3
      RETURNING id, email, two_factor_enabled
    `
    const result = await query(sql, [secret, hashedCodes, user.id])

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error("Failed to enable 2FA")
    }

    if (process.env.NODE_ENV === "development") {
    }

    return NextResponse.json({
      success: true,
      message: "2FA enabled successfully",
      user: result.data[0],
    })
  } catch (error) {
    console.error("[2FA] Verification error:", error)
    return NextResponse.json({ error: "Failed to verify 2FA" }, { status: 500 })
  }
}
