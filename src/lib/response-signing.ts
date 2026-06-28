import crypto from "crypto"

/**
 * SECURITY: Response Integrity Signing with Nonce and Timestamp
 * Prevents response tampering by adding HMAC signatures to sensitive responses
 * Includes nonce and timestamp to prevent replay attacks
 */

// SECURITY: Use separate secret for response signing - fail hard in production
const configuredSecret = process.env.RESPONSE_SIGNING_SECRET || process.env.SECRET_KEY

if (!configuredSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: RESPONSE_SIGNING_SECRET environment variable must be set in production!")
  }
  console.warn("[SECURITY WARNING] Using default response signing secret in development. Set RESPONSE_SIGNING_SECRET in .env.local")
}

const SECRET_KEY = configuredSecret || "default-development-response-signing-secret"
const RESPONSE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Generate nonce for response
 */
export function generateResponseNonce(): string {
  return crypto.randomBytes(16).toString("hex")
}

/**
 * Sign a response payload with HMAC (includes nonce and timestamp)
 */
export function signResponse(payload: any, nonce: string, timestamp: number): string {
  const payloadString = JSON.stringify(payload)
  const dataToSign = `${payloadString}:${nonce}:${timestamp}`
  const hmac = crypto.createHmac("sha256", SECRET_KEY)
  hmac.update(dataToSign)
  return hmac.digest("hex")
}

/**
 * Verify a response signature
 */
export function verifyResponse(payload: any, signature: string, nonce: string, timestamp: number): boolean {
  const expectedSignature = signResponse(payload, nonce, timestamp)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Add integrity signature to response (with nonce and timestamp)
 */
export function addResponseSignature(response: any): any {
  if (typeof response === "object" && response !== null) {
    const nonce = generateResponseNonce()
    const timestamp = Date.now()
    const signature = signResponse(response, nonce, timestamp)
    
    return {
      ...response,
      _signature: signature, // HMAC signature
      _nonce: nonce, // Nonce to prevent replay
      _timestamp: timestamp, // Timestamp to prevent replay
    }
  }
  return response
}

/**
 * Validate response hasn't been tampered with (client-side)
 * This is a client-side validation - server always validates on each request
 */
export function validateResponseSignature(response: any): boolean {
  if (!response || !response._signature || !response._nonce || !response._timestamp) {
    return false // Missing required fields
  }
  
  const { _signature, _nonce, _timestamp, ...payload } = response
  
  // Check timestamp (prevent replay attacks - 5 minute window)
  const age = Date.now() - _timestamp
  if (age > RESPONSE_TTL || age < 0) {
    return false // Response too old or timestamp in future
  }
  
  // Verify signature
  return verifyResponse(payload, _signature, _nonce, _timestamp)
}

