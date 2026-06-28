import { Pool } from "pg"
import bcrypt from "bcryptjs"

let pool: Pool | null = null
let isConnected = false

// Database connection with retry logic
// Set DATABASE_URL in your environment variables
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  if (!pool) {
    const isProduction = process.env.NODE_ENV === "production"
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: isProduction ? 50 : 20, // Larger pool in production
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // Increased from 2s
      statement_timeout: 30000, // 30s query timeout
      query_timeout: 30000,
    })
    
    // Connection error handling
    pool.on('error', (err) => {
      console.error('[DB] Unexpected database pool error:', err)
      isConnected = false
    })
    
    pool.on('connect', () => {
      if (!isConnected) {
        isConnected = true
      }
    })
    
    pool.on('remove', () => {
    })
  }
  return pool
}

// Health check for database
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; message: string; latency?: number }> {
  try {
    const start = Date.now()
    const db = getDb()
    await db.query('SELECT 1')
    const latency = Date.now() - start
    return { healthy: true, message: 'Database connection OK', latency }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed'
    return { healthy: false, message }
  }
}

// Database query helpers
export async function query(sqlString: string, params: any[] = []) {
  const db = getDb()
  try {
    // PostgreSQL expects parameterized queries with $1, $2, etc.
    const result = await db.query(sqlString, params)
    return { success: true, data: result.rows }
  } catch (error) {
    // SECURITY: Don't log full database errors in production
    if (process.env.NODE_ENV === "development") {
      console.error("[DB] Database query error:", error)
    }
    // Return sanitized error message (no database structure details)
    const errorMessage = error instanceof Error ? error.message : "Database error"
    return { success: false, error: errorMessage }
  }
}

// User operations
export async function createUser(email: string, passwordHash: string, username: string) {
  const sql = `
    INSERT INTO users (email, password_hash, username, verification_status)
    VALUES ($1, $2, $3, 'verified')
    RETURNING id, email, username, role, verification_status, created_at
  `
  return query(sql, [email, passwordHash, username])
}

export async function getUserByEmail(email: string) {
  const sql = "SELECT * FROM users WHERE email = $1"
  return query(sql, [email])
}

export async function getUserById(id: number) {
  const sql = "SELECT id, email, username, account_type, created_at FROM users WHERE id = $1"
  return query(sql, [id])
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const sql = "UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *"
  return query(sql, [isActive, userId])
}

export async function updateUserProfile(userId: number, email: string, username: string) {
  const sql = "UPDATE users SET email = $1, username = $2 WHERE id = $3 RETURNING id, email, username"
  return query(sql, [email, username, userId])
}

export async function getUserPasswordHash(userId: number) {
  const sql = "SELECT password_hash FROM users WHERE id = $1"
  return query(sql, [userId])
}

export async function updateUserPassword(userId: number, newPassword: string) {
  // SECURITY: Use bcrypt rounds of 12 for better security (consistent with registration)
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10)
  const passwordHash = await bcrypt.hash(newPassword, bcryptRounds)
  const sql = "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id"
  return query(sql, [passwordHash, userId])
}

export async function deleteUser(userId: number) {
  const sql = "DELETE FROM users WHERE id = $1"
  return query(sql, [userId])
}

export async function logLoginActivity(userId: number, ipAddress: string, userAgent: string) {
  const sql = `
    INSERT INTO login_activity (user_id, ip_address, user_agent)
    VALUES ($1, $2, $3)
  `
  return query(sql, [userId, ipAddress, userAgent])
}

// ============================================
// QUOTA MANAGEMENT
// ============================================

/**
 * Get user's current search quota for this month
 */
export async function getUserMonthlyQuota(userId: number) {
  const sql = `
    SELECT * FROM user_monthly_quota 
    WHERE user_id = $1 
    AND year_month = TO_CHAR(NOW(), 'YYYY-MM')
  `
  return query(sql, [userId])
}

