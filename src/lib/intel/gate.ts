// ================================================
// Intel Hub - Subscription Access Gate
// Checks user tier and enforces per-feature limits
// ================================================
import { INTEL_LIMITS, type IntelFeature } from "@/lib/intel/types"
import { query } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"

export interface GateResult {
  allowed: boolean
  limit: number          // -1 = unlimited
  reason?: string
  upgradeRequired?: string
}

/** Resolve plan name from user object / subscription_type */
function resolvePlan(user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null): string {
  if (!user) return "free"
  if (user.role === "admin") return "admin"
  if (user.is_lifetime) return "enterprise"
  const sub = (user.subscription_type || "free").toLowerCase()
  return INTEL_LIMITS[sub] ? sub : "free"
}

/** Get the limit for a given feature + plan */
function getLimit(plan: string, feature: IntelFeature): number {
  const planLimits = INTEL_LIMITS[plan] || INTEL_LIMITS.free
  const limit = planLimits.find((l) => l.feature === feature)
  return limit?.limit ?? 0
}

/** Check if a user can access a feature, enforcing DB-backed daily counts for IOC/breach. */
export async function checkIntelAccess(
  user: { id?: number; role?: string; subscription_type?: string; is_lifetime?: boolean } | null,
  feature: IntelFeature,
): Promise<GateResult> {
  const plan = resolvePlan(user)
  const limit = getLimit(plan, feature)

  if (limit === 0) {
    const upgradeMsg =
      plan === "free" ? "starter"
      : plan === "starter" ? "professional"
      : "enterprise"
    return {
      allowed: false,
      limit: 0,
      reason: `${feature} requires a higher subscription tier`,
      upgradeRequired: upgradeMsg,
    }
  }

  if (limit === -1) {
    return { allowed: true, limit: -1 }
  }

  // For features with daily quotas, use in-memory rate limiter
  // keyed by userId or IP
  if (feature === "ioc_lookup" || feature === "breach_monitor") {
    const key = user?.id ? `intel:${feature}:user:${user.id}` : `intel:${feature}:anon`
    const rl = rateLimit(key, { maxRequests: limit, windowMs: 24 * 60 * 60 * 1000 })
    if (!rl.allowed) {
      return {
        allowed: false,
        limit,
        reason: `Daily limit of ${limit} ${feature} lookups reached. Resets in ${Math.ceil((rl.resetAt - Date.now()) / 3600000)}h`,
        upgradeRequired: plan === "free" ? "starter" : plan === "starter" ? "professional" : undefined,
      }
    }
    return { allowed: true, limit }
  }

  return { allowed: true, limit }
}

/** Get how many IOC lookups the user has left today. */
export async function getIOCRemainingToday(
  userId: number | undefined,
  plan: string,
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = getLimit(plan, "ioc_lookup")
  if (limit === -1) return { used: 0, limit: -1, remaining: -1 }

  const result = await query(
    `SELECT COUNT(*) as used FROM intel_ioc_lookups
     WHERE user_id = $1 AND queried_at > NOW() - INTERVAL '24 hours'`,
    [userId ?? -1],
  )

  const used = Number(result.data?.[0]?.used) || 0
  return { used, limit, remaining: Math.max(0, limit - used) }
}

/** Log an IOC lookup to DB (for quota tracking). */
export async function logIOCLookup(
  userId: number | null,
  iocType: string,
  iocValue: string,
  result: unknown,
): Promise<void> {
  try {
    await query(
      `INSERT INTO intel_ioc_lookups (user_id, ioc_type, ioc_value, result)
       VALUES ($1,$2,$3,$4)`,
      [userId, iocType, iocValue, JSON.stringify(result)],
    )
  } catch {
    // Non-fatal
  }
}

/** Simple helper: is user on a paid plan? */
export function isPaidUser(user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  if (user.is_lifetime) return true
  const sub = (user.subscription_type || "free").toLowerCase()
  return ["starter", "professional", "enterprise", "api_access"].includes(sub)
}

/** Upgrade message for a plan */
export function upgradeMessage(plan: string): string {
  const messages: Record<string, string> = {
    free: "Upgrade to Starter to unlock more intel features.",
    starter: "Upgrade to Professional for unlimited access.",
    professional: "Upgrade to Enterprise for unlimited everything.",
  }
  return messages[plan] || "Upgrade your plan to access this feature."
}
