# IntelForge Automation — Test Plan

Total: **84 test cases** across 12 suites. All test cases include the
exact expected behaviour and a code reference. The runnable scripts in
`tests/` exercise every case end-to-end against the live dev server.

How to run:

```bash
# 1. Postgres up + migrations applied (see DEFENCE doc §12.1)
# 2. Dev server running on http://localhost:3000  (npm run dev)
# 3. Then:
npm run defence:test
```

The runner colour-codes pass / fail and prints a final summary. Exit code
is 0 only when every case passes.

---

## Suite 1 — Migration & Schema (12 cases)

Source: `tests/01-schema.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 1.1 | Round-1 migration creates all 5 tables | `intel_threat_score_history`, `intel_correlation_clusters`, `intel_briefings`, `intel_trend_metrics`, `intel_automation_runs` exist | `scripts/intel-automation-migration.sql:13-122` |
| 1.2 | Round-2 migration creates all 6 tables | `intel_metric_forecasts`, `intel_anomalies`, `intel_action_queue`, `intel_geo_threat`, `intel_sector_risk`, `intel_notification_log` exist | `scripts/intel-automation-v2-migration.sql:14-135` |
| 1.3 | `intel_correlation_clusters.cluster_key` is UNIQUE | duplicate insert raises 23505 | `intel-automation-migration.sql:37` |
| 1.4 | `intel_briefings(briefing_type, period_start)` UNIQUE | duplicate raises 23505 | `intel-automation-migration.sql:84` |
| 1.5 | `intel_trend_metrics(metric_key, bucket_date)` UNIQUE | duplicate raises 23505 | `intel-automation-migration.sql:104` |
| 1.6 | `intel_metric_forecasts(metric_key, forecast_date)` UNIQUE | duplicate raises 23505 | `intel-automation-v2-migration.sql:25` |
| 1.7 | `intel_action_queue.action_key` UNIQUE | duplicate raises 23505 | `intel-automation-v2-migration.sql:55` |
| 1.8 | `intel_geo_threat(country, bucket_date)` UNIQUE | duplicate raises 23505 | `intel-automation-v2-migration.sql:97` |
| 1.9 | `intel_sector_risk(sector, bucket_date)` UNIQUE | duplicate raises 23505 | `intel-automation-v2-migration.sql:117` |
| 1.10 | Migration is idempotent (re-run doesn't error) | second psql exec succeeds | both migration files use `IF NOT EXISTS` |
| 1.11 | `score` column has CHECK 0–100 | INSERT score=150 fails | `intel-automation-migration.sql:16` |
| 1.12 | All indexes from migrations exist | `pg_indexes` shows them | both migration files |

---

## Suite 2 — Threat Score (8 cases)

Source: `tests/02-threat-score.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 2.1 | Empty database → score = 30 (baseline) | `score: 30, severity: low` | `lib/intel/automation/threat-score.ts:130-132` |
| 2.2 | 5 critical CVEs in 24h adds ≥ 20 points | new score ≥ baseline + 20 | `threat-score.ts:135-138` |
| 2.3 | KEV count of 1500 contributes ≤ 10 points | log10 cap honoured | `threat-score.ts:148-152` |
| 2.4 | Severity tier mapping: 92 → critical | `severityFromRiskScore(92) === 'critical'` | `lib/intel/risk-scoring.ts:39-45` |
| 2.5 | Severity tier mapping: 75 → high | tier == 'high' | `risk-scoring.ts:39-45` |
| 2.6 | Persisting score creates a history row | row inserted with all fields | `threat-score.ts:217-222` |
| 2.7 | `delta24h` reflects difference from prior >20h row | delta = current - previous | `threat-score.ts:178-188` |
| 2.8 | Score is clamped to [0, 100] | `clampScore` never returns out-of-range | `threat-score.ts:128, 174` |

---

## Suite 3 — Correlator (6 cases)

Source: `tests/03-correlator.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 3.1 | CVE with KEV + exploit + news → score ≥ 80 | scoreCluster returns ≥ 80 | `lib/intel/automation/correlator.ts:143-156` |
| 3.2 | CVE with no signals is skipped | not present in `intel_correlation_clusters` | `correlator.ts:194-195` |
| 3.3 | Cluster upsert is idempotent | second `runCorrelationPass()` doesn't add a row | `correlator.ts:236-258` |
| 3.4 | Cluster tags include 'kev' if `is_kev=true` | `tags @> '{kev}'` | `correlator.ts:228` |
| 3.5 | Cluster tags include 'high-priority' if score ≥ 80 | tag present | `correlator.ts:230` |
| 3.6 | Top-10 clusters returned ordered by score desc | output is monotonically non-increasing in `risk_score` | `correlator.ts:280-289` |

---

## Suite 4 — Forecast & Anomaly (7 cases)

Source: `tests/04-forecast.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 4.1 | Holt's smoothing on linear input recovers slope | trend ≈ true slope (within 1%) | `forecast.ts:69-101` |
| 4.2 | Holt's smoothing on flat input has trend ≈ 0 | abs(trend) < 0.5 | `forecast.ts:69-101` |
| 4.3 | Forecast horizon = 7 days produces 7 rows per metric | rows from `intel_metric_forecasts` for today's run | `forecast.ts:130-147` |
| 4.4 | Confidence is bounded [20, 95] | clamped output | `forecast.ts:104-109` |
| 4.5 | Z-score detector flags 3σ spike | severity = high or critical | `forecast.ts:183-208` |
| 4.6 | Z-score detector ignores noise on small series | < 7 points → no anomaly | `forecast.ts:171-172` |
| 4.7 | Anomaly persistence is idempotent on `(metric, bucket)` | re-run does not duplicate | `forecast.ts:209-227` |

