import { NextRequest } from "next/server"

/**
 * Request Logging Utilities
 * Provides structured logging for all API requests
 */

export interface RequestLog {
  method: string
  url: string
  path: string
  query?: Record<string, string>
  ip?: string
  userAgent?: string
  requestId?: string
  timestamp: string
  duration?: number
  status?: number
  userId?: number | string
  error?: string
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers for IP address (reverse proxy/CDN)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }
  
  const cfConnectingIp = request.headers.get("cf-connecting-ip")
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  return "unknown"
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown"
}

/**
 * Generate request ID if not present
 */
export function getOrGenerateRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || crypto.randomUUID()
}

/**
 * Log API request
 */
export function logRequest(request: NextRequest, requestId: string): RequestLog {
  const url = new URL(request.url)
  const query: Record<string, string> = {}
  
  // Extract query parameters
  url.searchParams.forEach((value, key) => {
    // Sanitize sensitive parameters
    if (["password", "token", "secret", "api_key"].includes(key.toLowerCase())) {
      query[key] = "[REDACTED]"
    } else {
      query[key] = value
    }
  })
  
  const log: RequestLog = {
    method: request.method,
    url: url.href,
    path: url.pathname,
    query: Object.keys(query).length > 0 ? query : undefined,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    requestId,
    timestamp: new Date().toISOString()
  }
  

  
  return log
}

/**
 * Log API response
 */
export function logResponse(
  requestLog: RequestLog,
  status: number,
  error?: string,
  userId?: number | string
): void {
  const duration = Date.now() - new Date(requestLog.timestamp).getTime()
  
  const responseLog = {
    ...requestLog,
    status,
    duration: `${duration}ms`,
    ...(userId && { userId }),
    ...(error && { error })
  }
  
  // Color-coded console output
  const statusColor = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m"
  const resetColor = "\x1b[0m"
  
  
  
  // Log errors to console in production
  if (process.env.NODE_ENV === "production" && status >= 500) {
    console.error("[API ERROR]", {
      method: requestLog.method,
      path: requestLog.path,
      status,
      duration,
      requestId: requestLog.requestId,
      error
    })
  }
  
  // TODO: Send to external logging service (e.g., Sentry, LogRocket, DataDog)
  // if (process.env.NODE_ENV === "production") {
  //   sendToLoggingService(responseLog)
  // }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeLogData(data: any): any {
  if (typeof data !== "object" || data === null) return data
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data }
  const sensitiveKeys = [
    "password",
    "password_hash",
    "token",
    "api_key",
    "secret",
    "session_token",
    "credit_card",
    "ssn",
    "authorization"
  ]
  
  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof sanitized[key] === "object") {
      sanitized[key] = sanitizeLogData(sanitized[key])
    }
  }
  
  return sanitized
}