/**
 * Increment search count for user
 * Updates both user_monthly_quota and users.search_count for immediate dashboard updates
 */
export async function incrementSearchCount(userId: number) {
  // Update user_monthly_quota table
  const quotaSql = `
    INSERT INTO user_monthly_quota (user_id, year_month, searches_used, results_viewed)
    VALUES ($1, TO_CHAR(NOW(), 'YYYY-MM'), 1, 0)
    ON CONFLICT (user_id, year_month) 
    DO UPDATE SET 
      searches_used = user_monthly_quota.searches_used + 1,
      updated_at = NOW()
    RETURNING *
  `
  await query(quotaSql, [userId])
  
  // Also update users.search_count for immediate dashboard display
  const userSql = `
    UPDATE users 
    SET search_count = search_count + 1 
    WHERE id = $1
    RETURNING search_count
  `
  return query(userSql, [userId])
}

/**
 * Increment result count for user
 */
export async function incrementResultCount(userId: number, resultCount: number) {
  const sql = `
    INSERT INTO user_monthly_quota (user_id, year_month, searches_used, results_viewed)
    VALUES ($1, TO_CHAR(NOW(), 'YYYY-MM'), 0, $2)
    ON CONFLICT (user_id, year_month) 
    DO UPDATE SET 
      results_viewed = user_monthly_quota.results_viewed + $2,
      updated_at = NOW()
    RETURNING *
  `
  return query(sql, [userId, resultCount])
}

/**
 * Check if user has exceeded quota
 */
export async function hasExceededQuota(userId: number, userType: string) {
  // Get user subscription details
  const userResult = await query("SELECT * FROM users WHERE id = $1", [userId])
  if (!userResult.success || !userResult.data || userResult.data.length === 0) {
    return true
  }
  
  const user = userResult.data[0]
  
  // Lifetime/Premium users have unlimited
  if (user.is_lifetime || user.subscription_type === "premium" || user.subscription_type?.includes("analyst")) {
    return false
  }
  
  // Get current month quota
  const quotaResult = await getUserMonthlyQuota(userId)
  if (!quotaResult.success) return true
  
  const quota = quotaResult.data?.[0]
  if (!quota) return false // No quota yet, user can search
  
  // Free users: 50 searches/month
  const searchLimit = 50
  return quota.searches_used >= searchLimit
}

/**
 * Get quota status for user
 */
export async function getQuotaStatus(userId: number) {
  const userResult = await query("SELECT subscription_type, is_lifetime FROM users WHERE id = $1", [userId])
  if (!userResult.success || !userResult.data || userResult.data.length === 0) {
    return { searches_used: 0, searches_limit: 0, results_used: 0, results_limit: 0 }
  }
  
  const user = userResult.data[0]
  
  // Unlimited for premium/lifetime
  if (user.is_lifetime || user.subscription_type === "premium") {
    return { searches_used: 0, searches_limit: -1, results_used: 0, results_limit: -1 }
  }
  
  const quotaResult = await getUserMonthlyQuota(userId)
  if (!quotaResult.success || !quotaResult.data || quotaResult.data.length === 0) {
    return { searches_used: 0, searches_limit: 50, results_used: 0, results_limit: 10000 }
  }
  
  const quota = quotaResult.data[0]
  return {
    searches_used: quota.searches_used || 0,
    searches_limit: 50,
    results_used: quota.results_used || 0,
    results_limit: 10000
  }
}

export async function getLoginActivity(userId: number, limit = 20) {
  const sql = `
    SELECT id, ip_address, user_agent, created_at
    FROM login_activity
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `
  return query(sql, [userId, limit])
}

// Search history operations
export async function saveSearchHistory(
  userId: number,
  searchQuery: string,
  searchType: string,
  resultsCount: number,
  ipAddress?: string,
) {
  const sql = `
    INSERT INTO search_history (user_id, query, search_type, results_count, ip_address)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `
  return query(sql, [userId, searchQuery, searchType, resultsCount, ipAddress || "unknown"])
}

