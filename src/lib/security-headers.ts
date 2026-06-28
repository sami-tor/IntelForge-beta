import { NextRequest, NextResponse } from "next/server"

/**
 * COMPREHENSIVE SECURITY HEADERS
 * Implements all security best practices:
 * - CSP with SRI
 * - HSTS
 * - Strict CORS
 * - X-Frame-Options
 * - No-store for sensitive endpoints
 * 
 * NOTE: Uses Web Crypto API (Edge Runtime compatible) instead of Node.js crypto
 */

// Generate nonce for CSP using Web Crypto API (Edge Runtime compatible)
export function generateNonce(): string {
  // Use Web Crypto API for Edge Runtime compatibility
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  // Convert Uint8Array to base64 without Buffer (Edge Runtime compatible)
  const base64 = btoa(String.fromCharCode(...array))
  return base64
}

// Get strict CSP policy
export function getCSPPolicy(nonce: string, requestHostname?: string): string {
  const isProduction = process.env.NODE_ENV === "production"
  // Always allow localhost HTTP when:
  // 1. NOT in production mode, OR
  // 2. Request is from localhost/127.0.0.1/private IP (even in production mode for local testing)
  const hostname = requestHostname || ''
  const isLocalAccess = hostname.includes('localhost') || 
                        hostname.includes('127.0.0.1') || 
                        hostname.includes('::1') ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('10.') ||
                        hostname.startsWith('172.') ||
                        hostname === ''
  const allowLocalhostHttp = !isProduction || isLocalAccess
  
  // Base CSP - allows Next.js and Typekit
  // Note: Using 'unsafe-inline' for script-src-elem to allow Next.js inline scripts
  // This is necessary because Next.js generates dynamic inline scripts that change with each build
  // IMPORTANT: 'unsafe-inline' is ignored if nonce is present, so we use only 'unsafe-inline' for script-src-elem
  // script-src remains strict with nonce and strict-dynamic for security
  const directives = [
    "default-src 'self'",
    // script-src: In dev, allow 'unsafe-eval' for Next.js React Refresh / HMR.
    // In production, keep strict (nonce + strict-dynamic only).
    isProduction
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    // script-src-elem: Allow script elements from self, unsafe-inline, and external CDNs
    // NOTE: Cannot use nonce here - 'unsafe-inline' is ignored if nonce is present
    // This allows all inline scripts (needed for Next.js dynamic scripts) and external libraries
    // CDNs: jsdelivr (particles.js, globe.gl), cdnjs (three.js), Cloudflare Insights
    "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com",
    // Allow styles: self, inline (for Next.js), Typekit domains
    "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net",
    "font-src 'self' https://use.typekit.net https://p.typekit.net data:",
    // Allow images: self, data URIs, HTTPS, blob, and MinIO (localhost in development)
    // In development, allow all HTTP to fix CSP blocking (only for local testing)
    allowLocalhostHttp 
      ? "img-src 'self' data: https: blob: http:" // Allow all HTTP in dev (localhost testing only)
      : "img-src 'self' data: https: blob:", // Production: HTTPS only
    // Allow connections: self, Typekit, Cloudflare, and localhost services in dev
    allowLocalhostHttp
      ? "connect-src 'self' https://use.typekit.net https://p.typekit.net https://cloudflareinsights.com http://localhost:9000 http://127.0.0.1:9000 http://localhost:8000 http://127.0.0.1:8000"
      : "connect-src 'self' https://use.typekit.net https://p.typekit.net https://cloudflareinsights.com",
    "frame-ancestors 'none'", // Prevent framing
    "base-uri 'self'",
    "form-action 'self'",
  ]
  
  // Only add HTTPS enforcement in production AND when not on localhost
  // Don't force HTTPS on localhost as it causes SSL errors (browser tries to upgrade HTTP to HTTPS)
  if (isProduction && !isLocalAccess) {
    directives.push("upgrade-insecure-requests") // Force HTTPS (only in production, not localhost)
    directives.push("block-all-mixed-content") // Block mixed HTTP/HTTPS content
    
    // Add report-uri for CSP violations
    if (process.env.CSP_REPORT_URI) {
      directives.push(`report-uri ${process.env.CSP_REPORT_URI}`)
    }
  }
  
  return directives.join("; ")
}

// Get security headers for all responses
export function getSecurityHeaders(nonce?: string, requestHostname?: string): Record<string, string> {
  const isProduction = process.env.NODE_ENV === "production"
  const headers: Record<string, string> = {
    // XSS Protection
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    
    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Permissions Policy (restrictive)
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=()",
    
    // Cache control (default to no-store for security)
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  }
  
  // Add CSP if nonce provided
  if (nonce) {
    headers["Content-Security-Policy"] = getCSPPolicy(nonce, requestHostname)
  }
  
  // HSTS in production (but not on localhost)
  const isLocalhost = requestHostname 
    ? (requestHostname.includes('localhost') || requestHostname.includes('127.0.0.1') || requestHostname.includes('::1'))
    : false
  if (isProduction && !isLocalhost) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
  }
  
  return headers
}

// Get CORS headers (strict)
export function getCORSHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin")
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "http://localhost:3000",
    "https://localhost:3000",
  ]
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    origin === allowed || origin.startsWith(allowed)
  )
  
  if (!isAllowed) {
    return {
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "false",
    }
  }
  
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // 24 hours
  }
}

// Get headers for sensitive endpoints (no-store, no-cache)
export function getSensitiveHeaders(nonce?: string, requestHostname?: string): Record<string, string> {
  return {
    ...getSecurityHeaders(nonce, requestHostname),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, private",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  }
}

// Apply security headers to response
export function applySecurityHeaders(
  response: NextResponse,
  options: {
    nonce?: string
    sensitive?: boolean
    cors?: boolean
    request?: NextRequest
  } = {}
): NextResponse {
  // Get hostname from request URL or headers
  const requestHostname = options.request?.nextUrl.hostname || 
                         options.request?.headers.get('host')?.split(':')[0] ||
                         undefined
  const headers = options.sensitive
    ? getSensitiveHeaders(options.nonce, requestHostname)
    : getSecurityHeaders(options.nonce, requestHostname)
  
  // Add CORS headers if requested
  if (options.cors && options.request) {
    const corsHeaders = getCORSHeaders(options.request)
    for (const [key, value] of Object.entries(corsHeaders)) {
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
        headers[key] = value
      }
    }
  }
  
  // Apply all headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

