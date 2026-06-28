// ================================================
// IntelForge Automation - Forecast + Anomaly
// ------------------------------------------------
// Forecast:  Holt's linear exponential smoothing
//            (level + trend) over the trend-metric
//            history. Cheap, deterministic, no deps.
//
// Anomaly:   z-score over 14-day window. Anything
//            with |z| >= 2 is flagged spike or drop.
// ================================================
import { query } from "@/lib/db"
import { emitAutomationEvent } from "./events"

export interface ForecastPoint {
  metricKey: string
  metricLabel?: string
  date: string
  predicted: number
  lower: number
  upper: number
  confidence: number
}

export interface AnomalyPoint {
  metricKey: string
  metricLabel?: string
  bucketDate: string
  value: number
  expectedValue: number
  zScore: number
  severity: "info" | "low" | "medium" | "high" | "critical"
  direction: "spike" | "drop"
  explanation: string
}

interface MetricSeriesRow {
  metric_key: string
  metric_label: string | null
  bucket_date: Date
  value: number
}

async function loadHistory(daysBack = 30): Promise<Map<string, MetricSeriesRow[]>> {
  const r = await query(
    `SELECT metric_key, metric_label, bucket_date, value
     FROM intel_trend_metrics
     WHERE bucket_date > CURRENT_DATE - ($1 || ' days')::interval
     ORDER BY metric_key, bucket_date ASC`,
    [String(daysBack)],
  )
  const grouped = new Map<string, MetricSeriesRow[]>()
  for (const row of (r.data || []) as MetricSeriesRow[]) {
    const key = row.metric_key
    const list = grouped.get(key) ?? []
    list.push(row)
    grouped.set(key, list)
  }
  return grouped
}

/**
 * Holt's linear exponential smoothing.
 *   level_t = α·y_t + (1-α)·(level_{t-1} + trend_{t-1})
 *   trend_t = β·(level_t - level_{t-1}) + (1-β)·trend_{t-1}
 *   forecast_{t+h} = level_t + h·trend_t
 *
 * Returns the level, trend, and the residual standard deviation
 * which we use to build a ±1.96σ prediction interval.
 */
function holt(
  values: number[],
  alpha = 0.5,
  beta = 0.2,
): { level: number; trend: number; sigma: number } {
  if (values.length < 2) {
    const v = values[0] ?? 0
    return { level: v, trend: 0, sigma: 0 }
  }

  let level = values[0]
  let trend = values[1] - values[0]
  const residuals: number[] = []

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level
    const prevTrend = trend
    const obs = values[i]
    level = alpha * obs + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend

    const fitted = prevLevel + prevTrend
    residuals.push(obs - fitted)
  }

  const meanRes = residuals.reduce((a, b) => a + b, 0) / Math.max(1, residuals.length)
  const variance =
    residuals.reduce((acc, r) => acc + (r - meanRes) ** 2, 0) / Math.max(1, residuals.length - 1)
  const sigma = Math.sqrt(Math.max(0, variance))

  return { level, trend, sigma }
}

function forecastConfidence(seriesLength: number, sigma: number, level: number): number {
  // Long, low-variance series -> high confidence
  const lengthFactor = Math.min(1, seriesLength / 14)
  const noiseFactor =
    level > 0 ? Math.max(0, 1 - sigma / Math.max(1, Math.abs(level))) : 0
  const score = (lengthFactor * 0.6 + noiseFactor * 0.4) * 100
  return Math.max(20, Math.min(95, Math.round(score)))
}

export interface ForecastResult {
  generated: ForecastPoint[]
  anomalies: AnomalyPoint[]
}

/**
 * Generate forecasts and detect anomalies for every tracked metric.
 * Persists to intel_metric_forecasts and intel_anomalies.
 */
