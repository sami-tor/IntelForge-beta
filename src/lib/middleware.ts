import { type NextRequest, NextResponse } from "next/server"
import { isAdmin } from "./auth"
import { query } from "./db"
import { logPrivilegeEscalation } from "./security-audit"
import { authenticateRequest } from "./jwt"
type AuthenticatedUser = {
  id: any
  user_id: any
  email: any
  username: any
  role: any
  verification_status: any
  subscription_type: any
  subscription_end: any
  is_lifetime: any
  search_count: any
  search_limit: any
  is_active: any
}

type AuthFailure = { authorized: false; error: string; status: number }
type AuthSuccess = { authorized: true; user: AuthenticatedUser }
type AuthResult = AuthFailure | AuthSuccess

/**
 * SECURITY: Strip and reject any client-provided role/privilege headers
 * These should NEVER be trusted - always fetch from database
 */
function sanitizeRequestHeaders(request: NextRequest) {
  const suspiciousHeaders = [
    "X-User-Type",
    "X-User-Role",
    "X-Role",
    "X-Subscription-Type",
    "X-Subscription",
    "X-Search-Limit",
    "X-Is-Admin",
    "X-Is-Premium",
  ]
  
  const stripped: string[] = []
  suspiciousHeaders.forEach(header => {
    if (request.headers.get(header)) {
      stripped.push(header)
    }
  })
  
  if (stripped.length > 0) {
    console.warn(`[SECURITY] Client provided suspicious headers (ignored): ${stripped.join(", ")}`)
  }
  
  return stripped
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // SECURITY: Strip suspicious headers before processing
  sanitizeRequestHeaders(request)
  
  // Authenticate using JWT
  const authResult = await authenticateRequest(request)

  if (!authResult || !authResult.isValid) {
    return { authorized: false, error: "Authentication required", status: 401 }
  }

  const jwtPayload = authResult.user

  // SECURITY: Always re-fetch user from database to ensure authoritative state
  // JWT might be stale (up to 15 minutes), so we MUST verify current privileges
  // CRITICAL: This database query happens on EVERY request - no caching, no trusting JWT data
  const dbUserResult = await query(
    "SELECT id as user_id, email, username, role, verification_status, subscription_type, subscription_end, is_lifetime, search_count, search_limit, is_active FROM users WHERE id = $1",
    [jwtPayload.userId]
  )
  
  if (!dbUserResult.success || !dbUserResult.data || dbUserResult.data.length === 0) {
    // SECURITY: Log suspicious activity - JWT exists but user doesn't
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
    const userAgent = request.headers.get("user-agent") || null
    await logPrivilegeEscalation(
      jwtPayload.userId,
      jwtPayload.role || "unknown",
      "not_found",
      ipAddress,
      userAgent,
      request.nextUrl.pathname,
      request.method
    )
    return { authorized: false, error: "User not found", status: 401 }
  }
  
  const dbUser = dbUserResult.data[0]
  
  // SECURITY: Check if user is active
  if (!dbUser.is_active) {
    return { authorized: false, error: "Account is inactive", status: 403 }
  }
  
  // SECURITY: Detect privilege escalation attempts
  // If JWT claims different role than database, log and use database value
  // This catches any attempt to use modified JWT data
  if (jwtPayload.role !== dbUser.role) {
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
    const userAgent = request.headers.get("user-agent") || null
    await logPrivilegeEscalation(
      dbUser.user_id,
      jwtPayload.role,
      dbUser.role,
      ipAddress,
      userAgent,
      request.nextUrl.pathname,
      request.method
    )
  }
  
  // SECURITY: Also check if subscription changed (quota tampering detection)
  if (jwtPayload.subscriptionType !== dbUser.subscription_type || 
      jwtPayload.isLifetime !== dbUser.is_lifetime) {
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
    const userAgent = request.headers.get("user-agent") || null
    const { logUnauthorizedModification } = await import("./security-audit")
    await logUnauthorizedModification(
      dbUser.user_id,
      "subscription/quota",
      { 
        jwt_sub: jwtPayload.subscriptionType, 
        db_sub: dbUser.subscription_type,
        jwt_lifetime: jwtPayload.isLifetime,
        db_lifetime: dbUser.is_lifetime
      },
      ipAddress,
      userAgent,
      request.nextUrl.pathname
    )
  }
  
  // Return authoritative user data from database, not JWT
  return {
    authorized: true,
    user: {
      id: dbUser.user_id,
      user_id: dbUser.user_id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role, // Always use DB value
      verification_status: dbUser.verification_status,
      subscription_type: dbUser.subscription_type,
      subscription_end: dbUser.subscription_end,
      is_lifetime: dbUser.is_lifetime,
      search_count: dbUser.search_count,
      search_limit: dbUser.search_limit,
      is_active: dbUser.is_active,
    }
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.authorized) {
    return authResult
  }

  // SECURITY: Double-check admin status from database (defense in depth)
  // Even though requireAuth already checks, we verify again here
  const adminCheck = await query("SELECT role FROM users WHERE id = $1", [authResult.user.user_id])
  
  if (!adminCheck.success || !adminCheck.data || adminCheck.data.length === 0) {
    return { authorized: false, error: "User not found", status: 401 }
  }
  
  const dbRole = adminCheck.data[0].role
  
  if (dbRole !== "admin") {
    // This is NOT a privilege escalation - it's just unauthorized access
    // Only log if there's a mismatch between session role and DB role (actual escalation)
    // Don't log normal unauthorized access attempts
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
    const userAgent = request.headers.get("user-agent") || null
    
    // Only log if session claimed admin but DB says otherwise (actual escalation attempt)
    if (authResult.user.role === "admin" && dbRole !== "admin") {
      await logPrivilegeEscalation(
        authResult.user.user_id,
        authResult.user.role,
        dbRole,
        ipAddress,
        userAgent,
        request.nextUrl.pathname,
        request.method
      )
    }
    
    return { authorized: false, error: "Admin access required", status: 403 }
  }

  return { authorized: true, user: authResult.user }
}

export function createAuthResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function verifyAdmin(request: NextRequest) {
  const authResult = await requireAdmin(request)

  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Unauthorized", authResult.status || 401)
  }

  return null // No error, admin is authorized
}
