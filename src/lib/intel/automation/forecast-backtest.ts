// ================================================
// IntelForge Automation - Forecast Backtest
// ------------------------------------------------
// For each tracked metric we hold out the most
// recent 7 daily points, fit Holt and Holt-Winters
// on the prior history, and score MAPE / RMSE / MAE.
// Results live in intel_forecast_accuracy.
// ================================================
import { query } from "@/lib/db"

export type ForecastMethod = "naive" | "holt" | "holt_winters"

interface SeriesRow {
  metric_key: string
  metric_label: string | null
  bucket_date: Date
  value: number
}

export interface BacktestResult {
  metricKey: string
  method: ForecastMethod
  horizonDays: number
  mape: number
  rmse: number
  mae: number
  sampleSize: number
}


// ---- Forecast methods ----------------------------------------------

/** Last-value naive baseline. */
function forecastNaive(history: number[], horizon: number): number[] {
  const last = history[history.length - 1] ?? 0
  return Array.from({ length: horizon }, () => last)
}

/** Holt's linear trend smoothing (level + trend). */
function forecastHolt(
  history: number[],
  horizon: number,
  alpha = 0.5,
  beta = 0.2,
): number[] {
  if (history.length < 2) return forecastNaive(history, horizon)
  let level = history[0]
  let trend = history[1] - history[0]
  for (let i = 1; i < history.length; i++) {
    const prevLevel = level
    const prevTrend = trend
    level = alpha * history[i] + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
  }
  return Array.from({ length: horizon }, (_, h) => Math.max(0, level + (h + 1) * trend))
}

/** Additive Holt-Winters with weekly seasonality (period 7). */
function forecastHoltWinters(
  history: number[],
  horizon: number,
  alpha = 0.4,
  beta = 0.1,
  gamma = 0.3,
  period = 7,
): number[] {
  if (history.length < period * 2) return forecastHolt(history, horizon)

  // Initial level = mean of first season; initial trend = mean increment
  // between first two seasons; initial seasonal = obs - level (per index).
  const seasons = Math.floor(history.length / period)
  let level =
    history.slice(0, period).reduce((a, b) => a + b, 0) / period
  let trend =
    (history.slice(period, 2 * period).reduce((a, b) => a + b, 0) -
      history.slice(0, period).reduce((a, b) => a + b, 0)) /
    (period * period)
  const seasonal: number[] = new Array(period).fill(0)
  for (let i = 0; i < period; i++) {
    let acc = 0
    let cnt = 0
    for (let s = 0; s < seasons; s++) {
      const idx = s * period + i
      if (idx < history.length) {
        acc += history[idx] - level
        cnt++
      }
    }
    seasonal[i] = cnt > 0 ? acc / cnt : 0
  }

  for (let t = 0; t < history.length; t++) {
    const obs = history[t]
    const sIdx = t % period
    const prevLevel = level
    const prevTrend = trend
    const prevSeason = seasonal[sIdx]
    level = alpha * (obs - prevSeason) + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
    seasonal[sIdx] = gamma * (obs - level) + (1 - gamma) * prevSeason
  }

  const out: number[] = []
  for (let h = 1; h <= horizon; h++) {
    const sIdx = (history.length + h - 1) % period
    out.push(Math.max(0, level + h * trend + seasonal[sIdx]))
  }
  return out
}


const METHODS: Record<ForecastMethod, (h: number[], n: number) => number[]> = {
  naive: forecastNaive,
  holt: forecastHolt,
  holt_winters: forecastHoltWinters,
}

// ---- Error metrics -------------------------------------------------

function mape(actual: number[], predicted: number[]): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === 0) continue // undefined for zero baseline
    sum += Math.abs((actual[i] - predicted[i]) / actual[i])
    n++
  }
  if (n === 0) return 0
  return (sum / n) * 100
}

function rmse(actual: number[], predicted: number[]): number {
  const n = actual.length
  if (n === 0) return 0
  let s = 0
  for (let i = 0; i < n; i++) s += (actual[i] - predicted[i]) ** 2
  return Math.sqrt(s / n)
}

