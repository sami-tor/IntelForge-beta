import { query } from "./db"
import bcrypt from "bcryptjs"
import { createSecureSession, validateSecureSession } from "./secure-session"

// Session management - using secure sessions
export async function createSession(userId: number, ipAddress?: string | null, userAgent?: string | null) {
  return createSecureSession(userId, ipAddress, userAgent)
}

export async function validateSession(sessionToken: string, ipAddress?: string | null, userAgent?: string | null) {
  return validateSecureSession(sessionToken, ipAddress, userAgent)
}

export async function deleteSession(sessionToken: string) {
  const sql = "DELETE FROM sessions WHERE session_token = $1"
  return query(sql, [sessionToken])
}

export async function cleanExpiredSessions() {
  const sql = "DELETE FROM sessions WHERE expires_at < NOW()"
  return query(sql)
}

// User authentication
export async function registerUser(email: string, password: string, username: string) {
  // SECURITY: Use bcrypt rounds of 12 for better security (slower but more secure)
  // 10 rounds is acceptable, but 12 is recommended for production
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10)
  const passwordHash = await bcrypt.hash(password, bcryptRounds)
  // SECURITY: Explicitly set role to 'user' - never trust input
  // Also set default subscription and limits
  const sql = `
    INSERT INTO users (email, password_hash, username, role, verification_status, subscription_type, search_limit)
    VALUES ($1, $2, $3, 'user', 'verified', 'free', 50)
    RETURNING id, email, username, role, verification_status, created_at
  `
  return query(sql, [email, passwordHash, username])
}

export async function loginUser(email: string, password: string) {
  const sql = "SELECT * FROM users WHERE email = $1 AND is_active = true"
  const result = await query(sql, [email])

  if (!result.success || !result.data || result.data.length === 0) {
    return { success: false, error: "Invalid credentials" }
  }

  const user = result.data[0]
  const isValidPassword = await bcrypt.compare(password, user.password_hash)

  if (!isValidPassword) {
    return { success: false, error: "Invalid credentials" }
  }

  // Update last login
  await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id])

  return { success: true, user }
}

// Authorization helpers
export function isAdmin(user: any): boolean {
  return user?.role === "admin"
}

export function isVerified(user: any): boolean {
  return user?.verification_status === "verified"
}

export function hasActiveSubscription(user: any): boolean {
  if (user?.is_lifetime) return true
  if (!user?.subscription_end) return false
  return new Date(user.subscription_end) > new Date()
}

export function canSearch(user: any): boolean {
  if (!user) return false
  if (user.is_lifetime) return true
  return user.search_count < user.search_limit
}

// Search quota management
export async function incrementSearchCount(userId: number) {
  const sql = "UPDATE users SET search_count = search_count + 1 WHERE id = $1 RETURNING search_count, search_limit"
  return query(sql, [userId])
}

export async function resetSearchCount(userId: number) {
  const sql = "UPDATE users SET search_count = 0 WHERE id = $1"
  return query(sql, [userId])
}

// Utility functions
function generateSessionToken(): string {
  return `if_session_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`
}

export async function verifyAuth(request: Request) {
  try {
    // Get session token from cookies
    const cookieHeader = request.headers.get("cookie")
    
    if (!cookieHeader) {
      return null
    }

    // Parse cookies
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((cookie) => {
        const [key, ...values] = cookie.split("=")
        return [key, values.join("=")]
      }),
    )

    const sessionToken = cookies.session_token
    
    if (!sessionToken) {
      return null
    }

    // Validate session
    const result = await validateSession(sessionToken)
    
    if (!result.success || !result.data || result.data.length === 0) {
      return null
    }

    const sessionData = result.data[0]

    // Return user object
    return {
      id: sessionData.user_id,
      email: sessionData.email,
      username: sessionData.username,
      role: sessionData.role,
      verificationStatus: sessionData.verification_status,
      subscriptionType: sessionData.subscription_type,
      isLifetime: sessionData.is_lifetime,
      searchCount: sessionData.search_count,
      searchLimit: sessionData.search_limit,
      isActive: sessionData.is_active,
    }
  } catch (error) {
    // SECURITY: Don't log sensitive auth errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[AUTH] Verification error:", error)
    }
    return null
  }
}
