import { query } from "./db"

// User Management
export async function getAllUsers(page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const sql = `
    SELECT id, email, username, role, verification_status, subscription_type, 
           subscription_end, is_lifetime, is_active, created_at, last_login
    FROM users
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `
  return query(sql, [limit, offset])
}

export async function getUsersCount() {
  const sql = "SELECT COUNT(*) as count FROM users"
  return query(sql)
}

export async function updateUserRole(userId: number, role: string) {
  const sql = "UPDATE users SET role = $1 WHERE id = $2 RETURNING *"
  return query(sql, [role, userId])
}

export async function updateUserVerification(userId: number, status: string) {
  const sql = "UPDATE users SET verification_status = $1 WHERE id = $2 RETURNING *"
  return query(sql, [status, userId])
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const sql = "UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *"
  return query(sql, [isActive, userId])
}

export async function updateUserSubscription(
  userId: number,
  subscriptionType: string,
  durationValue: number | null,
  durationUnit: string | null,
  isLifetime: boolean,
) {
  let subscriptionEnd = null
  if (!isLifetime && durationValue && durationUnit) {
    const now = new Date()
    if (durationUnit === "days") {
      subscriptionEnd = new Date(now.setDate(now.getDate() + durationValue))
    } else if (durationUnit === "weeks") {
      subscriptionEnd = new Date(now.setDate(now.getDate() + durationValue * 7))
    } else if (durationUnit === "months") {
      subscriptionEnd = new Date(now.setMonth(now.getMonth() + durationValue))
    } else if (durationUnit === "years") {
      subscriptionEnd = new Date(now.setFullYear(now.getFullYear() + durationValue))
    }
  }

  // Determine search_limit based on subscription type
  let searchLimit = 50 // Free default
  if (subscriptionType === "starter") {
    searchLimit = 500
  } else if (subscriptionType === "professional" || subscriptionType === "security_analyst") {
    searchLimit = 1500
  } else if (subscriptionType === "enterprise" || subscriptionType === "api_access_fair") {
    searchLimit = 999999 // Unlimited
  }

  const sql = `
    UPDATE users 
    SET subscription_type = $1, 
        subscription_start = CURRENT_DATE,
        subscription_end = $2,
        subscription_duration_value = $3,
        subscription_duration_unit = $4,
        is_lifetime = $5,
        search_limit = $6,
        search_count = 0
    WHERE id = $7
    RETURNING *
  `
  return query(sql, [subscriptionType, subscriptionEnd, durationValue, durationUnit, isLifetime, searchLimit, userId])
}

export async function deleteUser(userId: number) {
  const sql = "DELETE FROM users WHERE id = $1"
  return query(sql, [userId])
}

// Subscription Management
export async function getAllSubscriptions() {
  const sql = "SELECT * FROM subscriptions ORDER BY price ASC"
  return query(sql)
}

export async function createSubscription(
  name: string,
  description: string,
  price: number,
  durationValue: number | null,
  durationUnit: string | null,
  isLifetime: boolean,
  features: string[],
) {
  const sql = `
    INSERT INTO subscriptions (name, description, price, duration_value, duration_unit, is_lifetime, features)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `
  return query(sql, [name, description, price, durationValue, durationUnit, isLifetime, JSON.stringify(features)])
}

export async function updateSubscription(
  id: number,
  name: string,
  description: string,
  price: number,
  durationValue: number | null,
  durationUnit: string | null,
  isLifetime: boolean,
  features: string[],
) {
  const sql = `
    UPDATE subscriptions 
    SET name = $1, description = $2, price = $3, duration_value = $4, 
        duration_unit = $5, is_lifetime = $6, features = $7, updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `
  return query(sql, [name, description, price, durationValue, durationUnit, isLifetime, JSON.stringify(features), id])
}

export async function deleteSubscription(id: number) {
  const sql = "DELETE FROM subscriptions WHERE id = $1"
  return query(sql, [id])
}

// Contact/Feedback Management
export async function getAllContactMessages(status?: string) {
  let sql = "SELECT * FROM contact_messages ORDER BY created_at DESC"
  const params: any[] = []

  if (status) {
    sql = "SELECT * FROM contact_messages WHERE status = $1 ORDER BY created_at DESC"
    params.push(status)
  }

  return query(sql, params)
}

export async function updateContactMessageStatus(id: number, status: string, adminNotes?: string) {
  const sql = `
    UPDATE contact_messages 
    SET status = $1, admin_notes = $2, responded_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `
  return query(sql, [status, adminNotes, id])
}

export async function deleteContactMessage(id: number) {
  const sql = "DELETE FROM contact_messages WHERE id = $1"
  return query(sql, [id])
}

// Admin Logs
export async function logAdminAction(
  adminId: number,
  action: string,
  targetType: string,
  targetId: number,
  details: object,
) {
  const sql = `
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `
  return query(sql, [adminId, action, targetType, targetId, JSON.stringify(details)])
}

export async function getAdminLogs(limit = 50) {
  const sql = `
    SELECT al.*, u.username as admin_username
    FROM admin_logs al
    LEFT JOIN users u ON al.admin_id = u.id
    ORDER BY al.created_at DESC
    LIMIT $1
  `
  return query(sql, [limit])
}

// Dashboard Stats
export async function getDashboardStats() {
  const totalUsers = await query("SELECT COUNT(*) as count FROM users")
  const activeUsers = await query("SELECT COUNT(*) as count FROM users WHERE is_active = true")
  const pendingVerifications = await query("SELECT COUNT(*) as count FROM users WHERE verification_status = 'pending'")
  const unreadMessages = await query("SELECT COUNT(*) as count FROM contact_messages WHERE status = 'unread'")
  const totalSearches = await query("SELECT COUNT(*) as count FROM search_history")
  const totalFiles = await query("SELECT COUNT(*) as count FROM uploaded_files")

  const parseCount = (result: any) => Number.parseInt(result?.data?.[0]?.count ?? "0", 10)

  return {
    totalUsers: parseCount(totalUsers),
    activeUsers: parseCount(activeUsers),
    pendingVerifications: parseCount(pendingVerifications),
    unreadMessages: parseCount(unreadMessages),
    totalSearches: parseCount(totalSearches),
    totalFiles: parseCount(totalFiles),
  }
}
