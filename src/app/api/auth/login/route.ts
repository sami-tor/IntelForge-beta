import { type NextRequest, NextResponse } from "next/server"
import { loginUser } from "@/lib/auth"
import { logLoginActivity, query } from "@/lib/db"
import { validateLoginInput } from "@/lib/validation"
import { 
  checkRateLimit, 
  getRateLimitIdentifier, 
  RATE_LIMITS, 
  sanitizeRequestBody,
  logSecurityEvent,
  isLoginLocked,
  recordLoginFailure,
  resetLoginFailures
} from "@/lib/security"
import { 
  generateAccessToken, 
  generateRefreshToken,
  getAccessTokenCookie,
  getRefreshTokenCookie,
  createFingerprint,
  getClientInfo
} from "@/lib/jwt"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitId = getRateLimitIdentifier(request, "login:")
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMITS.LOGIN_ATTEMPTS)
    
    if (!rateLimit.allowed) {
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      await logSecurityEvent("RATE_LIMIT_EXCEEDED", {
        endpoint: "/api/auth/login",
        remaining: rateLimit.remaining
      }, undefined, ipAddress)
      
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeRequestBody(rawBody)
    const { email, password } = body

    // Login lockout check (per IP + email)
    const ipKey = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const lockId = `${ipKey}:${String(email || "").toLowerCase()}`
    const lock = isLoginLocked(lockId)
    if (lock.locked) {
      await logSecurityEvent("LOGIN_LOCKED", { endpoint: "/api/auth/login" }, undefined, ipKey)
      return NextResponse.json({ error: "Account temporarily locked due to failures" }, { status: 429 })
    }

    // Validate login input
    const validation = validateLoginInput(email, password)
    if (!validation.valid) {
      // SECURITY: Don't log validation errors in production
      if (process.env.NODE_ENV === "development") {
      }
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }

    // SECURITY: Don't log email addresses in production
    if (process.env.NODE_ENV === "development") {
    }
    
    const result = await loginUser(email, password)

    if (!result.success) {
      // Log failed login attempt (without sensitive details)
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      await logSecurityEvent("LOGIN_FAILED", {
        // Don't log email in security events
        reason: "Invalid credentials"
      }, undefined, ipAddress)
      recordLoginFailure(lockId)
      
      return NextResponse.json({ error: result.error || "Login failed" }, { status: 401 })
    }

    const user = result.user
    
    // Check if user has 2FA enabled
    if (user.two_factor_enabled) {
      // SECURITY: Don't log user details in production
      if (process.env.NODE_ENV === "development") {
      }
      
      // SECURITY FIX: Create a temporary 2FA session token instead of returning userId
      // This prevents account takeover by modifying userId in the verify request
      const temp2FAToken = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
      
      // Store temporary 2FA session in database
      await query(
        `INSERT INTO two_factor_sessions (session_id, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (session_id) DO UPDATE SET user_id = $2, expires_at = $3`,
        [temp2FAToken, user.id, expiresAt]
      )
      
      // SECURITY: Determine HTTPS status before setting cookie
      const forwardedProto = request.headers.get("x-forwarded-proto")
      const isHttps = forwardedProto ? forwardedProto.includes("https") : request.nextUrl.protocol === "https:"
      
      const response = NextResponse.json({
        success: false,
        twoFactorRequired: true,
        temp2FAToken: temp2FAToken, // Return token, not userId
        message: "Please enter your 2FA code",
      }, { 
        status: 403,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        }
      })
      
      // Also set as httpOnly cookie for additional security
      response.cookies.set("pending_2fa_token", temp2FAToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "strict",
        path: "/",
        maxAge: 300, // 5 minutes
      })
      
      return response
    }
    
    // Get client info for JWT fingerprinting
    const { ipAddress, userAgent } = getClientInfo(request)
    const fingerprint = createFingerprint(ipAddress, userAgent)
    
    // Generate JWT tokens
    const accessToken = generateAccessToken(
      user.id,
      user.email,
      user.role || "user",
      user.subscription_type,
      user.is_lifetime || false,
      fingerprint
    )
    
    const refreshToken = generateRefreshToken(
      user.id,
      user.email,
      user.role || "user",
      fingerprint
    )
    
    resetLoginFailures(lockId)

    // Log login activity
    if (process.env.DATABASE_URL) {
      await logLoginActivity(user.id, ipAddress || "unknown", userAgent || "unknown")
    }

    // Get CSRF token
    const { getCSRFToken } = await import("@/lib/csrf")
    const csrfResult = await getCSRFToken(request)
    const csrfToken = csrfResult.token

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      csrfToken: csrfToken || undefined,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionType: user.subscription_type,
        isLifetime: user.is_lifetime,
      }
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Response-Validated": "true",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      }
    })

    // Set JWT tokens as HTTP-only cookies
    response.headers.set("Set-Cookie", getAccessTokenCookie(accessToken))
    response.headers.append("Set-Cookie", getRefreshTokenCookie(refreshToken))
    
    // Log successful login (without sensitive details)
    await logSecurityEvent("LOGIN_SUCCESS", {
      userId: user.id
    }, user.id, ipAddress || "unknown")

    return response
  } catch (error) {
    // SECURITY: Don't log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Login error:", error)
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