// Save search log for admin panel (includes all searches)
export async function saveSearchLog(
  userId: string | number,
  username: string,
  userType: string,
  searchType: string,
  searchQuery: string,
  resultsCount: number,
  ipAddress: string,
) {
  const sql = `
    INSERT INTO search_logs (user_id, username, user_type, search_type, search_query, results_count, ip_address, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id
  `
  const userIdValue = userId === "anonymous" ? null : parseInt(userId.toString())
  return query(sql, [userIdValue, username, userType, searchType, searchQuery, resultsCount, ipAddress])
}

export async function getSearchHistory(userId: number, limit = 50) {
  const sql = `
    SELECT * FROM search_history
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `
  return query(sql, [userId, limit])
}

// File operations
export async function saveUploadedFile(
  userId: number,
  filename: string,
  fileSize: number,
  fileType: string,
  uploadPath: string,
) {
  const sql = `
    INSERT INTO uploaded_files (user_id, filename, file_size, file_type, upload_path)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `
  return query(sql, [userId, filename, fileSize, fileType, uploadPath])
}

export async function updateFileStatus(fileId: number, status: string) {
  const sql = `
    UPDATE uploaded_files
    SET status = $1, processed_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `
  return query(sql, [status, fileId])
}

export async function getUploadedFiles(userId: number) {
  const sql = `
    SELECT * FROM uploaded_files
    WHERE user_id = $1
    ORDER BY created_at DESC
  `
  return query(sql, [userId])
}

// Extracted data operations
export async function saveExtractedData(fileId: number, dataType: string, content: string, metadata: object) {
  const sql = `
    INSERT INTO extracted_data (file_id, data_type, content, metadata)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `
  return query(sql, [fileId, dataType, content, JSON.stringify(metadata)])
}

export async function getExtractedData(fileId: number) {
  const sql = "SELECT * FROM extracted_data WHERE file_id = $1"
  return query(sql, [fileId])
}

// API key operations
export async function createApiKey(userId: number, keyName: string) {
  const apiKey = `if_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
  const sql = `
    INSERT INTO api_keys (user_id, api_key, key_name)
    VALUES ($1, $2, $3)
    RETURNING id, api_key, key_name, created_at
  `
  return query(sql, [userId, apiKey, keyName])
}

export async function validateApiKey(apiKey: string) {
  const sql = `
    UPDATE api_keys
    SET last_used = CURRENT_TIMESTAMP
    WHERE api_key = $1 AND is_active = true
    RETURNING user_id
  `
  return query(sql, [apiKey])
}

// OSINT search functions for database queries
export async function searchOsintCredentials(searchQuery: string, limit = 100) {
  const sql = `
    SELECT 'credential' as type, url, username, password, domain, 'database' as filename
    FROM osint_credentials
    WHERE url ILIKE $1 OR username ILIKE $1 OR domain ILIKE $1
    LIMIT $2
  `
  return query(sql, [`%${searchQuery}%`, limit])
}

export async function searchOsintDirectories(searchQuery: string, limit = 100) {
  const sql = `
    SELECT 'directory' as type, directory, ip, url, username, password, domain, 'database' as filename
    FROM osint_directories
    WHERE directory ILIKE $1 OR ip ILIKE $1 OR url ILIKE $1 OR domain ILIKE $1
    LIMIT $2
  `
  return query(sql, [`%${searchQuery}%`, limit])
}

export async function searchOsintRawData(searchQuery: string, limit = 100) {
  const sql = `
    SELECT 'raw' as type, raw_data, data_type, 'database' as filename
    FROM osint_raw_data
    WHERE raw_data ILIKE $1
    LIMIT $2
  `
  return query(sql, [`%${searchQuery}%`, limit])
}

export async function getSearchDirectories() {
  const sql = "SELECT * FROM search_directories WHERE is_active = true ORDER BY priority DESC"
  return query(sql, [])
}
