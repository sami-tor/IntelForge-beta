import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { updateUserProfile, getUserPasswordHash, updateUserPassword } from "@/lib/db"
import { logUnauthorizedModification } from "@/lib/security-audit"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  const user = authResult.user
  return NextResponse.json({
    user: {
      id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      verificationStatus: user.verification_status,
      subscriptionType: user.subscription_type,
      subscriptionEnd: user.subscription_end,
      searchCount: user.search_count,
      searchLimit: user.search_limit,
      isLifetime: user.is_lifetime,
      isActive: user.is_active,
    },
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    }
  })
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  const body = await request.json()
  const csrfResult = await requireCSRF(request, body.csrfToken)
  if (!csrfResult.authorized) {
    return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
  }

  try {
    
    // SECURITY: Explicitly reject any attempts to modify role, subscription, or quota
    // These fields can ONLY be modified by admins through admin endpoints
    const forbiddenFields = ['role', 'subscription_type', 'subscriptionType', 'subscription_end', 
                            'subscriptionEnd', 'search_limit', 'searchLimit', 'search_count', 
                            'searchCount', 'is_lifetime', 'isLifetime', 'verification_status', 
                            'verificationStatus', 'is_active', 'isActive']
    
    for (const field of forbiddenFields) {
      if (field in body) {
        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
        const userAgent = request.headers.get("user-agent") || null
        await logUnauthorizedModification(
          authResult.user.user_id,
          field,
          body[field],
          ipAddress,
          userAgent,
          request.nextUrl.pathname
        )
        return NextResponse.json({ 
          error: `Field '${field}' cannot be modified through this endpoint. Admin access required.` 
        }, { 
          status: 403,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          }
        })
      }
    }
    
    const { email, username } = body

    if (!email || !username) {
      return NextResponse.json({ error: "Email and username are required" }, { status: 400 })
    }

    // SECURITY: Use validation functions from lib/validation
    const { validateEmail, sanitizeEmail } = await import("@/lib/validation")
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }
    
    // Sanitize email
    let sanitizedEmail: string
    try {
      sanitizedEmail = sanitizeEmail(email)
    } catch (e) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        error: "Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens" 
      }, { status: 400 })
    }

    const result = await updateUserProfile(authResult.user.user_id, sanitizedEmail.trim(), username.trim())

    if (!result.success || !result.data || result.data.length === 0) {
      return NextResponse.json({ error: result.error || "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: result.data[0] }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (error) {
    // SECURITY: Don't log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Profile update error:", error)
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
    }

    // SECURITY: Use comprehensive password validation
    const { validatePassword } = await import("@/lib/validation")
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: passwordValidation.errors[0] || "New password does not meet requirements" 
      }, { status: 400 })
    }

    const passwordResult = await getUserPasswordHash(authResult.user.user_id)
    if (!passwordResult.success || !passwordResult.data || passwordResult.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const storedHash = passwordResult.data[0].password_hash
    const matches = await bcrypt.compare(currentPassword, storedHash)

    if (!matches) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    const updateResult = await updateUserPassword(authResult.user.user_id, newPassword)
    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error || "Failed to update password" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (error) {
    // SECURITY: Don't log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Password update error:", error)
    }
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
  }
}
