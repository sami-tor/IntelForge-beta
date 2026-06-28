import { type NextRequest } from "next/server"

/**
 * SECURITY: Header Injection Protection
 * Prevents HTTP header injection and response splitting attacks
 */

const CRLF = /\r?\n/
const DANGEROUS_HEADER_CHARS = /[\r\n]/

export function sanitizeHeaderValue(value: string): string {
  if (!value || typeof value !== "string") {
    return ""
  }

  // Remove CRLF sequences (response splitting)
  let sanitized = value.replace(CRLF, "")
  
  // Remove any remaining newlines
  sanitized = sanitized.replace(/\n/g, "").replace(/\r/g, "")
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Limit length to prevent header size attacks
  if (sanitized.length > 8192) {
    sanitized = sanitized.substring(0, 8192)
  }
  
  return sanitized
}

export function sanitizeHeaderName(name: string): string {
  if (!name || typeof name !== "string") {
    return ""
  }

  // Header names should only contain specific characters
  const validHeaderName = /^[a-zA-Z0-9!#$%&'*+.^_`|~-]+$/
  
  if (!validHeaderName.test(name)) {
    return ""
  }
  
  return name
}

export function validateHeader(name: string, value: string): { valid: boolean; error?: string } {
  const sanitizedName = sanitizeHeaderName(name)
  if (!sanitizedName) {
    return { valid: false, error: "Invalid header name" }
  }

  if (DANGEROUS_HEADER_CHARS.test(value)) {
    return { valid: false, error: "Header value contains dangerous characters" }
  }

  return { valid: true }
}

/**
 * SECURITY: HTTP Parameter Pollution (HPP) Protection
 * Returns the first value if multiple values exist for the same parameter
 */
export function getSingleParam(request: NextRequest, paramName: string): string | null {
  const param = request.nextUrl.searchParams.get(paramName)
  if (!param) return null
  
  // If multiple values exist, get the first one
  const allValues = request.nextUrl.searchParams.getAll(paramName)
  return allValues[0] || null
}

/**
 * SECURITY: Validate Content-Length to prevent request smuggling
 */
export function validateContentLength(request: NextRequest, bodyLength: number): { valid: boolean; error?: string } {
  const contentLength = request.headers.get("content-length")
  
  if (!contentLength) {
    // Content-Length is optional for GET/HEAD/DELETE
    if (["GET", "HEAD", "DELETE"].includes(request.method)) {
      return { valid: true }
    }
    // For POST/PUT/PATCH, Content-Length should be present
    return { valid: false, error: "Missing Content-Length header" }
  }

  const declaredLength = parseInt(contentLength, 10)
  
  if (isNaN(declaredLength) || declaredLength < 0) {
    return { valid: false, error: "Invalid Content-Length" }
  }

  // Allow small discrepancy for encoding differences
  if (Math.abs(declaredLength - bodyLength) > 100) {
    return { valid: false, error: "Content-Length mismatch" }
  }

  return { valid: true }
}
