/**
 * Gmail OAuth Helper Functions
 * For production, use next-auth with proper OAuth2 flow
 */

export function getGoogleOAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || ""
  const scopes = encodeURIComponent("openid email profile")
  
  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${scopes}&` +
    `access_type=offline`
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("[OAuth] Token exchange error:", error)
    throw error
  }
}

export async function getUserInfo(accessToken: string) {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("[OAuth] Get user info error:", error)
    throw error
  }
}
