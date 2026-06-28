import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { updateUserSubscription, logAdminAction } from "@/lib/admin-db"
import { query } from "@/lib/db"

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  const body = await request.json()
  const csrfResult = await requireCSRF(request, body.csrfToken)
  if (!csrfResult.authorized) {
    return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
  }

  try {
    const { userId, subscriptionType, durationValue, durationUnit, isLifetime } = body

    // SECURITY: Validate userId is a number
    const targetUserId = parseInt(userId)
    if (!targetUserId || isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // SECURITY: Validate subscription type
    const validSubscriptions = ["free", "starter", "professional", "enterprise", "api_access"]
    if (subscriptionType && !validSubscriptions.includes(subscriptionType.toLowerCase())) {
      return NextResponse.json({ error: "Invalid subscription type" }, { status: 400 })
    }

    // SECURITY: Verify the target user exists
    const userCheck = await query("SELECT id FROM users WHERE id = $1", [targetUserId])
    if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const result = await updateUserSubscription(targetUserId, subscriptionType, durationValue, durationUnit, isLifetime)

    if (!result.success) {
      return NextResponse.json({ error: "Failed to update user subscription" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, "update_user_subscription", "user", targetUserId, {
      subscriptionType,
      durationValue,
      durationUnit,
      isLifetime,
    })

    // SECURITY: Re-fetch user from database to return authoritative state
    const finalUserCheck = await query(
      "SELECT id, email, username, role, verification_status, subscription_type, is_lifetime, search_count, search_limit, is_active FROM users WHERE id = $1",
      [targetUserId]
    )
    
    if (!finalUserCheck.success || !finalUserCheck.data || finalUserCheck.data.length === 0) {
      return NextResponse.json({ error: "User not found after update" }, { status: 404 })
    }
    
    return NextResponse.json({ 
      success: true, 
      user: finalUserCheck.data[0] // Always from database
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Response-Validated": "true",
      }
    })
  } catch (error) {
    console.error("[v0] Admin user subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
