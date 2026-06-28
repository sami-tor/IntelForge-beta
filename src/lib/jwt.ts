/**
 * JWT Authentication System
 * 
 * SECURITY FEATURES:
 * - HTTP-only cookies (not accessible via JavaScript)
 * - Signed JWTs with HMAC SHA-512
 * - Access token (15 min) + Refresh token (7 days)
 * - Token fingerprinting (IP + User-Agent binding)
 * - Automatic token rotation on refresh
 * - XSS and CSRF protection
 */

import jwt from "jsonwebtoken"
import { createHash, randomBytes } from "crypto"
import { NextRequest } from "next/server"
import { ACCESS_SECRET, REFRESH_SECRET } from "./jwt-constants"
import { JWT_AUDIENCE, JWT_ISSUER, type JWTPayload } from "./jwt-types"

// ============================================================================
// SECRET KEY MANAGEMENT
// ============================================================================

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m" // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d" // 7 days

// ============================================================================
// DEVICE FINGERPRINTING
// ============================================================================

/**
 * Creates a device fingerprint from IP and User-Agent
 * This binds the token to the device that requested it
 */
export function createFingerprint(ipAddress: string | null, userAgent: string | null): string {
  const fingerprintData = `${ipAddress || "unknown"}:${userAgent || "unknown"}`
  return createHash("sha256").update(fingerprintData).digest("hex")
}

/**
 * Extracts client info from request
 */
export function getClientInfo(request: NextRequest): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress = 
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null

  const userAgent = request.headers.get("user-agent") || null

  return { ipAddress, userAgent }
}

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

/**
 * Generate Access Token (short-lived, 15 minutes)
 */
export function generateAccessToken(
  userId: number,
  email: string,
  role: string,
  subscriptionType: string | null,
  isLifetime: boolean,
  fingerprint: string
): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    subscriptionType: subscriptionType || "free",
    isLifetime,
    fingerprint,
    type: "access",
  }

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: "HS512", // Stronger than HS256
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

/**
 * Generate Refresh Token (long-lived, 7 days)
 */
export function generateRefreshToken(
  userId: number,
  email: string,
  role: string,
  fingerprint: string
): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    fingerprint,
    type: "refresh",
  }

  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: "HS512",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

// ============================================================================
// JWT TOKEN VERIFICATION
// ============================================================================

/**
 * Verify Access Token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      algorithms: ["HS512"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload

    if (decoded.type !== "access") {
      console.error("[JWT] Invalid token type for access token")
      return null
    }

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Only log in development - expired tokens are normal
      if (process.env.NODE_ENV === "development") {
      }
    } else if (error instanceof jwt.JsonWebTokenError) {
      // Only log in development - invalid tokens (old session tokens, etc.) are expected
      if (process.env.NODE_ENV === "development") {
        console.error("[JWT] Invalid access token:", error.message)
      }
    } else {
      // Only log unexpected errors
      console.error("[JWT] Access token verification failed:", error)
    }
    return null
  }
}

/**
 * Verify Refresh Token
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET, {
      algorithms: ["HS512"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload

    if (decoded.type !== "refresh") {
      console.error("[JWT] Invalid token type for refresh token")
      return null
    }

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error("[JWT] Invalid refresh token:", error.message)
    } else {
      console.error("[JWT] Refresh token verification failed:", error)
    }
    return null
  }
}

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

/**
 * Cookie configuration for maximum security
 */
export const COOKIE_CONFIG = {
  httpOnly: true, // Not accessible via JavaScript (XSS protection)
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax" as const, // CSRF protection
  path: "/",
  domain: process.env.COOKIE_DOMAIN || undefined, // Set in production for subdomain support
}

export const ACCESS_COOKIE_NAME = "access_token"
export const REFRESH_COOKIE_NAME = "refresh_token"

/**
 * Get cookie string for Set-Cookie header (Access Token)
 */
