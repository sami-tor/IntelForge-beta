import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import {
  getAllUsers,
  getUsersCount,
  updateUserRole,
  updateUserVerification,
  updateUserStatus,
  deleteUser,
  updateUserSubscription,
} from "@/lib/admin-db"
import { logAdminAction } from "@/lib/admin-db"
import { logPrivilegeChange, logQuotaAnomaly } from "@/lib/security-audit"
import { addResponseSignature } from "@/lib/response-signing"
import { applySecurityHeaders } from "@/lib/security-headers"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const usersResult = await getAllUsers(page, limit)
    const countResult = await getUsersCount()

    if (!usersResult.success || !countResult.success) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    return NextResponse.json({
      users: usersResult.data,
      total: countResult.data?.[0]?.count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error("[v0] Admin users GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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
    const adminCheck = await query("SELECT role FROM users WHERE id = $1", [authResult.user.user_id])
    if (!adminCheck.success || !adminCheck.data || adminCheck.data.length === 0 || adminCheck.data[0].role !== "admin") {
      console.warn(`[SECURITY] User ${authResult.user.user_id} attempted admin action without admin role`)
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    const { userId, action, value } = body

    // SECURITY: Validate userId is a number
    const targetUserId = parseInt(userId)
    if (!targetUserId || isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // SECURITY: Prevent admin from modifying their own role (self-privilege escalation prevention)
    if (action === "role" && targetUserId === authResult.user.user_id) {
      return NextResponse.json({ error: "Cannot modify your own role" }, { status: 403 })
    }

    // SECURITY: Verify the target user exists
    const userCheck = await query("SELECT id, role FROM users WHERE id = $1", [targetUserId])
    if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let result
    if (action === "role") {
      // SECURITY: Validate role value to prevent injection
      const validRoles = ["user", "admin", "moderator"]
      if (!validRoles.includes(value)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
      }
      
      // Get old role before update for audit log
      const oldRole = userCheck.data[0].role
      
      result = await updateUserRole(targetUserId, value)
      
      // Log privilege change
      if (result.success) {
        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
        await logPrivilegeChange(
          authResult.user.user_id,
          targetUserId,
          "role",
          oldRole,
          value,
          ipAddress
        )
      }
    } else if (action === "verification") {
      result = await updateUserVerification(targetUserId, value)
    } else if (action === "status") {
      result = await updateUserStatus(targetUserId, value)
    } else if (action === "subscription") {
      // Handle subscription update
      const { subscriptionType, isLifetime, durationValue, durationUnit } = value
      // SECURITY: Validate subscription type
      const validSubscriptions = ["free", "starter", "professional", "enterprise", "api_access"]
      if (subscriptionType && !validSubscriptions.includes(subscriptionType.toLowerCase())) {
        return NextResponse.json({ error: "Invalid subscription type" }, { status: 400 })
      }
      
      // Get old subscription before update for audit log
      const oldSubQuery = await query("SELECT subscription_type, search_limit FROM users WHERE id = $1", [targetUserId])
      const oldSubscription = oldSubQuery.data?.[0]?.subscription_type || "free"
      const oldSearchLimit = oldSubQuery.data?.[0]?.search_limit || 50
      
      result = await updateUserSubscription(targetUserId, subscriptionType, durationValue, durationUnit, isLifetime)
      
      // Log privilege change
      if (result.success) {
        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
        const newSearchLimit = result.data?.[0]?.search_limit || 50
        
        await logPrivilegeChange(
          authResult.user.user_id,
          targetUserId,
          "subscription_type",
          oldSubscription,
          subscriptionType,
          ipAddress
        )
        
        // Log quota anomaly if suspicious jump
        if (newSearchLimit > oldSearchLimit * 2) {
          await logQuotaAnomaly(targetUserId, oldSearchLimit, newSearchLimit, ipAddress)
        }
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, `update_user_${action}`, "user", targetUserId, { action, value })

    // SECURITY: Re-fetch user from database to return authoritative state
    // This ensures response always reflects actual database state, not client-provided data
    const finalUserCheck = await query(
      "SELECT id, email, username, role, verification_status, subscription_type, is_lifetime, search_count, search_limit, is_active FROM users WHERE id = $1",
      [targetUserId]
    )
    
    if (!finalUserCheck.success || !finalUserCheck.data || finalUserCheck.data.length === 0) {
      return NextResponse.json({ error: "User not found after update" }, { status: 404 })
    }
    
    const responseData = {
      success: true,
      user: finalUserCheck.data[0], // Always from database
      action,
    }
    
    // SECURITY: Sign response to prevent tampering
    const signedResponse = addResponseSignature(responseData)
    
    const response = NextResponse.json(signedResponse)
    applySecurityHeaders(response, { sensitive: true })
    
    return response
  } catch (error) {
    console.error("[v0] Admin users PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const userId = Number.parseInt(searchParams.get("userId") || "0")

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // SECURITY: Prevent admin from deleting themselves
    if (userId === authResult.user.user_id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 })
    }

    const result = await deleteUser(userId)

    if (!result.success) {
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, "delete_user", "user", userId, {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Admin users DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
