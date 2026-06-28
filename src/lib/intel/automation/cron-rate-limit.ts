// ================================================
// IntelForge Automation - Cron Rate Limit
// ------------------------------------------------
// Even with CRON_SECRET, a leaked token shouldn't
// be able to flood the orchestrator. We cap calls
// per (endpoint, ip) per minute using the
// intel_cron_rate_log table.
// ================================================
import { query } from "@/lib/db"

const DEFAULT_CAP_PER_MINUTE = 10

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  resetIn: number   // seconds until the window resets
}

export async function checkCronRateLimit(
  endpoint: string,
  clientIp: string,
  capPerMinute = DEFAULT_CAP_PER_MINUTE,
): Promise<RateLimitDecision> {
  const r = await query(
    `SELECT COUNT(*) AS c FROM intel_cron_rate_log
     WHERE endpoint = $1 AND client_ip = $2
       AND called_at > NOW() - INTERVAL '60 seconds'`,
    [endpoint, clientIp || "unknown"],
  )
  const used = r.success ? Number((r.data?.[0] as Record<string, unknown> | undefined)?.c ?? 0) : 0
  const remaining = Math.max(0, capPerMinute - used - 1)
  if (used >= capPerMinute) {
    return { allowed: false, remaining: 0, resetIn: 60 }
  }
  await query(
    `INSERT INTO intel_cron_rate_log (endpoint, client_ip) VALUES ($1, $2)`,
    [endpoint, clientIp || "unknown"],
  )
  return { allowed: true, remaining, resetIn: 60 }
}

/** Periodic cleanup so the log never grows unboundedly. */
export async function pruneCronRateLog(): Promise<void> {
  await query(
    `DELETE FROM intel_cron_rate_log
     WHERE called_at < NOW() - INTERVAL '1 hour'`,
    [],
  )
}