export function getAccessTokenCookie(token: string): string {
  const maxAge = 15 * 60 // 15 minutes in seconds
  
  return [
    `${ACCESS_COOKIE_NAME}=${token}`,
    `Path=${COOKIE_CONFIG.path}`,
    `Max-Age=${maxAge}`,
    COOKIE_CONFIG.httpOnly ? "HttpOnly" : "",
    COOKIE_CONFIG.secure ? "Secure" : "",
    `SameSite=${COOKIE_CONFIG.sameSite}`,
    COOKIE_CONFIG.domain ? `Domain=${COOKIE_CONFIG.domain}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}

/**
 * Get cookie string for Set-Cookie header (Refresh Token)
 */
export function getRefreshTokenCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  
  return [
    `${REFRESH_COOKIE_NAME}=${token}`,
    `Path=${COOKIE_CONFIG.path}`,
    `Max-Age=${maxAge}`,
    COOKIE_CONFIG.httpOnly ? "HttpOnly" : "",
    COOKIE_CONFIG.secure ? "Secure" : "",
    `SameSite=${COOKIE_CONFIG.sameSite}`,
    COOKIE_CONFIG.domain ? `Domain=${COOKIE_CONFIG.domain}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}

/**
 * Get cookie string to clear tokens (logout)
 */
export function getClearTokenCookies(): string[] {
  return [
    [
      `${ACCESS_COOKIE_NAME}=`,
      `Path=${COOKIE_CONFIG.path}`,
      `Max-Age=0`,
      COOKIE_CONFIG.httpOnly ? "HttpOnly" : "",
      COOKIE_CONFIG.secure ? "Secure" : "",
      `SameSite=${COOKIE_CONFIG.sameSite}`,
    ]
      .filter(Boolean)
      .join("; "),
    [
      `${REFRESH_COOKIE_NAME}=`,
      `Path=${COOKIE_CONFIG.path}`,
      `Max-Age=0`,
      COOKIE_CONFIG.httpOnly ? "HttpOnly" : "",
      COOKIE_CONFIG.secure ? "Secure" : "",
      `SameSite=${COOKIE_CONFIG.sameSite}`,
    ]
      .filter(Boolean)
      .join("; "),
  ]
}

// ============================================================================
// REQUEST TOKEN EXTRACTION
// ============================================================================

/**
 * Extract access token from cookies
 */
export function getAccessTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(ACCESS_COOKIE_NAME)?.value || null
}

/**
 * Extract refresh token from cookies
 */
export function getRefreshTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE_NAME)?.value || null
}

// ============================================================================
// COMPLETE JWT AUTHENTICATION
// ============================================================================

/**
 * Authenticate request and verify token fingerprint
 * Returns user info if valid, null otherwise
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: JWTPayload; isValid: boolean } | null> {
  const token = getAccessTokenFromRequest(request)
  
  if (!token) {
    return null
  }

  const payload = verifyAccessToken(token)
  
  if (!payload) {
    return null
  }

  // SECURITY: Verify fingerprint matches current request
  // Production rejects mismatches outright; development logs but allows to keep DX smooth
  const { ipAddress, userAgent } = getClientInfo(request)
  const currentFingerprint = createFingerprint(ipAddress, userAgent)

  if (payload.fingerprint !== currentFingerprint) {
    const details = {
      expected: payload.fingerprint,
      got: currentFingerprint,
      ipAddress,
      userAgent: userAgent?.substring(0, 50),
    }

    if (process.env.NODE_ENV === "production") {
      console.warn("[JWT] Token fingerprint mismatch detected - rejecting request", details)
      return null
    }

    console.warn("[JWT] Token fingerprint mismatch (development override)", details)
  }

  return { user: payload, isValid: true }
}

// ============================================================================
// TOKEN REFRESH MECHANISM
// ============================================================================

/**
 * Refresh access token using refresh token
 * Returns new tokens if successful, null otherwise
 */
export async function refreshAccessToken(
  request: NextRequest
): Promise<{ accessToken: string; refreshToken: string; user: JWTPayload } | null> {
  const refreshToken = getRefreshTokenFromRequest(request)
  
  if (!refreshToken) {
    return null
  }

  const payload = verifyRefreshToken(refreshToken)
  
  if (!payload) {
    return null
  }

  // SECURITY: Verify fingerprint
  const { ipAddress, userAgent } = getClientInfo(request)
  const currentFingerprint = createFingerprint(ipAddress, userAgent)

  if (payload.fingerprint !== currentFingerprint) {
    console.error("[JWT] Refresh token fingerprint mismatch")
    if (process.env.NODE_ENV === "production") {
      return null
    }
    console.warn("[JWT] Allowing fingerprint mismatch in development mode")
  }

  // Generate new tokens (token rotation)
  const newAccessToken = generateAccessToken(
    payload.userId,
    payload.email,
    payload.role,
    payload.subscriptionType || null,
    payload.isLifetime || false,
    currentFingerprint
  )

  const newRefreshToken = generateRefreshToken(
    payload.userId,
    payload.email,
    payload.role,
    currentFingerprint
  )

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: payload,
  }
}

// ============================================================================
// ADMIN-ONLY JWT SECRET GENERATION
// ============================================================================

/**
 * Generate a secure random secret (64 bytes = 128 hex chars)
 * This should ONLY be called by admins during initial setup
 */
export function generateSecureSecret(): string {
  return randomBytes(64).toString("hex")
}

// ============================================================================
// EXPORTS
// ============================================================================

export const JWT = {
  // Generation
  generateAccessToken,
  generateRefreshToken,
  
  // Verification
  verifyAccessToken,
  verifyRefreshToken,
  
  // Authentication
  authenticateRequest,
  refreshAccessToken,
  
  // Cookies
  getAccessTokenCookie,
  getRefreshTokenCookie,
  getClearTokenCookies,
  
  // Utilities
  createFingerprint,
  getClientInfo,
  generateSecureSecret,
}

export type { JWTPayload } from "./jwt-types"

