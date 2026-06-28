import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"
import { canGenerateAPIKeys } from "@/lib/roles"
import crypto from "crypto"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { addResponseSignature } from "@/lib/response-signing"

// GET - List user's own API keys
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized || !authResult.user) {
      return createAuthResponse("Authentication required", 401)
    }
    
    const user = authResult.user

    // Check if user can access API keys (Admin or Premium)
    if (!canGenerateAPIKeys(user)) {
      return NextResponse.json({ 
        success: false, 
        error: "API keys are only available for admin and premium users" 
      }, { status: 403 })
    }

    const sql = `
      SELECT 
        id,
        name,
        is_active,
        last_used,
        created_at,
        expires_at,
        rate_limit
      FROM api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC
    `

    const result = await query(sql, [user.id])

    const signed = addResponseSignature({
      success: true,
      keys: result.data || [],
    })
    return NextResponse.json(signed)
  } catch (error: any) {
    console.error("[v0] Failed to fetch user API keys:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch API keys" }, { status: 500 })
  }
}

// POST - Generate new API key for user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized || !authResult.user) {
      return createAuthResponse("Authentication required", 401)
    }
    
    const user = authResult.user

    // Check if user can generate API keys (Admin or Premium)
    if (!canGenerateAPIKeys(user)) {
      return NextResponse.json({ 
        success: false, 
        error: "API keys are only available for admin and premium users" 
      }, { status: 403 })
    }

    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { keyName, expiresInDays } = body

    if (!keyName) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 })
    }

    // Check key limit (max 5 keys per user)
    const countResult = await query(
      "SELECT COUNT(*) as count FROM api_keys WHERE user_id = $1 AND is_active = true",
      [user.id]
    )

    const keyCount = countResult.data?.[0]?.count || 0
    if (keyCount >= 5) {
      return NextResponse.json({ 
        error: "Maximum of 5 active API keys allowed" 
      }, { status: 400 })
    }

    // Generate secure random API key
    const apiKey = crypto.randomBytes(32).toString("hex")
    const { hashToken } = await import("@/lib/security")
    const apiKeyHash = hashToken(apiKey)

    // Calculate expiration date (default 1 year)
    const daysToExpire = expiresInDays || 365
    const expiresAt = new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000)

    // Set rate limit based on role and subscription
    let rateLimit = 100
    
    // Admin gets highest rate limit
    if (user.role === "admin") {
      rateLimit = 1000
    } else if (user.search_limit >= 1500) {
      rateLimit = 500 // Professional/Enterprise
    } else if (user.search_limit >= 500) {
      rateLimit = 200 // Starter
    }

    // Insert API key (store hash)
    const insertResult = await query(
      `INSERT INTO api_keys (user_id, key, name, expires_at, rate_limit, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id`,
      [user.id, apiKeyHash, keyName, expiresAt, rateLimit]
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

// DELETE - Revoke user's own API key
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized || !authResult.user) {
      return createAuthResponse("Authentication required", 401)
    }
    
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const keyId = parseInt(searchParams.get("id") || "0")
    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 })
    }

    // Revoke the API key (only if it belongs to the user)
    const result = await query(
      "UPDATE api_keys SET is_active = false WHERE id = $1 AND user_id = $2",
      [keyId, user.id]
    )

    if (!result.success) {
      throw new Error("Failed to revoke API key")
    }

    if (process.env.NODE_ENV === "development") {
    }

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    })
  } catch (error: any) {
    console.error("[v0] Failed to revoke API key:", error)
    return NextResponse.json({ success: false, error: "Failed to revoke API key" }, { status: 500 })
  }
}

