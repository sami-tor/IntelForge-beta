import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { addResponseSignature } from "@/lib/response-signing"
import { getCSRFToken } from "@/lib/csrf"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)

  if (!authResult.authorized) {
    return NextResponse.json({
      user: null,
      authorized: false,
      error: authResult.error ?? 'Not authenticated',
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  }

  const user = authResult.user
  const csrfResult = await getCSRFToken(request)
  const csrfToken = csrfResult.token
  
  const responseData = {
    authorized: true,
    user: {
      id: user.user_id,
      email: user.email,
      username: user.username,
      role: user.role,
      verificationStatus: user.verification_status,
      subscriptionType: user.subscription_type,
      subscriptionEnd: user.subscription_end,
      isLifetime: user.is_lifetime,
      searchCount: user.search_count,
      searchLimit: user.search_limit,
      isActive: user.is_active,
    },
    csrfToken: csrfToken || undefined,
  }
  
  const signedResponse = addResponseSignature(responseData)
  
  return NextResponse.json(signedResponse, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Response-Validated": "true",
      "X-Response-Signed": "true",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    }
  })
}
