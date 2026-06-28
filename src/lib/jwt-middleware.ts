/**
 * JWT Authentication Middleware
 * 
 * Provides middleware functions for protecting API routes with JWT
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, JWTPayload } from "./jwt"

// ============================================================================
// AUTH RESULT INTERFACE
// ============================================================================

export interface AuthResult {
  authorized: boolean
  user?: JWTPayload
  error?: string
  status?: number
}

// ============================================================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify JWT and require authentication
 * Returns user info if authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const result = await authenticateRequest(request)

  if (!result || !result.isValid) {
    return {
      authorized: false,
      error: "Authentication required. Please login.",
      status: 401,
    }
  }

  return {
    authorized: true,
    user: result.user,
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.authorized) {
    return authResult
  }

  if (authResult.user?.role !== "admin") {
    return {
      authorized: false,
      error: "Admin access required",
      status: 403,
    }
  }

  return authResult
}

/**
 * Require premium subscription (any paid tier)
 */
export async function requirePremium(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.authorized) {
    return authResult
  }

  const user = authResult.user!
  const isPremium =
    user.isLifetime ||
    user.role === "admin" ||
    ["starter", "professional", "enterprise", "api_access", "government"].includes(
      user.subscriptionType?.toLowerCase() || ""
    )

  if (!isPremium) {
    return {
      authorized: false,
      error: "Premium subscription required",
      status: 403,
    }
  }

  return authResult
}

/**
 * Require specific subscription tier
 */
export async function requireSubscriptionTier(
  request: NextRequest,
  requiredTiers: string[]
): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.authorized) {
    return authResult
  }

  const user = authResult.user!
  
  // Admin always has access
  if (user.role === "admin") {
    return authResult
  }

  // Lifetime premium has access to everything
  if (user.isLifetime) {
    return authResult
  }

  const userTier = user.subscriptionType?.toLowerCase() || "free"
  const hasAccess = requiredTiers.some(tier => tier.toLowerCase() === userTier)

  if (!hasAccess) {
    return {
      authorized: false,
      error: `Subscription tier required: ${requiredTiers.join(", ")}`,
      status: 403,
    }
  }

  return authResult
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create unauthorized response
 */
export function createAuthResponse(error: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        message: error,
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  )
}

/**
 * Create success response with user info
 */
export function createAuthSuccessResponse(user: JWTPayload, data?: any): NextResponse {
  return NextResponse.json({
    success: true,
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
      subscriptionType: user.subscriptionType,
      isLifetime: user.isLifetime,
    },
    data,
  })
}

