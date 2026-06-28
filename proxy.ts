import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders, generateNonce } from '@/lib/security-headers'
import { getRateLimitIdentifier, checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit-edge'
import { verifyAccessTokenEdge, verifyRefreshTokenEdge } from '@/lib/edge-jwt'

// Store nonces per request (in-memory, cleared after response)
const requestNonces = new Map<string, { nonce: string; expires: number }>()

// Generate UUID using Web Crypto API (Edge Runtime compatible)
function generateUUID(): string {
  // Use Web Crypto API for Edge Runtime compatibility
  return crypto.randomUUID()
}

export async function proxy(request: NextRequest) {
  const startTime = Date.now()
  const ADMIN_ALIAS = process.env.ADMIN_UI_ALIAS || '/admin-portal'
  
  // Block unsupported HTTP methods (Edge Runtime limitation)
  // CRITICAL: Return immediately to prevent Next.js from processing unsupported methods
  const unsupportedMethods = ['TRACE', 'TRACK', 'CONNECT']
  if (unsupportedMethods.includes(request.method)) {
    // Return immediately without any further processing
    return new NextResponse(
      JSON.stringify({ error: 'Method Not Allowed', method: request.method }), 
      { 
        status: 405,
        headers: { 
          'Allow': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
          'Content-Type': 'application/json'
        }
      }
    )
  }
  
  const response = NextResponse.next()
  
  // Generate request ID for tracing
  const requestId = request.headers.get("x-request-id") || generateUUID()
  
  // SECURITY: Admin alias
  // - Only allow admin UI via alias path (e.g., /admin-portal)
  // - Block direct /admin access; rewrite alias to internal /admin
  const pathname = request.nextUrl.pathname
  const isAliasAdminRoute = pathname.startsWith(ADMIN_ALIAS)
  const isDirectAdminRoute = pathname.startsWith('/admin')

  if (isDirectAdminRoute && !isAliasAdminRoute) {
    // Block direct /admin discovery; send to alias login
    const loginAlias = `${ADMIN_ALIAS}/login`
    return NextResponse.redirect(new URL(loginAlias, request.url))
  }

  if (isAliasAdminRoute) {
    const isAliasLogin = pathname.startsWith(`${ADMIN_ALIAS}/login`)
    if (isAliasLogin) {
      const subpath = pathname.slice(ADMIN_ALIAS.length)
      const target = `/admin${subpath}` || '/admin/login'
      const rewriteUrl = new URL(target, request.url)
      const rewriteResponse = NextResponse.rewrite(rewriteUrl)
      const nonce = generateNonce()
      applySecurityHeaders(rewriteResponse, { nonce, sensitive: true, cors: true, request })
      rewriteResponse.headers.set('X-Nonce', nonce)
      rewriteResponse.headers.set('X-Request-ID', request.headers.get('x-request-id') || generateUUID())
      return rewriteResponse
    }
    
    // Gate: must have a valid, cryptographically verified admin session
    // Use Edge-compatible JWT verification so forged cookies cannot bypass the alias
    const accessToken = request.cookies.get('access_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value

    let hasValidToken = false

    if (accessToken) {
      const verified = await verifyAccessTokenEdge(accessToken)
      hasValidToken = Boolean(verified)
    }

    if (!hasValidToken && refreshToken) {
      const verifiedRefresh = await verifyRefreshTokenEdge(refreshToken)
      hasValidToken = Boolean(verifiedRefresh)
    }
    
    // If no valid JWT tokens, redirect to login
    if (!hasValidToken) {
      if (process.env.NODE_ENV === 'development') {
      }
      return NextResponse.redirect(new URL(`${ADMIN_ALIAS}/login`, request.url))
    }
    
    // Rewrite alias to internal /admin path (preserve subpath)
    const subpath = pathname.slice(ADMIN_ALIAS.length)
    const target = `/admin${subpath}` || '/admin'
    const rewriteUrl = new URL(target, request.url)
    const rewriteResponse = NextResponse.rewrite(rewriteUrl)
    // Apply security headers for sensitive admin UI
    const nonce = generateNonce()
    applySecurityHeaders(rewriteResponse, { nonce, sensitive: true, cors: true, request })
    rewriteResponse.headers.set('X-Nonce', nonce)
    rewriteResponse.headers.set('X-Request-ID', request.headers.get('x-request-id') || generateUUID())
    return rewriteResponse
  }
  
  // Generate nonce for CSP
  const nonce = generateNonce()
  
  // Store nonce (expires in 1 minute)
  requestNonces.set(requestId, {
    nonce,
    expires: Date.now() + 60000
  })
  
  // Clean expired nonces
  for (const [id, data] of requestNonces.entries()) {
    if (data.expires < Date.now()) {
      requestNonces.delete(id)
    }
  }
  
  // Apply security headers
  const isSensitiveEndpoint = 
    request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname.startsWith('/api/admin') ||
    request.nextUrl.pathname.startsWith('/api/user') ||
    request.nextUrl.pathname.startsWith('/admin')
  
  // Pass hostname for proper localhost detection in CSP
  applySecurityHeaders(response, {
    nonce,
    sensitive: isSensitiveEndpoint,
    cors: true,
    request,
  })
  
  // Add nonce and request ID to response headers
  response.headers.set("X-Nonce", nonce)
  response.headers.set("X-Request-ID", requestId)
  
  // Add response time header
  const responseTime = Date.now() - startTime
  response.headers.set("X-Response-Time", `${responseTime}ms`)
  
  // Log requests in development
  if (process.env.NODE_ENV === "development") {
    const method = request.method
    const path = request.nextUrl.pathname
    const statusColor = "\x1b[36m" // Cyan
    const resetColor = "\x1b[0m"
  }
  
  // Rate limiting for API endpoints
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitId = getRateLimitIdentifier(request, `api:${request.nextUrl.pathname}:`)
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMITS.AUTH_API)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: response.headers }
      )
    }
    
    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(rateLimit.remaining + 1))
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining))
    response.headers.set("X-RateLimit-Reset", String(Math.floor(rateLimit.resetTime / 1000)))
  }
  
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === "production") {
    const proto = request.headers.get("x-forwarded-proto")
    if (proto !== "https" && request.nextUrl.hostname !== "localhost") {
      return NextResponse.redirect(
        `https://${request.nextUrl.hostname}${request.nextUrl.pathname}`,
        301
      )
    }
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.well-known|.htaccess).*)',
  ],
}
