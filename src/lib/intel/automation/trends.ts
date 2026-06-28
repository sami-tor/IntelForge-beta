// ================================================
// IntelForge Automation - Trend / KPI Tracker
// ------------------------------------------------
// Captures one daily counter per metric_key, computes
// percent delta vs yesterday, and flags "emerging"
// metrics for the dashboard.
// ================================================
import { query } from "@/lib/db"

interface MetricDefinition {
  key: string
  label: string
  /** SQL must return a single column "c" (count). */
  sql: string
  /** % delta threshold for emerging flag. */
  emergingThresholdPct: number
  /** Absolute value below which delta % is ignored (avoids 0->1 = +inf). */
  minBaseline: number
}

const METRICS: MetricDefinition[] = [
  {
    key: "cve_critical_24h",
    label: "Critical CVEs (24h)",
    sql: `SELECT COUNT(*) c FROM intel_cve_cache
          WHERE cvss_v3_severity = 'CRITICAL' AND published_at > NOW() - INTERVAL '24 hours'`,
    emergingThresholdPct: 50,
    minBaseline: 2,
  },
  {
    key: "cve_kev_total",
    label: "Known Exploited (total)",
    sql: `SELECT COUNT(*) c FROM intel_cve_cache WHERE is_kev = true`,
    emergingThresholdPct: 5,
    minBaseline: 50,
  },
  {
    key: "ransomware_victims_7d",
    label: "Ransomware Victims (7d)",
    sql: `SELECT COUNT(*) c FROM intel_ransomware_victims
          WHERE discovered_at > NOW() - INTERVAL '7 days'`,
    emergingThresholdPct: 30,
    minBaseline: 5,
  },
  {
    key: "phishing_active",
    label: "Active Phishing URLs",
    sql: `SELECT COUNT(*) c FROM intel_phishing_cache WHERE active = true`,
    emergingThresholdPct: 25,
    minBaseline: 100,
  },
  {
    key: "exploits_24h",
    label: "Public Exploits (24h)",
    sql: `SELECT COUNT(*) c FROM intel_exploit_cache
          WHERE published_at > NOW() - INTERVAL '24 hours'`,
    emergingThresholdPct: 50,
    minBaseline: 2,
  },
  {
    key: "malware_24h",
    label: "Malware Samples (24h)",
    sql: `SELECT COUNT(*) c FROM intel_malware_cache
          WHERE first_seen > NOW() - INTERVAL '24 hours'`,
    emergingThresholdPct: 40,
    minBaseline: 20,
  },
  {
    key: "darknet_posts_24h",
    label: "Dark-web posts (24h)",
    sql: `SELECT COUNT(*) c FROM intel_darknet_posts
          WHERE discovered_at > NOW() - INTERVAL '24 hours'`,
    emergingThresholdPct: 50,
    minBaseline: 5,
  },
]

async function safeCount(sql: string): Promise<number> {
  const r = await query(sql, [])
  if (!r.success || !r.data?.length) return 0
  const v = Number((r.data[0] as Record<string, unknown>).c)
  return Number.isFinite(v) ? v : 0
}

async function getYesterdayValue(metricKey: string): Promise<number | null> {
  const r = await query(
    `SELECT value FROM intel_trend_metrics
     WHERE metric_key = $1
     ORDER BY bucket_date DESC
     LIMIT 1`,
    [metricKey],
  )
  if (!r.success || !r.data?.length) return null
  return Number((r.data[0] as Record<string, unknown>).value)
}

export interface TrendCaptureResult {
  captured: number
  emerging: Array<{ key: string; label: string; deltaPct: number; value: number; previous: number }>
}

/**
 * Capture today's value for every metric, compute delta vs prior bucket,
 * upsert into intel_trend_metrics, and return any newly-emerging metrics.
 */
export async function captureTrends(): Promise<TrendCaptureResult> {
  const emerging: TrendCaptureResult["emerging"] = []
  let captured = 0

  for (const metric of METRICS) {
    const value = await safeCount(metric.sql)
    const previous = await getYesterdayValue(metric.key)

    let deltaPct = 0
    let isEmerging = false
    if (previous !== null && previous >= metric.minBaseline) {
      deltaPct = ((value - previous) / Math.max(1, previous)) * 100
      if (deltaPct >= metric.emergingThresholdPct) {
        isEmerging = true
      }
    }

    await query(
      `INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
       ON CONFLICT (metric_key, bucket_date) DO UPDATE SET
         value       = EXCLUDED.value,
         metric_label= EXCLUDED.metric_label,
         delta_pct   = EXCLUDED.delta_pct,
         is_emerging = EXCLUDED.is_emerging,
         captured_at = NOW()`,
      [metric.key, metric.label, value, Number(deltaPct.toFixed(2)), isEmerging],
    )

    captured++
    if (isEmerging) {
      emerging.push({
        key: metric.key,
        label: metric.label,
        deltaPct: Number(deltaPct.toFixed(1)),
        value,
        previous: previous ?? 0,
      })
    }
  }

  return { captured, emerging }
}

export interface TrendSeries {
  key: string
  label: string
  series: Array<{ date: string; value: number }>
  current: number
  previous: number
  deltaPct: number
  isEmerging: boolean
}

/**
 * Pull `days` of history for every tracked metric, plus the latest delta flag.
 */
export async function getTrendSeries(days = 14): Promise<TrendSeries[]> {
  const r = await query(
    `SELECT metric_key, metric_label, bucket_date, value, delta_pct, is_emerging
     FROM intel_trend_metrics
     WHERE bucket_date > CURRENT_DATE - ($1 || ' days')::interval
     ORDER BY metric_key, bucket_date ASC`,
    [String(days)],
  )

  const grouped = new Map<string, TrendSeries>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const key = String(row.metric_key)
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: String(row.metric_label || key),
        series: [],
        current: 0,
        previous: 0,
        deltaPct: 0,
        isEmerging: false,
      })
    }
    const series = grouped.get(key)!
    const value = Number(row.value)
    series.series.push({
      date: (row.bucket_date as Date).toISOString().slice(0, 10),
      value,
    })
    series.previous = series.current
    series.current = value
    series.deltaPct = Number(row.delta_pct) || 0
    series.isEmerging = Boolean(row.is_emerging)
  }

  return [...grouped.values()]
}