function mae(actual: number[], predicted: number[]): number {
  const n = actual.length
  if (n === 0) return 0
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(actual[i] - predicted[i])
  return s / n
}

async function loadFullHistory(): Promise<Map<string, SeriesRow[]>> {
  const r = await query(
    `SELECT metric_key, metric_label, bucket_date, value
     FROM intel_trend_metrics
     ORDER BY metric_key, bucket_date ASC`,
    [],
  )
  const out = new Map<string, SeriesRow[]>()
  for (const row of (r.data || []) as SeriesRow[]) {
    const list = out.get(row.metric_key) ?? []
    list.push(row)
    out.set(row.metric_key, list)
  }
  return out
}


/**
 * Run a holdout backtest for every metric:
 *   - take the last `horizon` points as ground truth
 *   - fit each method on the prior history
 *   - score MAPE/RMSE/MAE
 * Persist into intel_forecast_accuracy.
 */
export async function runForecastBacktest(
  horizon = 7,
): Promise<BacktestResult[]> {
  const all = await loadFullHistory()
  const results: BacktestResult[] = []

  for (const [metricKey, rows] of all) {
    if (rows.length < horizon + 7) continue // need enough training data
    const values = rows.map((r) => Number(r.value))
    const train = values.slice(0, values.length - horizon)
    const test = values.slice(values.length - horizon)

    for (const [method, fn] of Object.entries(METHODS) as Array<
      [ForecastMethod, (h: number[], n: number) => number[]]
    >) {
      const predicted = fn(train, horizon)
      const result: BacktestResult = {
        metricKey,
        method,
        horizonDays: horizon,
        mape: Number(mape(test, predicted).toFixed(3)),
        rmse: Number(rmse(test, predicted).toFixed(3)),
        mae: Number(mae(test, predicted).toFixed(3)),
        sampleSize: test.length,
      }
      results.push(result)

      await query(
        `INSERT INTO intel_forecast_accuracy
            (metric_key, method, horizon_days, mape, rmse, mae, sample_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [metricKey, method, horizon, result.mape, result.rmse, result.mae, result.sampleSize],
      )
    }
  }

  return results
}

/**
 * Pick the best method per metric based on the most recent backtest run.
 * Lowest MAPE wins; ties broken by lowest RMSE.
 */
export async function getBestMethodPerMetric(): Promise<
  Map<string, { method: ForecastMethod; mape: number; rmse: number; mae: number }>
> {
  const r = await query(
    `WITH ranked AS (
       SELECT metric_key, method, mape, rmse, mae,
              ROW_NUMBER() OVER (PARTITION BY metric_key
                                 ORDER BY mape ASC, rmse ASC) AS rk
       FROM intel_forecast_accuracy
       WHERE evaluated_at >= NOW() - INTERVAL '7 days'
     )
     SELECT metric_key, method, mape, rmse, mae
     FROM ranked WHERE rk = 1`,
    [],
  )
  const out = new Map<
    string,
    { method: ForecastMethod; mape: number; rmse: number; mae: number }
  >()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    out.set(String(row.metric_key), {
      method: row.method as ForecastMethod,
      mape: Number(row.mape),
      rmse: Number(row.rmse),
      mae: Number(row.mae),
    })
  }
  return out
}

export async function getLatestAccuracy(limit = 30): Promise<BacktestResult[]> {
  const r = await query(
    `SELECT metric_key, method, horizon_days, mape, rmse, mae, sample_size
     FROM intel_forecast_accuracy
     ORDER BY evaluated_at DESC LIMIT $1`,
    [limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    metricKey: String(row.metric_key),
    method: row.method as ForecastMethod,
    horizonDays: Number(row.horizon_days),
    mape: Number(row.mape),
    rmse: Number(row.rmse),
    mae: Number(row.mae),
    sampleSize: Number(row.sample_size),
  }))
}

// Re-export for the orchestrator convenience
export { forecastHolt, forecastHoltWinters, forecastNaive, mape, rmse, mae }
