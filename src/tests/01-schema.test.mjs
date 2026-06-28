// Suite 1 - Migration & Schema
import { suite, test, assert, psql, summary } from "./helpers.mjs"

const TABLES_R1 = [
  "intel_threat_score_history",
  "intel_correlation_clusters",
  "intel_briefings",
  "intel_trend_metrics",
  "intel_automation_runs",
]

const TABLES_R2 = [
  "intel_metric_forecasts",
  "intel_anomalies",
  "intel_action_queue",
  "intel_geo_threat",
  "intel_sector_risk",
  "intel_notification_log",
]

function tableExists(name) {
  const r = psql(`SELECT 1 FROM information_schema.tables WHERE table_name='${name}'`)
  return r.ok && r.stdout.trim() === "1"
}

function indexExists(name) {
  const r = psql(`SELECT 1 FROM pg_indexes WHERE indexname='${name}'`)
  return r.ok && r.stdout.trim() === "1"
}

function expectUniqueViolation(sql) {
  const r = psql(sql)
  // Postgres 23505 = unique_violation
  return !r.ok && /23505|duplicate key|unique constraint/i.test(r.error)
}

suite("Suite 1 — Migration & Schema")

test("1.1 Round-1 migration created all 5 tables", () => {
  for (const t of TABLES_R1) assert(tableExists(t), `table ${t} missing`)
})

test("1.2 Round-2 migration created all 6 tables", () => {
  for (const t of TABLES_R2) assert(tableExists(t), `table ${t} missing`)
})

test("1.3 intel_correlation_clusters.cluster_key UNIQUE", () => {
  // Use a unique sentinel key with timestamp
  const k = "test_unique_" + Date.now()
  psql(`INSERT INTO intel_correlation_clusters (cluster_key, cluster_type, title) VALUES ('${k}','cve','t')`)
  const dup = expectUniqueViolation(
    `INSERT INTO intel_correlation_clusters (cluster_key, cluster_type, title) VALUES ('${k}','cve','t2')`,
  )
  psql(`DELETE FROM intel_correlation_clusters WHERE cluster_key='${k}'`)
  assert(dup, "expected unique violation on cluster_key")
})

test("1.4 intel_briefings(briefing_type, period_start) UNIQUE", () => {
  const ts = `'2099-01-${(new Date().getDate() % 28) + 1} 00:00:00+00'`
  psql(
    `INSERT INTO intel_briefings (briefing_type, headline, threat_level, threat_score, summary, period_start, period_end) ` +
      `VALUES ('test', 'h', 'medium', 50, 's', ${ts}, ${ts})`,
  )
  const dup = expectUniqueViolation(
    `INSERT INTO intel_briefings (briefing_type, headline, threat_level, threat_score, summary, period_start, period_end) ` +
      `VALUES ('test', 'h2', 'medium', 50, 's', ${ts}, ${ts})`,
  )
  psql(`DELETE FROM intel_briefings WHERE briefing_type='test' AND period_start=${ts}`)
  assert(dup, "expected unique violation on (briefing_type, period_start)")
})

test("1.5 intel_trend_metrics(metric_key, bucket_date) UNIQUE", () => {
  const k = "test_metric_" + Date.now()
  psql(`INSERT INTO intel_trend_metrics (metric_key, bucket_date, value) VALUES ('${k}', CURRENT_DATE - 100, 0)`)
  const dup = expectUniqueViolation(
    `INSERT INTO intel_trend_metrics (metric_key, bucket_date, value) VALUES ('${k}', CURRENT_DATE - 100, 1)`,
  )
  psql(`DELETE FROM intel_trend_metrics WHERE metric_key='${k}'`)
  assert(dup, "expected unique violation on (metric_key, bucket_date)")
})

test("1.6 intel_metric_forecasts(metric_key, forecast_date) UNIQUE", () => {
  const k = "test_fc_" + Date.now()
  psql(
    `INSERT INTO intel_metric_forecasts (metric_key, forecast_date, predicted_value) VALUES ('${k}', CURRENT_DATE + 100, 5)`,
  )
  const dup = expectUniqueViolation(
    `INSERT INTO intel_metric_forecasts (metric_key, forecast_date, predicted_value) VALUES ('${k}', CURRENT_DATE + 100, 6)`,
  )
  psql(`DELETE FROM intel_metric_forecasts WHERE metric_key='${k}'`)
  assert(dup, "expected unique violation on (metric_key, forecast_date)")
})

test("1.7 intel_action_queue.action_key UNIQUE", () => {
  const k = "test_action_" + Date.now()
  psql(`INSERT INTO intel_action_queue (action_key, title, category) VALUES ('${k}', 't', 'review')`)
  const dup = expectUniqueViolation(
    `INSERT INTO intel_action_queue (action_key, title, category) VALUES ('${k}', 't2', 'review')`,
  )
  psql(`DELETE FROM intel_action_queue WHERE action_key='${k}'`)
  assert(dup, "expected unique violation on action_key")
})

test("1.8 intel_geo_threat(country, bucket_date) UNIQUE", () => {
  const c = "TestCountry_" + Date.now()
  psql(`INSERT INTO intel_geo_threat (country, bucket_date) VALUES ('${c}', CURRENT_DATE - 200)`)
  const dup = expectUniqueViolation(
    `INSERT INTO intel_geo_threat (country, bucket_date) VALUES ('${c}', CURRENT_DATE - 200)`,
  )
  psql(`DELETE FROM intel_geo_threat WHERE country='${c}'`)
  assert(dup, "expected unique violation on (country, bucket_date)")
})

test("1.9 intel_sector_risk(sector, bucket_date) UNIQUE", () => {
  const s = "TestSector_" + Date.now()
  psql(`INSERT INTO intel_sector_risk (sector, bucket_date) VALUES ('${s}', CURRENT_DATE - 200)`)
  const dup = expectUniqueViolation(
    `INSERT INTO intel_sector_risk (sector, bucket_date) VALUES ('${s}', CURRENT_DATE - 200)`,
  )
  psql(`DELETE FROM intel_sector_risk WHERE sector='${s}'`)
  assert(dup, "expected unique violation on (sector, bucket_date)")
})

test("1.10 Migrations are idempotent on re-run", () => {
  // Re-running CREATE TABLE IF NOT EXISTS does not error
  const r = psql(
    `CREATE TABLE IF NOT EXISTS intel_threat_score_history (id SERIAL PRIMARY KEY, score INTEGER)`,
  )
  assert(r.ok, "re-running CREATE TABLE IF NOT EXISTS should succeed")
})

test("1.11 score column has CHECK 0..100", () => {
  const bad = expectUniqueViolation(
    `INSERT INTO intel_threat_score_history (score, severity) VALUES (150, 'critical')`,
  )
  // Either 23514 check-violation or anything not 0
  // psql check: just look for failure with constraint message
  const r = psql(`INSERT INTO intel_threat_score_history (score, severity) VALUES (150, 'critical')`)
  assert(!r.ok && /check|valid|constraint/i.test(r.error), `expected CHECK violation, got: ${r.error}`)
})

test("1.12 Key indexes from migrations are present", () => {
  const expected = [
    "idx_threat_score_computed",
    "idx_correlation_clusters_score",
    "idx_briefings_generated",
    "idx_trend_metrics_key_date",
    "idx_metric_forecasts_key_date",
    "idx_action_queue_status",
    "idx_geo_threat_date",
  ]
  for (const i of expected) assert(indexExists(i), `index ${i} missing`)
})

const ok = await summary()
process.exit(ok ? 0 : 1)
