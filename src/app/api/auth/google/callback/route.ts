import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForToken, getUserInfo } from "@/lib/oauth"
import { registerUser, createSession, loginUser } from "@/lib/auth"
import { getUserByEmail } from "@/lib/db"
import { query } from "@/lib/db"
import { SECURE_COOKIE_OPTIONS } from "@/lib/security"
import { validateCSRF } from "@/lib/csrf"
import { getClientIp } from "@/lib/request-logger"

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")
    const state = request.nextUrl.searchParams.get("state")
    const error = request.nextUrl.searchParams.get("error")

    if (error) {
      console.error("[OAuth] Error:", error)
      return NextResponse.redirect(`/login?error=${error}`)
    }

    const csrfValidation = await validateCSRF(request, state || undefined)
    if (!csrfValidation.valid) {
      return NextResponse.redirect("/login?error=invalid_state")
    }

    if (!code) {
      return NextResponse.redirect("/login?error=no_code")
    }

    // Exchange code for token
    const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`
    const tokenData = await exchangeCodeForToken(code, redirectUri)

    // Get user info
    const userInfo = await getUserInfo(tokenData.access_token)

    if (!userInfo.email) {
      return NextResponse.redirect("/login?error=no_email")
    }

    const allowedDomains = (process.env.OAUTH_ALLOWED_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
    if (allowedDomains.length > 0) {
      const emailDomain = String(userInfo.email).split("@")[1]?.toLowerCase()
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return NextResponse.redirect("/login?error=domain_not_allowed")
      }
    }

    if (process.env.NODE_ENV === "development") {
    }

    // Check if user exists
    let userResult = await getUserByEmail(userInfo.email)

    if (!userResult.success || !userResult.data || userResult.data.length === 0) {
      // Create new user
      if (process.env.NODE_ENV === "development") {
      }

      // Generate username from email
      const username = userInfo.email.split("@")[0] + Math.random().toString(36).substring(7)

      // Create password hash (random password since OAuth user won't use it)
      const randomPassword = Math.random().toString(36).substring(2, 15)

      const registerResult = await registerUser(userInfo.email, randomPassword, username)

      if (!registerResult.success || !registerResult.data || registerResult.data.length === 0) {
        return NextResponse.redirect("/login?error=registration_failed")
      }

      const newUser = registerResult.data[0]

      // Mark as OAuth user
      await query("UPDATE users SET oauth_provider = $1, oauth_id = $2 WHERE id = $3", [
        "google",
        userInfo.id,
        newUser.id,
      ])

      userResult = { success: true, data: [{ ...newUser, id: newUser.id }] }
    } else {
      // Update OAuth info
      const user = userResult.data[0]
      await query("UPDATE users SET oauth_provider = $1, oauth_id = $2 WHERE id = $3", [
        "google",
        userInfo.id,
        user.id,
      ])

      if (process.env.NODE_ENV === "development") {
      }
    }

    // Create session
    if (!userResult.data || userResult.data.length === 0) {
      return NextResponse.redirect("/login?error=user_not_found")
    }

    const user = userResult.data[0]
    const ipAddress = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const sessionResult = await createSession(user.id, ipAddress, userAgent)

    if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
      return NextResponse.redirect("/login?error=session_failed")
    }

    const session = sessionResult.data[0]
    const response = NextResponse.redirect("/dashboard")

    const forwardedProto = request.headers.get("x-forwarded-proto")
    const isHttps = forwardedProto ? forwardedProto.includes("https") : request.nextUrl.protocol === "https:"

    response.cookies.set("session_token", session.session_token, {
      ...SECURE_COOKIE_OPTIONS,
      secure: isHttps,
    })

    // No need to clear any client-set state; CSRF validation is server-bound

    return response
  } catch (error) {
    console.error("[OAuth] Callback error:", error)
    return NextResponse.redirect("/login?error=callback_failed")
  }
}
