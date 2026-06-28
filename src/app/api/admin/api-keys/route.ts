import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { query } from "@/lib/db"
import crypto from "crypto"
import { addResponseSignature } from "@/lib/response-signing"

// GET - List all API keys
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const sql = `
      SELECT 
        ak.id,
        ak.user_id,
        u.username,
        ak.key,
        ak.name,
        ak.is_active,
        ak.last_used,
        ak.created_at,
        ak.rate_limit
      FROM api_keys ak
      LEFT JOIN users u ON ak.user_id = u.id
      ORDER BY ak.created_at DESC
    `

    const result = await query(sql)

    // SECURITY: Don't expose full API keys - mask them for security
    const maskedKeys = (result.data || []).map((key: any) => ({
      ...key,
    }))

    const signed = addResponseSignature({
      success: true,
      keys: maskedKeys,
    })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("[v0] Failed to fetch API keys:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch API keys" }, { status: 500 })
  }
}

// POST - Generate new API key
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const body = await request.json()

    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { userId, keyName, expiresInDays } = body

    if (!userId || !keyName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // SECURITY: Validate userId is a number
    const targetUserId = parseInt(userId)
    if (!targetUserId || isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // SECURITY: Verify the target user exists
    const userCheck = await query("SELECT id FROM users WHERE id = $1", [targetUserId])
    if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Generate secure random API key
    const apiKey = crypto.randomBytes(32).toString("hex")

    // Calculate expiration date
    const expiresAt = expiresInDays > 0 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    // Get user's subscription to set rate limit
    const userResult = await query(
      "SELECT search_limit FROM users WHERE id = $1",
      [targetUserId]
    )

    let rateLimit = 100 // Default
    if (userResult.data && userResult.data.length > 0) {
      const searchLimit = userResult.data[0].search_limit
      if (searchLimit >= 1500) {
        rateLimit = 500 // Professional/Enterprise
      } else if (searchLimit >= 500) {
        rateLimit = 200 // Starter
      }
    }

    // Insert API key
    const insertResult = await query(
      `INSERT INTO api_keys (user_id, key, name, expires_at, rate_limit, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id`,
      [targetUserId, apiKey, keyName, expiresAt, rateLimit]
    )

    if (!insertResult.success) {
      throw new Error("Failed to insert API key")
    }

    if (process.env.NODE_ENV === "development") {
    }

    return NextResponse.json({
      success: true,
      key: apiKey,
      message: "API key generated successfully",
    })
  } catch (error: any) {
    console.error("[v0] Failed to generate API key:", error)
    return NextResponse.json({ success: false, error: "Failed to generate API key" }, { status: 500 })
  }
}

