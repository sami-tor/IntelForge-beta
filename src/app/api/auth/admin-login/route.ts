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
import { logUnauthorizedAccess } from "@/lib/security-audit"
import { 
  generateAccessToken, 
  generateRefreshToken,
  createFingerprint,
  getClientInfo,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME
} from "@/lib/jwt"
import crypto from "crypto"

/**
 * SECURITY: Admin-only login endpoint
 * This endpoint ONLY allows users with role='admin' to login
 * All other users (premium, enterprise, free, etc.) are rejected
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check (stricter for admin login)
    const rateLimitId = getRateLimitIdentifier(request, "admin-login:")
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMITS.LOGIN_ATTEMPTS)
    
    if (!rateLimit.allowed) {
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      await logSecurityEvent("RATE_LIMIT_EXCEEDED", {
        endpoint: "/api/auth/admin-login",
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

    const ipKey = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
    const lockId = `${ipKey}:${String(email || "").toLowerCase()}`
    const lock = isLoginLocked(lockId)
    if (lock.locked) {
      await logSecurityEvent("LOGIN_LOCKED", { endpoint: "/api/auth/admin-login" }, undefined, ipKey)
      return NextResponse.json({ error: "Account temporarily locked due to failures" }, { status: 429 })
    }

    // Validate login input
    const validation = validateLoginInput(email, password)
    if (!validation.valid) {
      
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }
    
    const result = await loginUser(email, password)

    if (!result.success) {
      // Log failed login attempt
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      await logSecurityEvent("LOGIN_FAILED", {
        endpoint: "/api/auth/admin-login",
        reason: "Invalid credentials"
      }, undefined, ipAddress)
      recordLoginFailure(lockId)
      
      return NextResponse.json({ error: result.error || "Login failed" }, { status: 401 })
    }

    const user = result.user
    
    // SECURITY: CRITICAL - Verify user is admin BEFORE creating session
    // Fetch fresh user data from database to ensure role is correct
    const userCheck = await query(
      "SELECT id, email, username, role, is_active FROM users WHERE id = $1",
      [user.id]
    )
    
    if (!userCheck.success || !userCheck.data || userCheck.data.length === 0) {
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      await logUnauthorizedAccess(
        user.id,
        "/api/auth/admin-login",
        "POST",
        ipAddress,
        request.headers.get("user-agent"),
        "User not found after login"
      )
      return NextResponse.json({ error: "Login failed" }, { status: 401 })
    }
    
    const dbUser = userCheck.data[0]
    
    // SECURITY: STRICT CHECK - Only allow users with role='admin'
    // Premium, Enterprise, Free, or any other role is REJECTED
    if (dbUser.role !== 'admin') {
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      const userAgent = request.headers.get("user-agent") || "unknown"
      
      // Log unauthorized admin login attempt
      await logUnauthorizedAccess(
        dbUser.id,
        "/api/auth/admin-login",
        "POST",
        ipAddress,
        userAgent,
        `Non-admin user (role: ${dbUser.role}) attempted admin login`
      )
      
      // Log security event
      await logSecurityEvent("UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT", {
        userId: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        endpoint: "/api/auth/admin-login"
      }, dbUser.id, ipAddress)
      
      // Return generic error (don't reveal that user exists)
      return NextResponse.json({ 
        error: "Access denied. Admin credentials required." 
      }, { status: 403 })
    }
    
    // User is confirmed admin, proceed with session creation
    
    // Check if user has 2FA enabled
    if (user.two_factor_enabled) {
      
      
      // Create temporary 2FA session token
      const temp2FAToken = crypto.randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
      
      // Store temporary 2FA session in database
      await query(
        `INSERT INTO two_factor_sessions (session_id, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (session_id) DO UPDATE SET user_id = $2, expires_at = $3`,
        [temp2FAToken, user.id, expiresAt]
      )
      
      const forwardedProto = request.headers.get("x-forwarded-proto")
      const isHttps = forwardedProto ? forwardedProto.includes("https") : request.nextUrl.protocol === "https:"
      
      const response = NextResponse.json({
        success: false,
        twoFactorRequired: true,
        temp2FAToken: temp2FAToken,
        message: "Please enter your 2FA code",
      }, { 
        status: 403,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        }
      })
      
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
      user.role || "admin",
      user.subscription_type,
      user.is_lifetime || false,
      fingerprint
    )
    
    const refreshToken = generateRefreshToken(
      user.id,
      user.email,
      user.role || "admin",
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
      message: "Admin login successful",
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
        "X-User-Data-Endpoint": "/api/auth/me",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      }
    })

    // Set JWT tokens as HTTP-only cookies using Next.js cookie API
    // CRITICAL: For HTTP (port 80), secure must be false, otherwise cookies won't be set
    const forwardedProto = request.headers.get("x-forwarded-proto")
    const protocol = request.nextUrl.protocol
    const isHttps = forwardedProto ? forwardedProto.includes("https") : protocol === "https:"
    
    // In development or when running on HTTP, don't use secure flag
    const useSecure = isHttps && process.env.NODE_ENV === "production"
    
    
    response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: useSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    
    response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: useSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      domain: process.env.COOKIE_DOMAIN || undefined,
    })
    
    // Log successful admin login
    await logSecurityEvent("ADMIN_LOGIN_SUCCESS", {
      userId: user.id,
      endpoint: "/api/auth/admin-login"
    }, user.id, ipAddress || undefined)

    return response
  } catch (error) {
    
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}

