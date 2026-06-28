import { type NextRequest, NextResponse } from "next/server"
import { registerUser, createSession } from "@/lib/auth"
import { sanitizeErrorMessage, isConstraintError } from "@/lib/error-sanitizer"
import { logUnauthorizedModification } from "@/lib/security-audit"
import { query } from "@/lib/db"
import { SECURE_COOKIE_OPTIONS } from "@/lib/security"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email: rawEmail, password, username, role, subscriptionType, subscription_type, isLifetime, is_lifetime, searchLimit, search_limit } = body

    // SECURITY: Reject any attempt to set role, subscription, or other privileged fields
    // These can ONLY be set by admins, never during registration
    const forbiddenFields: string[] = []
    if (role !== undefined) forbiddenFields.push("role")
    if (subscriptionType !== undefined || subscription_type !== undefined) forbiddenFields.push("subscription")
    if (isLifetime !== undefined || is_lifetime !== undefined) forbiddenFields.push("isLifetime")
    if (searchLimit !== undefined || search_limit !== undefined) forbiddenFields.push("searchLimit")

    if (forbiddenFields.length > 0) {
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
      const userAgent = request.headers.get("user-agent") || null
      await logUnauthorizedModification(
        0, // No user ID yet (registration attempt)
        `registration_attempt:${forbiddenFields.join(",")}`,
        body,
        ipAddress,
        userAgent,
        request.nextUrl.pathname
      )
      return NextResponse.json({ 
        error: "Invalid registration data. Please use the registration form." 
      }, { status: 400 })
    }

    if (!rawEmail || !password || !username) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let email = String(rawEmail)

    // SECURITY: Use validation function from lib/validation
    const { validateEmail, sanitizeEmail } = await import("@/lib/validation")
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }
    
    // Sanitize email
    try {
      const sanitizedEmail = sanitizeEmail(email)
      // Use sanitized email for registration
      email = sanitizedEmail
    } catch (e) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }
    
    // SECURITY: Use comprehensive password validation
    const { validatePassword, validateRegisterInput } = await import("@/lib/validation")
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json({ 
        error: passwordValidation.errors[0] || "Password does not meet requirements" 
      }, { status: 400 })
    }
    
    // Validate username using validation function (includes username format check)
    const usernameValidation = validateRegisterInput(email, password, username)
    if (!usernameValidation.valid) {
      // Filter out password and email errors (already validated above)
      const usernameErrors = usernameValidation.errors.filter(e => 
        !e.includes("Password") && !e.includes("email")
      )
      if (usernameErrors.length > 0) {
        return NextResponse.json({ error: usernameErrors[0] }, { status: 400 })
      }
    }

    const result = await registerUser(email, password, username)

    if (!result.success || !result.data || result.data.length === 0) {
      // SECURITY: Sanitize error messages - never expose database structure
      const userFriendlyError = sanitizeErrorMessage(result.error)
      return NextResponse.json({ error: userFriendlyError }, { status: 400 })
    }

    const user = result.data[0]
    
    // SECURITY: Verify user was created with correct default role (always "user")
    // Re-fetch from database to ensure no manipulation occurred
    const verifyUser = await query(
      "SELECT id, email, username, role, verification_status, subscription_type, is_lifetime, search_limit FROM users WHERE id = $1",
      [user.id]
    )
    
    if (!verifyUser.success || !verifyUser.data || verifyUser.data.length === 0) {
      return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 })
    }
    
    const dbUser = verifyUser.data[0]
    
    // SECURITY: Ensure role is always "user" for new registrations
    if (dbUser.role !== "user") {
      // Log security event - someone tried to register with non-user role
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
      const userAgent = request.headers.get("user-agent") || null
      await logUnauthorizedModification(
        dbUser.id,
        "role_manipulation_during_registration",
        { attempted_role: dbUser.role, corrected_to: "user" },
        ipAddress,
        userAgent,
        request.nextUrl.pathname
      )
      
      // Force correct role
      await query("UPDATE users SET role = 'user' WHERE id = $1", [dbUser.id])
      dbUser.role = "user"
    }
    
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const sessionResult = await createSession(dbUser.id, ipAddress, userAgent)

    if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    const session = sessionResult.data[0]
    const { getCSRFToken } = await import("@/lib/csrf")
    const csrfResult = await getCSRFToken(request)
    const csrfToken = csrfResult.token

    const response = NextResponse.json({
      success: true,
      message: "Registration successful",
      csrfToken: csrfToken || undefined
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-User-Data-Endpoint": "/api/auth/me",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      }
    })

    const forwardedProto = request.headers.get("x-forwarded-proto")
    const isHttps = forwardedProto ? forwardedProto.includes("https") : request.nextUrl.protocol === "https:"

    response.cookies.set("session_token", session.session_token, {
      ...SECURE_COOKIE_OPTIONS,
      secure: isHttps,
    })

    return response
  } catch (error) {
    // SECURITY: Don't log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Registration error:", error)
    }
    // SECURITY: Sanitize all error messages
    const userFriendlyError = sanitizeErrorMessage(error)
    return NextResponse.json({ error: userFriendlyError }, { status: 500 })
  }
}
