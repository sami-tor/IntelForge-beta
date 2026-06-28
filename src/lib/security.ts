import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "./auth"

// ============================================
// SESSION SECURITY
// ============================================

export interface SecureSessionOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: "strict" | "lax" | "none"
  maxAge: number
  path: string
}

export const SECURE_COOKIE_OPTIONS: SecureSessionOptions = {
  httpOnly: true, // Prevent XSS
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict", // CSRF protection
  maxAge: 7 * 24 * 60 * 60, // 7 days
  path: "/",
}

// Lazy import crypto only when needed (not in Edge Runtime)
function getCrypto() {
  // Only import in Node.js runtime, not Edge Runtime
  // Check for Node.js runtime by trying to require crypto
  try {
    return require("crypto")
  } catch {
    throw new Error("crypto module not available in Edge Runtime")
  }
}

export function generateSecureToken(length: number = 32): string {
  const crypto = getCrypto()
  return crypto.randomBytes(length).toString("hex")
}

export function hashToken(token: string): string {
  const crypto = getCrypto()
  return crypto.createHash("sha256").update(token).digest("hex")
}

// ============================================
// CSRF PROTECTION
// ============================================

const csrfTokens = new Map<string, { token: string; expires: number }>()

export function generateCSRFToken(sessionId: string): string {
  const token = generateSecureToken(32)
  const expires = Date.now() + 60 * 60 * 1000 // 1 hour
  
  csrfTokens.set(sessionId, { token, expires })
  
  // Clean expired tokens
  cleanExpiredCSRFTokens()
  
  return token
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId)
  
  if (!stored) return false
  if (stored.expires < Date.now()) {
    csrfTokens.delete(sessionId)
    return false
  }
  
  return stored.token === token
}

function cleanExpiredCSRFTokens() {
  const now = Date.now()
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (data.expires < now) {
      csrfTokens.delete(sessionId)
    }
  }
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

export const RATE_LIMITS = {
  // Anonymous users
  ANONYMOUS_SEARCH: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  ANONYMOUS_API: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 per minute
  
  // Authenticated users
  AUTH_SEARCH: { windowMs: 60 * 1000, maxRequests: 50 }, // 50 per minute
  AUTH_API: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 per minute
  
  // Login attempts
  LOGIN_ATTEMPTS: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 per 15 minutes
  
  // Admin endpoints
  ADMIN_ACTIONS: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 per minute
  
  // API keys
  API_KEY_GENERATION: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  
  // Get or create entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)
  }
  
  // Increment count
  entry.count++
  
  const allowed = entry.count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - entry.count)
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  }
}

