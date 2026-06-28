import path from 'path'
import DOMPurify from 'isomorphic-dompurify'

/**
 * OWASP Top 10 Input Validation & Sanitization
 * Prevents: SQL Injection, XSS, Command Injection, Path Traversal
 */

// ============================================
// 1. GENERAL INPUT SANITIZATION
// ============================================

/**
 * Sanitize search query - treat as plain text, remove dangerous characters
 * Prevents: SQL Injection, Command Injection, XSS
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')
  
  // Remove control characters (except newline, tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Limit length to prevent DoS
  sanitized = sanitized.substring(0, 500)
  
  // Remove HTML/JavaScript
  sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] })
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  return sanitized
}

/**
 * Sanitize HTML input - allow safe HTML
 */
export function sanitizeHtmlInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'a', 'ul', 'li']
  const ALLOWED_ATTR = ['href', 'title']
  
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  })
}

/**
 * Escape HTML entities - prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// ============================================
// 2. EMAIL VALIDATION
// ============================================

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  // RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  // Length check
  if (email.length > 254) return false
  
  // Format check
  if (!emailRegex.test(email)) return false
  
  // Sanitize
  return true
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (!email) return ''
  
  // Convert to lowercase
  email = email.toLowerCase().trim()
  
  // Remove any HTML/script
  email = DOMPurify.sanitize(email, { ALLOWED_TAGS: [] })
  
  // Validate
  if (!validateEmail(email)) {
    throw new Error('Invalid email format')
  }
  
  return email
}

// ============================================
// 3. PASSWORD VALIDATION
// ============================================

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] }
  }
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letters')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letters')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain numbers')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain special characters (!@#$%^&*)')
  }
  
  // Check against common passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123']
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================
// 4. PATH VALIDATION - Prevent Directory Traversal
// ============================================

/**
 * Validate and sanitize file path - prevent directory traversal
 * Ensures path is within allowed directory
 */
export function validateFilePath(filePath: string, allowedDir: string): {
  valid: boolean
  error?: string
  path?: string
} {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid file path' }
  }
  
  // Remove null bytes
  filePath = filePath.replace(/\0/g, '')
  
  // Resolve the full path
  const fullPath = path.resolve(allowedDir, filePath)
  const resolvedDir = path.resolve(allowedDir)
  
  // Check if path is within allowed directory
  if (!fullPath.startsWith(resolvedDir)) {
    return { valid: false, error: 'Path traversal detected' }
  }
  
  // Check for suspicious patterns
  if (filePath.includes('..')) {
    return { valid: false, error: 'Invalid path' }
  }
  
  if (filePath.includes('~')) {
    return { valid: false, error: 'Invalid path' }
  }
  
  return { valid: true, path: fullPath }
}

// ============================================
// 5. NUMBER VALIDATION
// ============================================

/**
 * Validate and parse integer
 */
export function validateInt(value: any, min = 0, max = 1000000): {
  valid: boolean
  value?: number
  error?: string
} {
  const num = parseInt(value, 10)
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' }
  }
  
  if (num < min || num > max) {
    return { valid: false, error: `Number must be between ${min} and ${max}` }
  }
  
  return { valid: true, value: num }
}

// ============================================
// 6. QUERY PARAMETER VALIDATION
// ============================================

/**
 * Validate query parameters
 */
