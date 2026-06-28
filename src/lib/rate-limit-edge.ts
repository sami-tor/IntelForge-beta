import { NextRequest } from "next/server"

/**
 * Edge Runtime Compatible Rate Limiting
 * These functions don't use Node.js crypto and are safe for Edge Runtime
 */

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

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

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

