import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "./jwt"
import { generateCSRFToken, validateCSRFToken } from "./security"

async function getAuthenticatedSessionId(request: NextRequest): Promise<{ sessionId: string | null; error?: string }> {
  const auth = await authenticateRequest(request)
  if (!auth || !auth.isValid || !auth.user?.userId) {
    return { sessionId: null, error: "No session" }
  }

  const accessToken = request.cookies.get("access_token")?.value
  const refreshToken = request.cookies.get("refresh_token")?.value
  const tokenId = accessToken || refreshToken || String(auth.user.userId)
  return { sessionId: `${auth.user.userId}:${tokenId}` }
}

export async function getCSRFToken(request: NextRequest): Promise<{ token: string | null; error?: string }> {
  const session = await getAuthenticatedSessionId(request)
  if (!session.sessionId) {
    return { token: null, error: session.error || "No session" }
  }

  const token = generateCSRFToken(session.sessionId)
  return { token }
}

export async function validateCSRF(request: NextRequest, csrfTokenFromBody?: string): Promise<{ valid: boolean; error?: string }> {
  const session = await getAuthenticatedSessionId(request)
  if (!session.sessionId) {
    return { valid: false, error: session.error || "No session" }
  }

  // Get CSRF token from header (preferred) or from parameter
  const csrfToken = request.headers.get("X-CSRF-Token") ||
                    request.headers.get("X-XSRF-Token") ||
                    csrfTokenFromBody

  if (!csrfToken || typeof csrfToken !== "string") {
    return { valid: false, error: "Missing CSRF token" }
  }

  const isValid = validateCSRFToken(session.sessionId, csrfToken)

  if (!isValid) {
    return { valid: false, error: "Invalid CSRF token" }
  }

  return { valid: true }
}

export async function requireCSRF(request: NextRequest, csrfTokenFromBody?: string): Promise<{ authorized: boolean; error?: string; status?: number }> {
  // Only enforce CSRF on state-changing methods
  const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"]

  if (!stateChangingMethods.includes(request.method)) {
    return { authorized: true }
  }

  // Skip CSRF for certain endpoints that use their own authentication
  const pathname = request.nextUrl.pathname
  const skipCSRFPaths = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/admin-login",
    "/api/auth/logout",
    "/api/auth/2fa/verify-login", // Uses temporary 2FA token
  ]

  if (skipCSRFPaths.some(path => pathname.startsWith(path))) {
    return { authorized: true }
  }

  const validation = await validateCSRF(request, csrfTokenFromBody)

  if (!validation.valid) {
    return {
      authorized: false,
      error: validation.error || "CSRF token validation failed",
      status: 403
    }
  }

  return { authorized: true }
}

export function createCSRFResponse(error: string, status: number = 403): NextResponse {
  return NextResponse.json(
    { error, code: "CSRF_TOKEN_INVALID" },
    { status }
  )
}