export function validateQueryParams(query: any): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Query is required
  if (!query || typeof query !== 'string') {
    errors.push('Search query is required')
    return { valid: false, errors }
  }
  
  // Min length (5 chars)
  if (query.length < 5) {
    errors.push('Query must be at least 5 characters')
  }
  
  // Max length (500 chars)
  if (query.length > 500) {
    errors.push('Query must be less than 500 characters')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================
// 7. SQL INJECTION PREVENTION
// ============================================

/**
 * Check for SQL injection patterns
 * NOTE: Always use parameterized queries! This is a second layer of defense.
 */
export function detectSqlInjection(input: string): boolean {
  if (!input) return false
  
  // Patterns that might indicate SQL injection
  const patterns = [
    /('|(--)|;|\/\*|\*\/|xp_|sp_)/gi,
    /(union|select|insert|update|delete|drop|create|alter)/gi,
    /(or|and)\s*1\s*=\s*1/gi,
    /script|javascript|onerror|onclick|onload/gi,
  ]
  
  return patterns.some(pattern => pattern.test(input))
}

// ============================================
// 8. COMMAND INJECTION PREVENTION
// ============================================

/**
 * Validate input for command injection
 * NOTE: Use spawnSync with array args, not shell strings!
 */
export function detectCommandInjection(input: string): boolean {
  if (!input) return false
  
  // Patterns that might indicate command injection
  const patterns = [
    /[;&|`$(){}[\]<>\\]/g,  // Command operators
    /\$\(/g,  // Command substitution
    /`/g,  // Backticks
  ]
  
  return patterns.some(pattern => pattern.test(input))
}

// ============================================
// 9. COMPREHENSIVE INPUT VALIDATOR
// ============================================

/**
 * Main input validation function for search
 */
export function validateSearchInput(query: string): {
  valid: boolean
  sanitized?: string
  errors: string[]
} {
  const errors: string[] = []
  
  // Check type
  if (typeof query !== 'string') {
    errors.push('Query must be a string')
    return { valid: false, errors }
  }
  
  // Check length
  if (query.length < 5) {
    errors.push('Query must be at least 5 characters')
  }
  
  if (query.length > 500) {
    errors.push('Query must be less than 500 characters')
  }
  
  // Check for SQL injection
  if (detectSqlInjection(query)) {
    errors.push('Invalid characters detected')
  }
  
  // Sanitize
  const sanitized = sanitizeSearchQuery(query)
  
  if (!sanitized || sanitized.length < 5) {
    errors.push('Query is invalid after sanitization')
  }
  
  return {
    valid: errors.length === 0,
    sanitized: errors.length === 0 ? sanitized : undefined,
    errors,
  }
}

/**
 * Validate login input
 */
export function validateLoginInput(email: string, password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Validate email
  if (!validateEmail(email)) {
    errors.push('Invalid email format')
  }
  
  // Validate password exists
  if (!password || typeof password !== 'string') {
    errors.push('Password is required')
  }
  
  if (password && password.length < 8) {
    errors.push('Invalid password')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate registration input
 */
export function validateRegisterInput(
  email: string,
  password: string,
  username: string
): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Validate email
  try {
    sanitizeEmail(email)
  } catch (e) {
    errors.push('Invalid email format')
  }
  
  // Validate username
  if (!username || typeof username !== 'string') {
    errors.push('Username is required')
  }
  
  if (username && (username.length < 3 || username.length > 20)) {
    errors.push('Username must be 3-20 characters')
  }
  
  if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, - and _')
  }
  
  // Validate password
  const pwValidation = validatePassword(password)
  if (!pwValidation.valid) {
    errors.push(...pwValidation.errors)
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================
// 10. VISUAL/FACE SEARCH VALIDATION
// ============================================

/**
 * Allowed image MIME types for visual/face search
 */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]

/**
 * Maximum image file size (10MB)
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/**
 * Validate image file for visual/face search
 * Prevents: Malicious file uploads, DoS, file type attacks
 */
export function validateImageFile(file: File | Blob): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!file) {
    errors.push('No file provided')
    return { valid: false, errors }
  }
  
  // Validate file type
  const fileType = file.type?.toLowerCase()
  if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType)) {
    errors.push(`Invalid file type: ${fileType}. Allowed: JPEG, PNG, GIF, WebP`)
  }
  
  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 10MB`)
  }
  
  // Check for empty files
  if (file.size === 0) {
    errors.push('File is empty')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate visual search parameters
 */
export function validateVisualSearchParams(params: {
  limit?: number | string
  country?: string
  mediaType?: string
}): {
  valid: boolean
  sanitized: {
    limit: number
    country?: string
    mediaType?: string
  }
  errors: string[]
} {
  const errors: string[] = []
  
  // Validate and sanitize limit
  let limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : (params.limit || 20)
  if (isNaN(limit) || limit < 1) {
    limit = 20
  }
  if (limit > 50) {
    limit = 50 // Cap at 50
  }
  
  // Validate and sanitize country
  let country: string | undefined
  if (params.country) {
    // Only allow alphanumeric, max 50 chars
    country = params.country.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)
    if (!country) country = undefined
  }
  
  // Validate and sanitize media type
  const allowedMediaTypes = ['image', 'video', 'document', 'text']
  let mediaType: string | undefined
  if (params.mediaType) {
    mediaType = params.mediaType.toLowerCase()
    if (!allowedMediaTypes.includes(mediaType)) {
      mediaType = undefined
    }
  }
  
  return {
    valid: errors.length === 0,
    sanitized: { limit, country, mediaType },
    errors,
  }
}

/**
 * Validate face search specific parameters
 */
export function validateFaceSearchParams(params: {
  limit?: number | string
  includeAll?: boolean | string
}): {
  valid: boolean
  sanitized: {
    limit: number
    includeNonCentroids: boolean
  }
  errors: string[]
} {
  const errors: string[] = []
  
  // Validate and sanitize limit
  let limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : (params.limit || 20)
  if (isNaN(limit) || limit < 1) {
    limit = 20
  }
  if (limit > 50) {
    limit = 50 // Cap at 50
  }
  
  // Validate includeAll
  let includeNonCentroids = false
  if (params.includeAll === true || params.includeAll === 'true') {
    includeNonCentroids = true
  }
  
  return {
    valid: errors.length === 0,
    sanitized: { limit, includeNonCentroids },
    errors,
  }
}