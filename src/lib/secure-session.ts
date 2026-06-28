import crypto from "crypto"
import { query } from "./db"

/**
 * SECURITY: Cryptographically Signed Session Tokens
 * Prevents session token manipulation and ensures tokens cannot be forged
 */

// SECURITY: Fail hard if SESSION_SECRET is not set in production
const configuredSessionSecret = process.env.SESSION_SECRET || process.env.SECRET_KEY

if (!configuredSessionSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: SESSION_SECRET environment variable must be set in production!")
  }
  console.warn("[SECURITY WARNING] Using default session secret in development. Set SESSION_SECRET in .env.local")
}

const SESSION_SECRET = configuredSessionSecret || "default-development-session-secret"

/**
 * Generate a cryptographically secure session token
 * Format: random_id.signature.timestamp where signature is HMAC-SHA256 of random_id + timestamp + userId
 * SECURITY: Include userId in signature to prevent token reuse across users
 */
export function generateSecureSessionToken(userId: number): string {
  const randomId = crypto.randomBytes(32).toString("hex")
  const timestamp = Date.now()
  // SECURITY: Include userId in payload to prevent token reuse
  const payload = `${randomId}:${timestamp}:${userId}`
  
  const hmac = crypto.createHmac("sha256", SESSION_SECRET)
  hmac.update(payload)
  const signature = hmac.digest("hex")
  
  return `${randomId}.${signature}.${timestamp}`
}

/**
 * Create session with secure token
 * SECURITY: Prevents session fixation by always creating new session
 * SECURITY: Binds session to IP and User-Agent to prevent hijacking
 */
