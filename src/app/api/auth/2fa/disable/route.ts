import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/middleware"
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

    // Disable 2FA for user
    const sql = `
      UPDATE users 
      SET 
        two_factor_enabled = false,
        two_factor_secret = NULL,
        two_factor_backup_codes = NULL
      WHERE id = $1
      RETURNING id, email, two_factor_enabled
    `
    const result = await query(sql, [user.id])

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error("Failed to disable 2FA")
    }

    if (process.env.NODE_ENV === "development") {
    }

    return NextResponse.json({
      success: true,
      message: "2FA disabled successfully",
      user: result.data[0],
    })
  } catch (error) {
    console.error("[2FA] Disable error:", error)
    return NextResponse.json({ error: "Failed to disable 2FA" }, { status: 500 })
  }
}
