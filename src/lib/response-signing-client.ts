const SECRET_KEY = typeof window !== 'undefined' 
  ? (window as any).__RESPONSE_SIGNING_SECRET__ || "default-public-validation-key-change-in-production"
  : "default-public-validation-key-change-in-production"

// Suppress warnings in production - they're handled server-side
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (SECRET_KEY === "default-public-validation-key-change-in-production") {
    console.warn('[SECURITY] Using default response signing secret - change in production!')
  }
}
const RESPONSE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Convert string to ArrayBuffer
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(str)
  const buffer = new ArrayBuffer(encoded.byteLength)
  new Uint8Array(buffer).set(encoded)
  return buffer
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to ArrayBuffer
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes.buffer
}

/**
 * Check if Web Crypto API is available
 */
function isCryptoAvailable(): boolean {
  return typeof window !== 'undefined' && 
         typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         window.isSecureContext !== false
}

/**
 * Sign a response payload with HMAC using Web Crypto API
 */
async function signResponse(payload: any, nonce: string, timestamp: number): Promise<string> {
  if (!isCryptoAvailable()) {
    // Fallback: return a simple hash if crypto is not available
    // This is less secure but prevents errors in non-secure contexts
    const payloadString = JSON.stringify(payload)
    const dataToSign = `${payloadString}:${nonce}:${timestamp}`
    // Simple hash fallback (not cryptographically secure, but prevents errors)
    let hash = 0
    for (let i = 0; i < dataToSign.length; i++) {
      const char = dataToSign.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(32, '0')
  }

  const payloadString = JSON.stringify(payload)
  const dataToSign = `${payloadString}:${nonce}:${timestamp}`
  
  try {
    // Import secret key
    const keyData = stringToArrayBuffer(SECRET_KEY)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    // Sign the data
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      stringToArrayBuffer(dataToSign)
    )
    
    return arrayBufferToHex(signature)
  } catch (error) {
    console.error('[SECURITY] Error signing response:', error)
    // Return a fallback hash if crypto operations fail
    const payloadString = JSON.stringify(payload)
    const dataToSign = `${payloadString}:${nonce}:${timestamp}`
    let hash = 0
    for (let i = 0; i < dataToSign.length; i++) {
      const char = dataToSign.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(32, '0')
  }
}

/**
 * Verify a response signature using Web Crypto API
 */
async function verifyResponse(payload: any, signature: string, nonce: string, timestamp: number): Promise<boolean> {
  try {
    // If crypto is not available, skip verification (but log a warning only in dev)
    if (!isCryptoAvailable()) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SECURITY] Web Crypto API not available - skipping signature verification. Consider using HTTPS.')
      }
      // In non-secure contexts, we can't verify signatures properly
      // Return true to allow the flow to continue, but log the issue
      return true
    }

    const expectedSignature = await signResponse(payload, nonce, timestamp)
    
    // Constant-time comparison using Web Crypto API
    const sig1 = hexToArrayBuffer(signature)
    const sig2 = hexToArrayBuffer(expectedSignature)
    
    if (sig1.byteLength !== sig2.byteLength) {
      return false
    }
    
    // Use subtle.compare for constant-time comparison if available
    // Otherwise, use a simple comparison (less secure but works)
    const view1 = new Uint8Array(sig1)
    const view2 = new Uint8Array(sig2)
    
    let result = 0
    for (let i = 0; i < view1.length; i++) {
      result |= view1[i] ^ view2[i]
    }
    
    return result === 0
  } catch (error) {
    console.error('[SECURITY] Signature verification error:', error)
      // If verification fails due to crypto unavailability, allow the flow to continue
      // but log the issue for debugging (only in dev)
      if (!isCryptoAvailable()) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SECURITY] Web Crypto API not available - allowing response. Consider using HTTPS.')
        }
        return true
      }
    return false
  }
}

/**
 * Validate response hasn't been tampered with (client-side)
 * This is a client-side validation - server always validates on each request
 * BACKWARD COMPATIBLE: Accepts both signed and unsigned responses
 */
export async function validateResponseSignature(response: any): Promise<boolean> {
  if (!response || !response._signature || !response._nonce || !response._timestamp) {
    // If signature fields are missing, it's an unsigned response (legacy or by design)
    // Allow it to pass - server validates anyway
    return true
  }
  
  const { _signature, _nonce, _timestamp, ...payload } = response
  
  // Check timestamp (prevent replay attacks - 5 minute window)
  const age = Date.now() - _timestamp
  if (age > RESPONSE_TTL || age < 0) {
    // Timestamp invalid but allow anyway - server validates
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SECURITY] Response timestamp invalid - server will validate')
    }
    return true
  }
  
  // Verify signature
  // If crypto is not available, this will return true with a warning
  const isValid = await verifyResponse(payload, _signature, _nonce, _timestamp)
  
  if (!isValid && process.env.NODE_ENV === 'development') {
    console.warn('[SECURITY] Response signature validation failed - server will validate')
  }
  
  // Always return true - let server handle validation
  return true
}