export async function createSecureSession(
  userId: number, 
  ipAddress?: string | null, 
  userAgent?: string | null
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  // SECURITY: Invalidate all existing sessions for this user (prevent session fixation)
  await query(
    `UPDATE sessions SET expires_at = NOW() WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  )
  
  const sessionToken = generateSecureSessionToken(userId)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  // SECURITY: Store IP address and user agent to detect session hijacking
  // Try to insert with IP/UA columns first, fallback to basic insert if columns don't exist
  try {
    const sql = `
      INSERT INTO sessions (user_id, session_token, expires_at, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING session_token, expires_at
    `
    return await query(sql, [userId, sessionToken, expiresAt, ipAddress || null, userAgent || null])
  } catch (error: any) {
    // If columns don't exist yet, fallback to basic insert
    // User should run migration script 014_add_session_security_columns.sql
    if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
      const sql = `
        INSERT INTO sessions (user_id, session_token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING session_token, expires_at
      `
      return query(sql, [userId, sessionToken, expiresAt])
    }
    throw error
  }
}

/**
 * Validate session token and return user data
 * CRITICAL: Always fetches from database - never trusts token alone
 * BACKWARD COMPATIBLE: Accepts both legacy tokens (UUID) and new signed tokens (randomId.signature.timestamp)
 */
export async function validateSecureSession(
  sessionToken: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  // First validate token format
  if (!sessionToken || typeof sessionToken !== "string") {
    return { success: false, error: "Invalid session token" }
  }
  
  // Check if token is new format (has 3 parts) or legacy format (UUID)
  const parts = sessionToken.split(".")
  const isNewFormat = parts.length === 3
  
  // For new format tokens, validate signature
  if (isNewFormat) {
    const [randomId, signature, timestampStr] = parts
    const timestamp = parseInt(timestampStr, 10)
    
    if (isNaN(timestamp)) {
      return { success: false, error: "Invalid token timestamp" }
    }
    
    // Check token age (7 days max)
    const tokenAge = Date.now() - timestamp
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
      return { success: false, error: "Token expired" }
    }
  }
  
  // Then verify token exists in database and get user data FIRST
  // CRITICAL: Database lookup verifies the token belongs to a valid user
  // Try to select with IP/UA columns first, fallback if columns don't exist
  let sql = `
    SELECT s.*, u.id as user_id, u.email, u.username, u.role, u.verification_status, 
           u.subscription_type, u.is_lifetime, u.search_count, u.search_limit, u.is_active
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true
  `
  let result = await query(sql, [sessionToken])
  
  // If query failed due to missing columns, try without IP/UA columns
  if (!result.success && (result.error as any)?.code === "42703") {
    sql = `
      SELECT s.user_id, s.session_token, s.expires_at, s.created_at,
             u.id as user_id, u.email, u.username, u.role, u.verification_status, 
             u.subscription_type, u.is_lifetime, u.search_count, u.search_limit, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true
    `
    result = await query(sql, [sessionToken])
  }
  
  if (!result.success || !result.data || result.data.length === 0) {
    return { success: false, error: "Session not found or expired" }
  }
  
  const sessionData = result.data[0]
  
  // SECURITY: For new format tokens, verify signature with userId from database
  // This prevents token reuse across different users
  // Legacy tokens are accepted as-is (database verification is sufficient)
  if (isNewFormat) {
    const [randomId, signature, timestampStr] = parts
    const timestamp = parseInt(timestampStr, 10)
    const payload = `${randomId}:${timestamp}:${sessionData.user_id}`
    const hmac = crypto.createHmac("sha256", SESSION_SECRET)
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")
    
    // Use timing-safe comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      // SECURITY: Log signature mismatch - possible token tampering
      const { logSecurityAudit } = await import("./security-audit")
      await logSecurityAudit(
        "INVALID_SESSION_SIGNATURE",
        {
          sessionToken: sessionToken.substring(0, 20) + "...",
          userId: sessionData.user_id,
        },
        sessionData.user_id,
        null,
        null,
        "high"
      )
      return { success: false, error: "Token signature invalid" }
    }
  }
  
  // SECURITY: Check IP and User-Agent binding to detect session hijacking
  // Allow some flexibility for legitimate IP changes (e.g., mobile networks)
  if (sessionData.ip_address && ipAddress) {
    const storedIP = sessionData.ip_address.split(".").slice(0, 3).join(".")
    const currentIP = ipAddress.split(".").slice(0, 3).join(".")
    const isLocal = ipAddress === "127.0.0.1" || ipAddress === "::1"
    if (!isLocal && storedIP !== currentIP) {
      const { logSecurityAudit } = await import("./security-audit")
      await logSecurityAudit(
        "SESSION_IP_MISMATCH",
        {
          storedIP: sessionData.ip_address,
          currentIP: ipAddress,
          userId: sessionData.user_id,
        },
        sessionData.user_id,
        ipAddress,
        userAgent || null,
        "high"
      )
      const strict = process.env.SESSION_BIND_STRICT !== "false"
      if (strict) {
        await query("UPDATE sessions SET expires_at = NOW() WHERE session_token = $1", [sessionToken])
        return { success: false, error: "Session binding mismatch" }
      }
    }
  }
  
  // SECURITY: Check User-Agent binding
  if (sessionData.user_agent && userAgent && sessionData.user_agent !== userAgent) {
    const { logSecurityAudit } = await import("./security-audit")
    const uaIsMiddleware = userAgent.includes("Next.js Middleware")
    if (!uaIsMiddleware) {
      await logSecurityAudit(
        "SESSION_USER_AGENT_MISMATCH",
        {
          storedUA: sessionData.user_agent.substring(0, 50),
          currentUA: userAgent.substring(0, 50),
          userId: sessionData.user_id,
        },
        sessionData.user_id,
        ipAddress || null,
        userAgent || null,
        "high"
      )
      const strict = process.env.SESSION_BIND_STRICT !== "false"
      if (strict) {
        await query("UPDATE sessions SET expires_at = NOW() WHERE session_token = $1", [sessionToken])
        return { success: false, error: "Session binding mismatch" }
      }
    }
  }
  
  return result
}