export async function generateForecastsAndAnomalies(horizonDays = 7): Promise<ForecastResult> {
  const history = await loadHistory(30)
  const forecasts: ForecastPoint[] = []
  const anomalies: AnomalyPoint[] = []

  for (const [metricKey, rows] of history) {
    if (rows.length < 4) continue // need a real series

    const values = rows.map((r) => Number(r.value))
    const label = rows[rows.length - 1].metric_label ?? metricKey

    // ---- Forecast ----
    const { level, trend, sigma } = holt(values)
    const confidence = forecastConfidence(values.length, sigma, level)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    for (let h = 1; h <= horizonDays; h++) {
      const point = level + h * trend
      const ci = 1.96 * sigma * Math.sqrt(h)
      const date = new Date(today.getTime() + h * 86400 * 1000)
      const dateStr = date.toISOString().slice(0, 10)
      const predicted = Math.max(0, Math.round(point))
      const lower = Math.max(0, Math.round(point - ci))
      const upper = Math.max(predicted, Math.round(point + ci))

      forecasts.push({
        metricKey,
        metricLabel: label,
        date: dateStr,
        predicted,
        lower,
        upper,
        confidence,
      })

      await query(
        `INSERT INTO intel_metric_forecasts
            (metric_key, forecast_date, predicted_value, lower_bound, upper_bound, method, confidence)
         VALUES ($1, $2, $3, $4, $5, 'holt', $6)
         ON CONFLICT (metric_key, forecast_date) DO UPDATE SET
            predicted_value = EXCLUDED.predicted_value,
            lower_bound     = EXCLUDED.lower_bound,
            upper_bound     = EXCLUDED.upper_bound,
            method          = EXCLUDED.method,
            confidence      = EXCLUDED.confidence,
            generated_at    = NOW()`,
        [metricKey, dateStr, predicted, lower, upper, confidence],
      )
    }

    // ---- Anomaly detection on the most recent point ----
    if (values.length >= 7) {
      const window = values.slice(-14, -1) // exclude today, look back up to 13 days
      if (window.length >= 4) {
        const mean = window.reduce((a, b) => a + b, 0) / window.length
        const variance =
          window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, window.length - 1)
        const sd = Math.sqrt(Math.max(0, variance))
        const last = values[values.length - 1]
        const lastRow = rows[rows.length - 1]
        const zScore = sd > 0 ? (last - mean) / sd : 0

        if (Math.abs(zScore) >= 2 && Math.abs(last - mean) >= 2) {
          const direction: AnomalyPoint["direction"] = zScore > 0 ? "spike" : "drop"
          const severity =
            Math.abs(zScore) >= 3.5
              ? "critical"
              : Math.abs(zScore) >= 2.5
                ? "high"
                : "medium"
          const explanation =
            direction === "spike"
              ? `Value ${last.toLocaleString()} is ${zScore.toFixed(1)}σ above the 14-day mean of ${mean.toFixed(1)}.`
              : `Value ${last.toLocaleString()} is ${Math.abs(zScore).toFixed(1)}σ below the 14-day mean of ${mean.toFixed(1)}.`

          const dateStr = lastRow.bucket_date.toISOString().slice(0, 10)

          anomalies.push({
            metricKey,
            metricLabel: label,
            bucketDate: dateStr,
            value: last,
            expectedValue: Number(mean.toFixed(2)),
            zScore: Number(zScore.toFixed(3)),
            severity,
            direction,
            explanation,
          })

          await query(
            `INSERT INTO intel_anomalies
                (metric_key, metric_label, bucket_date, value, expected_value, z_score, severity, direction, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (metric_key, bucket_date) DO UPDATE SET
                value          = EXCLUDED.value,
                expected_value = EXCLUDED.expected_value,
                z_score        = EXCLUDED.z_score,
                severity       = EXCLUDED.severity,
                direction      = EXCLUDED.direction,
                explanation    = EXCLUDED.explanation,
                detected_at    = NOW()`,
            [
              metricKey,
              label,
              dateStr,
              last,
              Number(mean.toFixed(2)),
              Number(zScore.toFixed(3)),
              severity,
              direction,
              explanation,
            ],
          )
        }
      }
    }
  }

  if (anomalies.length > 0) {
    await emitAutomationEvent("anomaly.detected", { count: anomalies.length })
  }

  return { generated: forecasts, anomalies }
}

/**
 * Read forecasts grouped by metric_key for the dashboard.
 */
export async function getForecasts(): Promise<Map<string, ForecastPoint[]>> {
  const r = await query(
    `SELECT mf.metric_key, tm.metric_label, mf.forecast_date, mf.predicted_value,
            mf.lower_bound, mf.upper_bound, mf.confidence
     FROM intel_metric_forecasts mf
     LEFT JOIN LATERAL (
       SELECT metric_label FROM intel_trend_metrics
       WHERE metric_key = mf.metric_key
       ORDER BY bucket_date DESC LIMIT 1
     ) tm ON TRUE
     WHERE mf.forecast_date >= CURRENT_DATE
     ORDER BY mf.metric_key, mf.forecast_date ASC`,
    [],
  )
  const out = new Map<string, ForecastPoint[]>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const key = String(row.metric_key)
    const list = out.get(key) ?? []
    list.push({
      metricKey: key,
      metricLabel: (row.metric_label as string) || undefined,
      date: (row.forecast_date as Date).toISOString().slice(0, 10),
      predicted: Number(row.predicted_value),
      lower: Number(row.lower_bound),
      upper: Number(row.upper_bound),
      confidence: Number(row.confidence),
    })
    out.set(key, list)
  }
  return out
}

export async function listAnomalies(limit = 20): Promise<AnomalyPoint[]> {
  const r = await query(
    `SELECT metric_key, metric_label, bucket_date, value, expected_value,
            z_score, severity, direction, explanation
     FROM intel_anomalies
     ORDER BY detected_at DESC
     LIMIT $1`,
    [limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    metricKey: String(row.metric_key),
    metricLabel: (row.metric_label as string) || undefined,
    bucketDate: (row.bucket_date as Date).toISOString().slice(0, 10),
    value: Number(row.value),
    expectedValue: Number(row.expected_value),
    zScore: Number(row.z_score),
    severity: row.severity as AnomalyPoint["severity"],
    direction: row.direction as AnomalyPoint["direction"],
    explanation: String(row.explanation || ""),
  }))
}
