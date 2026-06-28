import { query } from "./db"

/**
 * Security Audit Logging
 * Tracks all privilege escalations, role changes, and suspicious activities
 */

export interface SecurityAuditLog {
  event_type: string
  user_id: number | null
  ip_address: string | null
  user_agent: string | null
  details: Record<string, any>
  severity: "low" | "medium" | "high" | "critical"
  timestamp: Date
}

/**
 * Log security events to database and console
 */
export async function logSecurityAudit(
  eventType: string,
  details: Record<string, any>,
  userId: number | null = null,
  ipAddress: string | null = null,
  userAgent: string | null = null,
  severity: "low" | "medium" | "high" | "critical" = "medium"
) {
  const timestamp = new Date()
  
  const shouldConsoleLog = process.env.NODE_ENV === "development"
  const key = `${eventType}:${userId || "anon"}:${ipAddress || "noip"}:${userAgent || "noua"}`
  ;(global as any).__SEC_AUDIT_LAST__ = (global as any).__SEC_AUDIT_LAST__ || new Map<string, number>()
  const lastMap: Map<string, number> = (global as any).__SEC_AUDIT_LAST__
  const now = Date.now()
  const last = lastMap.get(key) || 0
  const throttleMs = 10000
  if (shouldConsoleLog && now - last >= throttleMs) {
    lastMap.set(key, now)
    console.warn(`[SECURITY-AUDIT] [${severity.toUpperCase()}] ${eventType}`, {
      userId,
      ipAddress,
      timestamp: timestamp.toISOString(),
      details,
    })
  }

  // Log to database if table exists
  try {
    // SECURITY: Use INSERT without ON CONFLICT - security logs should always be inserted
    // If there's a conflict, it means duplicate logging which is acceptable
    const sql = `
      INSERT INTO security_audit_logs (
        event_type, user_id, ip_address, user_agent, details, severity, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
    await query(sql, [
      eventType,
      userId,
      ipAddress,
      userAgent,
      JSON.stringify(details),
      severity,
      timestamp,
    ])
  } catch (error) {
    // Table might not exist yet, or there's a constraint violation
    // Log to console but don't fail the operation
    if (process.env.NODE_ENV === "development") {
      console.error("[SECURITY-AUDIT] Failed to write to database:", error)
    }
  }
}

/**
 * Log unauthorized access attempts (not privilege escalation)
 */
export async function logUnauthorizedAccess(
  userId: number,
  endpoint: string,
  method: string,
  ipAddress: string | null,
  userAgent: string | null,
  reason: string
) {
  await logSecurityAudit(
    "UNAUTHORIZED_ACCESS_ATTEMPT",
    {
      endpoint,
      method,
      reason,
      message: `User ${userId} attempted to access ${method} ${endpoint} - ${reason}`,
    },
    userId,
    ipAddress,
    userAgent,
    "medium" // Lower severity than privilege escalation
  )
}
export async function logPrivilegeEscalation(
  userId: number,
  attemptedRole: string,
  actualRole: string,
  ipAddress: string | null,
  userAgent: string | null,
  endpoint: string,
  method: string
) {
  await logSecurityAudit(
    "PRIVILEGE_ESCALATION_ATTEMPT",
    {
      attemptedRole,
      actualRole,
      endpoint,
      method,
      message: `User ${userId} attempted to use ${attemptedRole} privileges but has ${actualRole} role`,
    },
    userId,
    ipAddress,
    userAgent,
    "critical"
  )
}

/**
 * Log role/quota modification attempts
 */
export async function logUnauthorizedModification(
  userId: number,
  field: string,
  attemptedValue: any,
  ipAddress: string | null,
  userAgent: string | null,
  endpoint: string
) {
  await logSecurityAudit(
    "UNAUTHORIZED_FIELD_MODIFICATION",
    {
      field,
      attemptedValue,
      endpoint,
      message: `User ${userId} attempted to modify forbidden field: ${field}`,
    },
    userId,
    ipAddress,
    userAgent,
    "high"
  )
}

/**
 * Log successful role/quota changes (admin actions)
 */
export async function logPrivilegeChange(
  adminId: number,
  targetUserId: number,
  field: string,
  oldValue: any,
  newValue: any,
  ipAddress: string | null
) {
  await logSecurityAudit(
    "PRIVILEGE_CHANGE",
    {
      adminId,
      targetUserId,
      field,
      oldValue,
      newValue,
      message: `Admin ${adminId} changed ${field} for user ${targetUserId} from ${oldValue} to ${newValue}`,
    },
    adminId,
    ipAddress,
    null,
    "high"
  )
}

/**
 * Log suspicious quota jumps
 */
export async function logQuotaAnomaly(
  userId: number,
  oldQuota: number,
  newQuota: number,
  ipAddress: string | null
) {
  const jumpPercent = ((newQuota - oldQuota) / oldQuota) * 100
  
  if (jumpPercent > 100) {
    await logSecurityAudit(
      "QUOTA_ANOMALY",
      {
        oldQuota,
        newQuota,
        jumpPercent: jumpPercent.toFixed(2),
        message: `Suspicious quota jump detected for user ${userId}: ${oldQuota} -> ${newQuota} (${jumpPercent.toFixed(2)}% increase)`,
      },
      userId,
      ipAddress,
      null,
      "high"
    )
  }
}

