import { query } from "./db"
import crypto from "crypto"

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SECRET_KEY || "change-this-secret-in-production"

export async function regenerateSessionToken(userId: number, oldToken: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const newToken = generateSecureSessionToken(userId)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  
  const result = await query(
    `UPDATE sessions 
     SET session_token = $1, expires_at = $2, created_at = NOW()
     WHERE user_id = $3 AND session_token = $4
     RETURNING session_token`,
    [newToken, expiresAt, userId, oldToken]
  )
  
  if (result.success && result.data && result.data.length > 0) {
    return { success: true, token: newToken }
  }
  
  return { success: false, error: "Failed to regenerate session" }
}

function generateSecureSessionToken(userId: number): string {
  const randomId = crypto.randomBytes(32).toString("hex")
  const timestamp = Date.now()
  const payload = `${randomId}:${timestamp}:${userId}`
  
  const hmac = crypto.createHmac("sha256", SESSION_SECRET)
  hmac.update(payload)
  const signature = hmac.digest("hex")
  
  return `${randomId}.${signature}.${timestamp}`
}

