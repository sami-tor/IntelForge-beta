/**
 * JWT Token Refresh Endpoint
 * 
 * Handles automatic token refresh using refresh token
 */

import { NextRequest, NextResponse } from "next/server"
import { refreshAccessToken, getAccessTokenCookie, getRefreshTokenCookie } from "@/lib/jwt"

export async function POST(request: NextRequest) {
  try {
    const result = await refreshAccessToken(request)

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REFRESH_FAILED",
            message: "Failed to refresh token. Please login again.",
          },
        },
        { status: 401 }
      )
    }

    // Set new tokens as HTTP-only cookies
    const response = NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
      user: {
        userId: result.user.userId,
        email: result.user.email,
        role: result.user.role,
        subscriptionType: result.user.subscriptionType,
        isLifetime: result.user.isLifetime,
      },
    })

    response.headers.set("Set-Cookie", getAccessTokenCookie(result.accessToken))
    response.headers.append("Set-Cookie", getRefreshTokenCookie(result.refreshToken))

    return response
  } catch (error) {
    console.error("[JWT REFRESH] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message: "An error occurred while refreshing token",
        },
      },
      { status: 500 }
    )
  }
}

// Also support GET for automatic refresh checks
export async function GET(request: NextRequest) {
  return POST(request)
}

