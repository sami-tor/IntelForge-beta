// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions = { maxRequests: 100, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const record = rateLimitMap.get(key)
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetAt < now) {
        rateLimitMap.delete(k)
      }
    }
  }
  
  if (!record || record.resetAt < now) {
    // New window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    })
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: now + options.windowMs
    }
  }
  
  if (record.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt
    }
  }
  
  record.count++
  return {
    allowed: true,
    remaining: options.maxRequests - record.count,
    resetAt: record.resetAt
  }
}