---

## Suite 5 — Action Queue (6 cases)

Source: `tests/05-actions.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 5.1 | High-score cluster with KEV → "patch" category | category = 'patch' | `lib/intel/automation/action-queue.ts:91-103` |
| 5.2 | Anomaly with severity=high → "hunt" category for spike | category = 'hunt' | `action-queue.ts:140-143` |
| 5.3 | Action upsert is idempotent on `action_key` | duplicate generation does not insert a new row | `action-queue.ts:43-66` |
| 5.4 | Listing with status=open returns only open rows | every row has status=open | `action-queue.ts:200-203` |
| 5.5 | `updateActionStatus(id,'done')` sets `done_at` | `done_at IS NOT NULL` | `action-queue.ts:229-244` |
| 5.6 | Reopening a done action clears `done_at` | NULL again | `action-queue.ts:233-238` |

---

## Suite 6 — API endpoints (9 cases)

Source: `tests/06-api.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 6.1 | `GET /api/intel/automation/status` 200 + payload keys | `success, threatScore, history, clusters, trends, briefing` | `app/api/intel/automation/status/route.ts:18-34` |
| 6.2 | `GET /api/intel/automation/forecasts` 200 | `success, forecasts, anomalies` | `app/api/intel/automation/forecasts/route.ts` |
| 6.3 | `GET /api/intel/automation/geo` 200 | `success, geo, sectors` | `app/api/intel/automation/geo/route.ts` |
| 6.4 | `GET /api/intel/automation/actions?status=open` 200 | `items[]` of action shape | `app/api/intel/automation/actions/route.ts:13-22` |
| 6.5 | `POST /api/cron/automation` without secret → 401 | unauthorised in production-ish mode | `app/api/cron/automation/route.ts:17-24` |
| 6.6 | `POST /api/cron/automation` with secret → 200 + 8 stages | result has all eight stage keys | `app/api/cron/automation/route.ts:30-37` |
| 6.7 | `PATCH /api/intel/automation/actions` without auth → 401 | unauthorised | `app/api/intel/automation/actions/route.ts:24-30` |
| 6.8 | Repeating cron call writes new `automation_runs` row | row count increments | `lib/intel/automation/orchestrator.ts:21-30` |
| 6.9 | `GET /api/admin/automation/run` without admin → 401/403 | rejected | `app/api/admin/automation/run/route.ts:30-32` |

---

## Suite 7 — PDF & SSE (4 cases)

Source: `tests/07-pdf-sse.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 7.1 | `GET .../briefings/export` returns Content-Type `application/pdf` | content-type matches | `app/api/intel/automation/briefings/export/route.ts:23` |
| 7.2 | PDF starts with `%PDF` magic header | first 4 bytes = "%PDF" | `lib/intel/automation/briefing-pdf.ts:31-34` |
| 7.3 | PDF size > 1500 bytes (real content rendered) | length check | `briefing-pdf.ts:18-180` |
| 7.4 | SSE stream emits at least one `score` event in 12s | `EventSource` receives `event: score` | `app/api/intel/automation/stream/route.ts:18-46` |

---

## How findings map to defence

Every test failure points at a specific code location, so the
committee can ask "show me why this passes" and we can jump to the
file:line cited above.


---

## Suite 12 — Deep correlator v2 (10 cases)

Source: `tests/12-deep-correlator.test.mjs`

| # | Test | Expected | Code reference |
|---|------|----------|----------------|
| 12.1 | Six new artifact tables exist | paste, stealer, combolist, hosts, actor_cve, actor_breach | `scripts/intel-automation-v4-migration.sql:18-140` |
| 12.2 | Demo seed populated all anchor data | ≥5 each: actor_cve, actor_breach, paste, stealer | `scripts/seed-correlation-demo.sql` |
| 12.3 | Pipeline produces multiple cluster types | cluster_type contains `cve` AND (`ransomware` OR `actor`) | `lib/intel/automation/correlator-v2.ts:911-940` |
| 12.4 | Top-10 clusters carry rich signals (avg ≥4) | mean signal_count over top 10 | `correlator-v2.ts:399-595` |
| 12.5 | At least 5 distinct signal types present | distinct(signal type) ≥ 5 | `correlator-v2.ts:25-35` |
| 12.6 | Every signal has confidence in [0,100] | no out-of-range rows | `correlator-v2.ts:332-353` |
| 12.7 | Cluster confidence is bounded [20,99] | clamp invariant | `correlator-v2.ts:347-349` |
| 12.8 | GET /clusters returns deep-cluster shape | `confidence`, `relatedCves` present | `app/api/intel/automation/clusters/route.ts:11-21` |
| 12.9 | GET /clusters?type=ransomware filters correctly | every item is `cluster_type=ransomware` | `app/api/intel/automation/clusters/route.ts:14-19` |
| 12.10 | Top CVE clusters reference at least one actor | actors[] non-empty for top 5 | `correlator-v2.ts:418-427` |