export function getRateLimitIdentifier(request: NextRequest, prefix: string = ""): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
              request.headers.get("x-real-ip") || 
              request.headers.get("cf-connecting-ip") ||
              "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  const sessionToken = request.cookies.get("session_token")?.value || ""

  const identifier = `${ip}:${userAgent}:${sessionToken.substring(0, 16)}`

  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${prefix}${hashHex}`
}

// Login failure lockout (in-memory)
type LockEntry = { count: number; resetTime: number }
const loginLockStore = new Map<string, LockEntry>()

export function isLoginLocked(identifier: string, windowMs: number = 15 * 60 * 1000, maxFailures: number = 5): { locked: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  let entry = loginLockStore.get(identifier)
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs }
    loginLockStore.set(identifier, entry)
  }
  const locked = entry.count >= maxFailures
  const remaining = Math.max(0, maxFailures - entry.count)
  return { locked, remaining, resetTime: entry.resetTime }
}

export function recordLoginFailure(identifier: string, windowMs: number = 15 * 60 * 1000): void {
  const now = Date.now()
  let entry = loginLockStore.get(identifier)
  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs }
    loginLockStore.set(identifier, entry)
  }
  entry.count++
}

export function resetLoginFailures(identifier: string): void {
  loginLockStore.delete(identifier)
}

// ============================================
// ADMIN AUTHORIZATION
// ============================================
// NOTE: These functions are DEPRECATED - use lib/middleware.ts instead
// lib/middleware.ts has proper database re-fetching and security checks
// These are kept for backward compatibility but should not be used in new code

/**
 * @deprecated Use requireAdmin from lib/middleware.ts instead
 * This version does not re-fetch from database and is less secure
 */
export async function requireAdmin(request: NextRequest) {
  console.warn("[SECURITY] Using deprecated requireAdmin from lib/security.ts - use lib/middleware.ts instead")
  const user = await verifyAuth(request)
  
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized - Please log in" },
      { status: 401 }
    )
  }
  
  // SECURITY WARNING: This does not re-fetch from database
  // Use lib/middleware.ts requireAdmin for proper security
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    )
  }
  
  return { user }
}

/**
 * @deprecated Use requireAuth from lib/middleware.ts instead
 * This version does not re-fetch from database and is less secure
 */
export async function requireAuth(request: NextRequest) {
  console.warn("[SECURITY] Using deprecated requireAuth from lib/security.ts - use lib/middleware.ts instead")
  const user = await verifyAuth(request)
  
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized - Please log in" },
      { status: 401 }
    )
  }
  
  // SECURITY WARNING: This does not re-fetch from database
  // Use lib/middleware.ts requireAuth for proper security
  if (!user.isActive) {
    return NextResponse.json(
      { error: "Account is inactive" },
      { status: 403 }
    )
  }
  
  return { user }
}

// ============================================
// API KEY VALIDATION
// ============================================

export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; userId?: number; rateLimit?: number; error?: string }> {
  try {
    // Query database for API key
    const { query } = await import("./db")
    const hashed = hashToken(apiKey)
    const result = await query(
      `SELECT ak.*, u.is_active as user_active, u.subscription_type
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key = $1 AND ak.is_active = true`,
      [hashed]
    )
    
    if (!result.success || !result.data || result.data.length === 0) {
      const fallback = await query(
        `SELECT ak.*, u.is_active as user_active, u.subscription_type
         FROM api_keys ak
         JOIN users u ON ak.user_id = u.id
         WHERE ak.key = $1 AND ak.is_active = true`,
        [apiKey]
      )
      if (!fallback.success || !fallback.data || fallback.data.length === 0) {
        return { valid: false, error: "Invalid API key" }
      }
      const keyData = fallback.data[0]
      await query(
        "UPDATE api_keys SET key = $1 WHERE id = $2",
        [hashed, keyData.id]
      ).catch(() => {})
      return {
        valid: true,
        userId: keyData.user_id,
        rateLimit: keyData.rate_limit || 100,
      }
    }
    
    const keyData = result.data[0]
    
    // Check if user is active
    if (!keyData.user_active) {
      return { valid: false, error: "User account is inactive" }
    }
    
    // Check expiration
    if (keyData.expires_at) {
      const expiresAt = new Date(keyData.expires_at)
      if (expiresAt < new Date()) {
        return { valid: false, error: "API key expired" }
      }
    }
    
    // Update last used timestamp
    await query(
      "UPDATE api_keys SET last_used = NOW() WHERE id = $1",
      [keyData.id]
    )
    
    return {
      valid: true,
      userId: keyData.user_id,
      rateLimit: keyData.rate_limit || 100,
    }
  } catch (error) {
    console.error("[SECURITY] API key validation error:", error)
    return { valid: false, error: "Validation failed" }
  }
}

// ============================================
// REQUEST VALIDATION
// ============================================

export function validateHeaders(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type")
  const origin = request.headers.get("origin")
  
  // Check Content-Type for POST/PUT requests
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    if (contentType && !contentType.includes("application/json")) {
      return false
    }
  }
  
  // Validate Origin (CSRF protection)
  if (origin) {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "http://localhost:3000",
    ]
    
    if (!allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return false
    }
  }
  
  return true
}

export function sanitizeRequestBody(body: any): any {
  if (typeof body !== "object" || body === null) {
    return body
  }
  
  const sanitized: any = Array.isArray(body) ? [] : {}
  
  for (const [key, value] of Object.entries(body)) {
    // Skip dangerous keys
    if (key.startsWith("__") || key.startsWith("$")) {
      continue
    }
    
    if (typeof value === "string") {
      // Remove null bytes and control characters
      sanitized[key] = value.replace(/\x00/g, "").replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F]/g, "")
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeRequestBody(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logSecurityEvent(
  eventType: string,
  details: any,
  userId?: number,
  ipAddress?: string
) {
  try {
    const { query } = await import("./db")
    
    await query(
      `INSERT INTO security_logs (event_type, details, user_id, ip_address, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [eventType, JSON.stringify(details), userId || null, ipAddress || null]
    )
  } catch (error) {
    console.error("[SECURITY] Failed to log security event:", error)
  }
}

// ============================================
// CONTENT SECURITY POLICY
// ============================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent XSS
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    
    // HTTPS enforcement (in production)
    ...(process.env.NODE_ENV === "production" ? {
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    } : {}),
    
    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions policy
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    
    // Cache control for sensitive data
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  }
}

