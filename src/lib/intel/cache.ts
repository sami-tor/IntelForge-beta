// ================================================
// Intel Hub - In-Memory + DB Cache Layer
// ================================================
import { query } from "@/lib/db"

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const memCache = new Map<string, CacheEntry<unknown>>()

/** Get from in-memory cache. Returns null if missing or expired. */
export function memGet<T>(key: string): T | null {
  const entry = memCache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.data
}

/** Set in-memory cache with TTL in seconds. */
export function memSet<T>(key: string, data: T, ttlSeconds: number): void {
  memCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/** Invalidate a memory cache key. */
export function memDel(key: string): void {
  memCache.delete(key)
}

// ---- Feed TTLs (seconds) ----
export const TTL = {
  NEWS:            30 * 60,      // 30 min
  RANSOMWARE:      60 * 60,      // 1 hour
  CVE:             6 * 3600,     // 6 hours
  CVE_KEV:         12 * 3600,    // 12 hours
  MALWARE:         60 * 60,      // 1 hour
  MITRE:           24 * 3600,    // 24 hours
  IOC_RESULT:      60 * 60,      // 1 hour (external IOC lookups)
  STATS:           15 * 60,      // 15 min
}

// ---- Feed sync logging ----
export async function logFeedSync(
  feedName: string,
  status: "success" | "failed" | "running",
  itemsFetched = 0,
  itemsStored = 0,
  errorMessage?: string,
  durationMs?: number,
): Promise<void> {
  try {
    await query(
      `INSERT INTO intel_feed_sync_log
         (feed_name, status, items_fetched, items_stored, error_message, duration_ms, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $2 != 'running' THEN NOW() ELSE NULL END)`,
      [feedName, status, itemsFetched, itemsStored, errorMessage ?? null, durationMs ?? null],
    )
  } catch {
    // Non-fatal — don't throw
  }
}

/** Get last successful sync time for a feed. */
export async function getLastSync(feedName: string): Promise<Date | null> {
  try {
    const result = await query(
      `SELECT completed_at FROM intel_feed_sync_log
       WHERE feed_name=$1 AND status='success'
       ORDER BY completed_at DESC LIMIT 1`,
      [feedName],
    )
    if (result.success && result.data && result.data.length > 0) {
      return new Date(result.data[0].completed_at)
    }
  } catch {
    // Non-fatal
  }
  return null
}

/** Check if feed needs a refresh (last sync older than TTL). */
export async function feedNeedsRefresh(feedName: string, ttlSeconds: number): Promise<boolean> {
  const last = await getLastSync(feedName)
  if (!last) return true
  return Date.now() - last.getTime() > ttlSeconds * 1000
}

/** Safe fetch wrapper with timeout and error handling. */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Safe fetch → JSON. Returns null on any error. */
export async function safeFetchJson<T = unknown>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<T | null> {
  const res = await safeFetch(url, options, timeoutMs)
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Safe fetch → text. Returns null on any error. */
export async function safeFetchText(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<string | null> {
  const res = await safeFetch(url, options, timeoutMs)
  if (!res || !res.ok) return null
  try {
    return await res.text()
  } catch {
    return null
  }
}
