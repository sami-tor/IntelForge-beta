# IntelForge — FYP Defence Document

**Project:** IntelForge — Threat Intelligence SaaS Hub
**Subsystem:** Automation Layer (Threat Command Center)
**Document type:** Final-year project defence reference
**Build verified on:** Windows · Next.js 16.2.4 · PostgreSQL 16 · Docker

> Every claim in this document is cross-referenced to a file path and line
> range in the codebase. Use the citation `(file:lineStart-lineEnd)` to
> jump directly to the implementation.

---

## Table of Contents

1. [Problem Statement & Motivation](#1-problem-statement--motivation)
2. [Objectives & Scope](#2-objectives--scope)
3. [System Architecture](#3-system-architecture)
4. [Automation Pipeline — Detailed Walk-through](#4-automation-pipeline--detailed-walk-through)
5. [Algorithms & Mathematical Foundations](#5-algorithms--mathematical-foundations)
6. [Database Schema](#6-database-schema)
7. [API Surface](#7-api-surface)
8. [User Interface](#8-user-interface)
9. [Security Model](#9-security-model)
10. [Performance & Scalability](#10-performance--scalability)
11. [Test Plan & Verification](#11-test-plan--verification)
12. [Deployment Workflow](#12-deployment-workflow)
13. [Future Work](#13-future-work)
14. [Appendix A — File Inventory](#appendix-a--file-inventory)
15. [Appendix B — Defence Q&A](#appendix-b--defence-qa)

---

## 1. Problem Statement & Motivation

Threat-intelligence consumers face four chronic problems:

1. **Fragmentation.** Critical signals about a single CVE arrive across ten
   feeds (NVD, KEV, ExploitDB, ransomware leak sites, dark-web forums) and
   nobody correlates them in real time.
2. **Reactivity.** Most platforms display feeds; few _produce_ a global
   posture score, _predict_ where the next spike will come from, or
   _generate_ analyst tasks automatically.
3. **Operational overhead.** Daily executive briefings are written by hand.
4. **Outage fragility.** When upstream APIs fail, downstream dashboards
   go dark.

IntelForge's automation layer solves all four with a closed-loop pipeline
that runs every cron cycle, reads only from the local cache, and publishes
the results through SSR pages, REST endpoints, SSE streams and PDF reports.

---

## 2. Objectives & Scope

| # | Objective | Status | Evidence |
|---|-----------|--------|----------|
| O1 | Composite global threat score | ✅ | `lib/intel/automation/threat-score.ts:128-176` |
| O2 | Cross-source correlation clusters | ✅ | `lib/intel/automation/correlator.ts:179-271` |
| O3 | KPI trend tracking with emerging-flag | ✅ | `lib/intel/automation/trends.ts:106-152` |
| O4 | 7-day forecasting (Holt's smoothing) | ✅ | `lib/intel/automation/forecast.ts:69-101` |
| O5 | Z-score anomaly detection | ✅ | `lib/intel/automation/forecast.ts:171-227` |
| O6 | Auto-generated action queue | ✅ | `lib/intel/automation/action-queue.ts:78-193` |
| O7 | Geographic + sector risk index | ✅ | `lib/intel/automation/geo-sector.ts:77-244` |
| O8 | Daily executive briefing | ✅ | `lib/intel/automation/briefing-generator.ts:210-285` |
| O9 | PDF export of briefings | ✅ | `lib/intel/automation/briefing-pdf.ts:18-180` |
| O10 | Webhook notifications | ✅ | `lib/intel/automation/notifications.ts:42-118` |
| O11 | Real-time SSE stream | ✅ | `app/api/intel/automation/stream/route.ts:13-65` |
| O12 | Server-rendered command-centre UI | ✅ | `app/intelligence/command-center/page.tsx:68-580` |
| O13 | Forecast backtesting (MAPE/RMSE/MAE) | ✅ | `lib/intel/automation/forecast-backtest.ts:158-200` |
| O14 | Holt-Winters seasonality (period 7) | ✅ | `lib/intel/automation/forecast-backtest.ts:120-156` |
| O15 | Postgres LISTEN/NOTIFY pub-sub bridge | ✅ | `lib/intel/automation/events.ts:31-58, 70-118` |
| O16 | NLP-aware correlation (alias map + pg_trgm) | ✅ | `lib/intel/automation/correlator-nlp.ts:21-35, 63-104` |
| O17 | Anomaly causality attribution | ✅ | `lib/intel/automation/anomaly-attribution.ts:62-92` |
| O18 | Cron rate-limiting (10/min/IP) | ✅ | `lib/intel/automation/cron-rate-limit.ts:12-32` |
| O19 | OpenAPI 3.1 spec + Swagger UI | ✅ | `lib/intel/automation/openapi.ts`, `app/api-docs/page.tsx`, `app/api/openapi.json/route.ts` |
| O20 | Action queue: comments, audit, assignment | ✅ | `lib/intel/automation/action-collab.ts` |
| O21 | Action queue: search + bulk update | ✅ | `app/api/intel/automation/actions/route.ts:18-66`, `app/api/intel/automation/actions/bulk/route.ts` |
| O22 | Threat-hunting query builder (DSL → SQL) | ✅ | `app/api/intel/automation/hunt/route.ts`, `app/intelligence/hunt/page.tsx` |
| O23 | Optional LLM briefing rewrite | ✅ | `lib/intel/automation/briefing-llm.ts:15-29, 124-151` |
| O24 | Webhook delivery end-to-end test | ✅ | `tests/08-webhook.test.mjs` |
| O25 | Accessibility (WCAG-friendly SVGs) | ✅ | `components/intelligence/threat-score-gauge.tsx`, `forecast-chart.tsx`, `sparkline.tsx` |
| O26 | CI workflow + PDF artifact | ✅ | `.github/workflows/defence.yml` |
| O27 | Deep multi-anchor correlator (CVE/actor/ransomware) | ✅ | `lib/intel/automation/correlator-v2.ts:399-595, 602-750, 753-907` |
| O28 | Confidence-weighted scoring with time decay | ✅ | `lib/intel/automation/correlator-v2.ts:127-132, 332-353` |
| O29 | New artifact tables: paste, stealer, combolist, hosts | ✅ | `scripts/intel-automation-v4-migration.sql:18-100` |
| O30 | Threat-actor → CVE / breach edges | ✅ | `scripts/intel-automation-v4-migration.sql:107-140` |
| O31 | Realistic synthetic demo seed | ✅ | `scripts/seed-correlation-demo.sql` |

**Out of scope (explicitly):** training new ML models, on-device deep
learning, multi-tenant data isolation for the automation tables (each
deployment is single-tenant for the automation layer).

---

## 3. System Architecture

The automation layer is a thin module that sits *above* the existing
intelligence feed cache. It never calls upstream APIs directly — that is
the job of `app/api/cron/intel-sync/route.ts`. The automation layer only
consumes what is already in Postgres.

### 3.1 Layered View

```
┌───────────────────────────────────────────────────────────────┐
│                    External Threat Feeds                      │
│  (NVD, CISA KEV, ExploitDB, ransomware leak sites, etc.)      │
└─────────────────────────────┬─────────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                Feed-sync layer (pre-existing)                 │
│  app/api/cron/intel-sync/route.ts                             │
│  lib/intel/fetchers/*.ts                                      │
│         ↓ writes to                                           │
│  intel_news_cache · intel_cve_cache · intel_ransomware_*      │
│  intel_exploit_cache · intel_phishing_cache · ...             │
└─────────────────────────────┬─────────────────────────────────┘
                              ▼ (read only)
┌───────────────────────────────────────────────────────────────┐
│             Automation Layer (this project)                   │
│                                                               │
│   threat-score → correlator → trends → forecast               │
│         ↓             ↓          ↓          ↓                 │
│   geo-sector → action-queue → briefing → notifications        │
│                                                               │
│   Orchestrator: lib/intel/automation/orchestrator.ts:60-179   │
└─────────────────────────────┬─────────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                       Output Channels                         │
│  • Server-rendered pages (Next.js App Router)                 │
│  • REST endpoints (/api/intel/automation/*)                   │
│  • SSE stream (/api/intel/automation/stream)                  │
│  • PDF (/api/intel/automation/briefings/export)               │
│  • Webhooks (lib/integrations/webhook-dispatcher.ts)          │
└───────────────────────────────────────────────────────────────┘
```

See `docs/defence/diagrams/01-architecture.md` for the rendered Mermaid
version.

### 3.2 Component Map

| Layer            | Module                                  | File                                                    |
|------------------|-----------------------------------------|---------------------------------------------------------|
| Score            | Composite scoring                       | `lib/intel/automation/threat-score.ts`                  |
| Correlation v1   | Legacy KEV-only clustering              | `lib/intel/automation/correlator.ts`                    |
| Correlation v2   | Deep multi-anchor correlator            | `lib/intel/automation/correlator-v2.ts`                 |
| Correlation NLP  | Alias dict + pg_trgm fuzzy              | `lib/intel/automation/correlator-nlp.ts`                |
| Trends           | Daily KPI capture                       | `lib/intel/automation/trends.ts`                        |
| Forecast         | Holt's smoothing + z-score anomaly      | `lib/intel/automation/forecast.ts`                      |
| Backtest         | MAPE/RMSE/MAE per method                | `lib/intel/automation/forecast-backtest.ts`             |
| Geo / sector     | Per-country & per-industry index        | `lib/intel/automation/geo-sector.ts`                    |
| Actions          | Prioritised analyst queue               | `lib/intel/automation/action-queue.ts`                  |
| Collaboration    | Comments, assignment, audit log         | `lib/intel/automation/action-collab.ts`                 |
| Briefing         | Deterministic narrative + optional LLM  | `lib/intel/automation/briefing-generator.ts`            |
| LLM rewrite      | Optional OpenAI/Anthropic/Gemini        | `lib/intel/automation/briefing-llm.ts`                  |
| PDF              | Briefing render                         | `lib/intel/automation/briefing-pdf.ts`                  |
| Notifications    | Webhook dispatch                        | `lib/intel/automation/notifications.ts`                 |
| Events           | Postgres LISTEN/NOTIFY pub-sub          | `lib/intel/automation/events.ts`                        |
| Attribution      | Anomaly source-row lookup               | `lib/intel/automation/anomaly-attribution.ts`           |
| Rate-limit       | Cron endpoint protection                | `lib/intel/automation/cron-rate-limit.ts`               |
| OpenAPI          | Spec generator + Swagger UI             | `lib/intel/automation/openapi.ts`                       |
| Orchestrator     | 10-stage pipeline runner                | `lib/intel/automation/orchestrator.ts`                  |

---

## 4. Automation Pipeline — Detailed Walk-through

The orchestrator (`lib/intel/automation/orchestrator.ts:60-220`) runs ten
isolated stages. Each stage is wrapped in its own `try/catch` so a failure
in one does not abort the rest. The full result and any errors are recorded
in `intel_automation_runs`.

### Stage 1 — Threat Score (`lib/intel/automation/threat-score.ts:208-227`)

1. Pull ten counters from cached feeds in parallel
   (`collectComponents()` — `threat-score.ts:59-117`):
   - KEV total, critical/high CVEs in last 24h
   - Ransomware victims in 7d / 30d
   - Active phishing URLs
   - Fresh malware samples
   - Public exploits in 24h
   - Dark-web posts in 24h
   - Feed-sync failures in 24h
2. Apply weighted formula (`scoreFromComponents` —
   `threat-score.ts:128-176`).
3. Compare to score from >20h ago to compute `delta24h`
   (`getPreviousScore` — `threat-score.ts:178-188`).
4. Persist snapshot to `intel_threat_score_history`.

### Stage 2 — Correlation (`lib/intel/automation/correlator.ts:179-271`)

1. Fetch up to 80 anchor CVEs (`fetchAnchorCves` — `correlator.ts:67-83`)
   prioritised by KEV → CVSS → recency.
2. For each, parallel-load matching exploits
   (`fetchExploitsForCves` — `correlator.ts:85-102`) and news mentions
   (`fetchNewsForCves` — `correlator.ts:104-130`).
3. Skip CVEs with zero correlation evidence.
4. Score the cluster (`scoreCluster` — `correlator.ts:143-156`):
   base 30 + CVSS-tier (10/20/30) + KEV (20) + exploit (15) +
   ransomware (10) + multi-news (5).
5. Upsert by `cluster_key` so re-runs are idempotent.

### Stage 3 — Trend Capture (`lib/intel/automation/trends.ts:106-152`)

For each of seven tracked metrics (`METRICS` — `trends.ts:21-86`):
- Run the metric's SQL counter.
- Compare to yesterday's bucket value.
- Compute `deltaPct`. If it crosses the metric's
  `emergingThresholdPct`, set `is_emerging = true`.
- Upsert into `intel_trend_metrics` keyed by `(metric_key, bucket_date)`.

### Stage 4 — Forecast & Anomaly (`lib/intel/automation/forecast.ts:120-228`)

For every metric with ≥4 historical points:
1. Run **Holt's linear exponential smoothing** (`holt` —
   `forecast.ts:69-101`) to extract level + trend + residual σ.
2. Project 7 days ahead with predicted ± 1.96σ√h confidence interval
   (`forecast.ts:130-167`).
3. Compute confidence (`forecastConfidence` — `forecast.ts:103-110`).
4. Upsert each forecast point into `intel_metric_forecasts`.

For every metric with ≥7 points:
1. Compute mean & SD over the last 13 days excluding today
   (`forecast.ts:171-179`).
2. Calculate today's z-score; if |z| ≥ 2 and absolute deviation ≥ 2,
   flag as anomaly (`forecast.ts:183-227`).
3. Severity = critical (|z|≥3.5), high (|z|≥2.5), medium otherwise.

### Stage 5 — Geo & Sector (`lib/intel/automation/geo-sector.ts:77-244`)

Three SQL aggregates per dimension (country, sector):
- Ransomware victims (last 30 days)
- Active phishing infrastructure
- Dark-web victim mentions

Weighted total = `ransomware × 4 + phishing × 1.5 + darknet × 2.5`
(`geo-sector.ts:118-122`). Top 50 countries / 25 sectors are persisted with
a rank-derived 0–100 risk score.

### Stage 6 — Action Queue (`lib/intel/automation/action-queue.ts:78-193`)

Reads top correlation clusters and recent anomalies. For each cluster
with `risk_score ≥ 50`, emits a "patch" action when both KEV and exploit
are present, else "review". For each anomaly with severity ≥ medium,
emits a "hunt" (spike) or "review" (drop) action. Deduped via a stable
SHA-256 `action_key` (`action-queue.ts:36-38`).

### Stage 7 — Briefing (`lib/intel/automation/briefing-generator.ts:210-285`)

1. Re-pull threat score and the eight headline metrics.
2. Build the headline (`buildHeadline` — `briefing-generator.ts:107-121`)
   using a tiered string template based on severity and metric thresholds.
3. Build the narrative (`buildNarrative` —
   `briefing-generator.ts:123-153`) — 3-5 sentences synthesised from
   actual numbers, never an LLM call.
4. Build highlights (top score drivers + top clusters + emerging trends)
   and recommendations.
5. Persist to `intel_briefings` with `UNIQUE (briefing_type, period_start)`
   so the same day's briefing is overwritten on re-run.

### Stage 8 — Notifications (`lib/intel/automation/notifications.ts:42-118`)

Best-effort, never blocks the pipeline. Fires the existing `alert.created`
webhook channel for:
- Briefings rated `critical` or `high`.
- Anomalies with severity `critical` or `high`.
- Clusters with severity ≥ high _and_ score ≥ 80.

Every dispatch (success or failure) is logged to
`intel_notification_log`.

---

## 5. Algorithms & Mathematical Foundations

### 5.1 Composite Threat Score

Defined in `lib/intel/automation/threat-score.ts:128-176`:

```
score = clamp(0, 100,
  30                                            // baseline floor
  + min(25, criticalCves24h × 4)                // critical disclosures
  + min(10, highCves24h × 1.2)
  + min(10, log10(kev + 1) × 4)                 // visibility-of-exploited
  + min(15, ransomwareVictims7d × 0.5)
  + min(10, exploits24h × 1.5)
  + min(8,  log10(activePhishing + 1) × 3)
  + min(6,  malware24h × 0.05)
  + min(5,  darknetPosts24h × 0.2)
  + min(5,  feedFailures × 0.4)                 // visibility blind-spot
)
```

**Why these weights?** Critical CVEs and exploits are the single biggest
movers because they drive incident response. Logarithmic terms (KEV,
phishing) prevent slow-changing catalogues from dominating the score.
Feed failures are added because lost telemetry is itself a security
risk — analysts shouldn't see a green dashboard when the feeds are dark.

Severity tiers (`risk-scoring.ts:39-45`):
| Score | Tier |
|-------|------|
| ≥ 90 | critical |
| ≥ 70 | high |
| ≥ 45 | medium |
| ≥ 20 | low |
| < 20 | info |

### 5.2 Holt's Linear Exponential Smoothing

Implemented in `lib/intel/automation/forecast.ts:69-101`. Given a
series `y₁, y₂, …, yₙ`:

```
level₁ = y₁
trend₁ = y₂ - y₁

for t = 2..n:
  level_t = α · y_t + (1 - α) · (level_{t-1} + trend_{t-1})
  trend_t = β · (level_t - level_{t-1}) + (1 - β) · trend_{t-1}

forecast_{n+h} = level_n + h · trend_n

residual_t = y_t - (level_{t-1} + trend_{t-1})
σ = sqrt(var(residual))

prediction interval = forecast ± 1.96 · σ · √h
```

We use α = 0.5 and β = 0.2 (`forecast.ts:71`). These are conservative
defaults that keep the forecast smooth without lagging too much behind
recent shifts.

### 5.3 Z-Score Anomaly Detection

Implemented in `lib/intel/automation/forecast.ts:171-227`. Over a 13-day
window excluding today:

```
μ  = mean(window)
σ  = sd(window, n-1 denominator)
z  = (today - μ) / σ
```

Threshold: `|z| ≥ 2` AND `|today - μ| ≥ 2` to suppress noise on small-
value series. Severity scales with magnitude.

### 5.4 Correlation Cluster Score

`lib/intel/automation/correlator.ts:143-156`:

```
clusterScore =
  30                                  // base
+ 30 if cvss ≥ 9
+ 20 if 7 ≤ cvss < 9
+ 10 if 4 ≤ cvss < 7
+ 20 if isKev
+ 15 if any exploit signal
+ 10 if any ransomware signal
+ 5  if news-mentions ≥ 2
clamp to [0, 100]
```

### 5.5 Geographic Risk Aggregation

`lib/intel/automation/geo-sector.ts:118-122`:

```
total(country) = ransomware×4 + phishing×1.5 + darknet×2.5
rank countries by total, descending
risk(country) = round(20 + (1 - rank/total) × 80)
```

This produces a smooth 20–100 risk score where the top country is
near 100 and the lowest is near 20.

---

## 6. Database Schema

All migrations are idempotent. See:

- `scripts/intel-automation-migration.sql` — round-1 tables
- `scripts/intel-automation-v2-migration.sql` — round-2 tables
- `scripts/seed-trend-history.sql` — optional 14-day backfill

### 6.1 Entity-Relationship Overview

Round 1 (5 tables):

| Table | Purpose | File:line |
|-------|---------|-----------|
| `intel_threat_score_history` | Score timeseries | `intel-automation-migration.sql:13-25` |
| `intel_correlation_clusters` | Cross-source clusters | `intel-automation-migration.sql:34-58` |
| `intel_briefings` | Daily executive briefs | `intel-automation-migration.sql:65-86` |
| `intel_trend_metrics` | Daily KPI counters | `intel-automation-migration.sql:91-105` |
| `intel_automation_runs` | Pipeline run log | `intel-automation-migration.sql:113-122` |

Round 2 (6 tables):

| Table | Purpose | File:line |
|-------|---------|-----------|
| `intel_metric_forecasts` | 7-day predictions | `intel-automation-v2-migration.sql:14-24` |
| `intel_anomalies` | Z-score deviations | `intel-automation-v2-migration.sql:32-46` |
| `intel_action_queue` | Analyst tasks | `intel-automation-v2-migration.sql:54-77` |
| `intel_geo_threat` | Per-country risk | `intel-automation-v2-migration.sql:84-99` |
| `intel_sector_risk` | Per-industry risk | `intel-automation-v2-migration.sql:104-118` |
| `intel_notification_log` | Webhook audit | `intel-automation-v2-migration.sql:124-135` |

### 6.2 Idempotency contract

Every automation table has a deterministic uniqueness constraint so the
pipeline is safe to re-run:

| Table | Idempotent on |
|-------|---------------|
| `intel_threat_score_history` | append-only timeseries |
| `intel_correlation_clusters` | `cluster_key` |
| `intel_briefings` | `(briefing_type, period_start)` |
| `intel_trend_metrics` | `(metric_key, bucket_date)` |
| `intel_metric_forecasts` | `(metric_key, forecast_date)` |
| `intel_anomalies` | `(metric_key, bucket_date)` |
| `intel_action_queue` | `action_key` (sha256) |
| `intel_geo_threat` | `(country, bucket_date)` |
| `intel_sector_risk` | `(sector, bucket_date)` |

---

## 7. API Surface

### 7.1 Cron entry-point

| Method | Path | Auth | File |
|--------|------|------|------|
| GET / POST | `/api/cron/automation` | `CRON_SECRET` bearer | `app/api/cron/automation/route.ts:17-44` |

### 7.2 Public read endpoints

| Method | Path | Returns | File |
|--------|------|---------|------|
| GET | `/api/intel/automation/status` | latest score, history, clusters, trends, briefing | `app/api/intel/automation/status/route.ts:18-35` |
| GET | `/api/intel/automation/forecasts` | 7-day forecasts + recent anomalies | `app/api/intel/automation/forecasts/route.ts` |
| GET | `/api/intel/automation/geo` | country + sector snapshot | `app/api/intel/automation/geo/route.ts` |
| GET | `/api/intel/automation/actions?status=open` | action queue | `app/api/intel/automation/actions/route.ts:13-22` |
| GET | `/api/intel/automation/briefings` | briefing archive | `app/api/intel/automation/briefings/route.ts` |
| GET | `/api/intel/automation/briefings/export` | latest briefing as PDF | `app/api/intel/automation/briefings/export/route.ts:11-34` |
| GET | `/api/intel/automation/stream` | SSE: `score` events every 10s | `app/api/intel/automation/stream/route.ts:13-65` |

### 7.3 Auth-required endpoints

| Method | Path | Auth | File |
|--------|------|------|------|
| PATCH | `/api/intel/automation/actions` | session | `app/api/intel/automation/actions/route.ts:24-43` |
| GET / POST | `/api/admin/automation/run` | admin | `app/api/admin/automation/run/route.ts:14-37` |

### 7.4 Sample request / response

`GET /api/intel/automation/status` (verified live, returns 17.7 KB):

```json
{
  "success": true,
  "timestamp": "2026-05-27T09:00:38.526Z",
  "threatScore": {
    "score": 47,
    "severity": "medium",
    "components": { "kev": 1585, "criticalCves24h": 0, "...": "..." },
    "drivers": ["1585 known-exploited vulnerabilities catalogued"],
    "delta24h": 0
  },
  "history": [{ "score": 47, "computedAt": "..." }, "..."],
  "clusters": [{ "clusterKey": "CVE-2026-1395", "...": "..." }],
  "trends": [{ "key": "cve_critical_24h", "current": 0, "...": "..." }],
  "briefing": { "headline": "...", "summary": "...", "...": "..." }
}
```

---

## 8. User Interface

### 8.1 Threat Command Center

Path: `/intelligence/command-center`
Implementation: `app/intelligence/command-center/page.tsx:68-580` (server
component).

Sections, in order:

| # | Section | Code reference |
|---|---------|----------------|
| 1 | Header with live SSE indicator + PDF link | `command-center/page.tsx:155-189` |
| 2 | Threat Score gauge + history sparkline | `command-center/page.tsx:194-228` |
| 3 | Today's executive briefing | `command-center/page.tsx:230-296` |
| 4 | Score drivers chip list | `command-center/page.tsx:300-318` |
| 5 | Trend cards with sparklines | `command-center/page.tsx:321-368` |
| 6 | Top correlated clusters | `command-center/page.tsx:371-430` |
| 7 | Action queue preview (top 5) | `command-center/page.tsx:434-478` |
| 8 | 7-day forecasts + anomalies | `command-center/page.tsx:481-560` |
| 9 | Geographic heatmap + sector index | `command-center/page.tsx:564-620` |

### 8.2 Action Queue

Path: `/intelligence/action-queue`
Implementation: `app/intelligence/action-queue/page.tsx:69-326` (client
component because of status-mutation buttons).

Features:
- Filter pills: open / in_progress / done / all
  (`action-queue/page.tsx:147-172`)
- Per-card severity badge, category badge, priority score
  (`action-queue/page.tsx:188-220`)
- Expandable suggested-step playbook
  (`action-queue/page.tsx:224-237`)
- Status transitions: open → in_progress → done; reopen / dismiss
  (`action-queue/page.tsx:241-300`)
- All mutations are CSRF-protected (`action-queue/page.tsx:97-115`).

### 8.3 Briefings Archive

Path: `/intelligence/briefings`
Implementation: `app/intelligence/briefings/page.tsx:31-135` (server
component).

### 8.4 Admin Automation

Path: `/admin/automation` (alias `/admin-portal/automation`)
Implementation: `app/admin/automation/page.tsx:23-343` (client component).

Capabilities:
- "Run pipeline now" button (`admin/automation/page.tsx:54-87`)
- Manual feed-sync triggers (`admin/automation/page.tsx:91-115`)
- Recent runs log with success/failed/running badges
  (`admin/automation/page.tsx:265-340`)

### 8.5 Reusable UI components

| Component | Purpose | File |
|-----------|---------|------|
| `ThreatScoreGauge` | Semi-circle dial | `components/intelligence/threat-score-gauge.tsx:23-117` |
| `Sparkline` | Inline trend line | `components/intelligence/sparkline.tsx:9-58` |
| `ForecastChart` | Past + future + CI band | `components/intelligence/forecast-chart.tsx:21-138` |
| `GeoHeatmap` | Bar chart with flag emoji | `components/intelligence/geo-heatmap.tsx:21-100` |
| `LiveScoreIndicator` | SSE consumer | `components/intelligence/live-score-indicator.tsx:9-69` |

All charts are pure SVG with no external chart library (Chart.js,
Recharts, etc.). This keeps the bundle small and avoids hydration
mismatches.

---

## 9. Security Model

### 9.1 Cron authentication

`app/api/cron/automation/route.ts:17-23`:

```ts
function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV !== "production"
  const authHeader = request.headers.get("authorization") || ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  return bearer === expected || request.headers.get("x-cron-secret") === expected
}
```

In production, requests without a valid `CRON_SECRET` are rejected with
`401`. No fallback.

### 9.2 Admin endpoint guards

`app/api/admin/automation/run/route.ts:13-19`:

```ts
const auth = await requireAdmin(request)
if (!auth.authorized) {
  return NextResponse.json({ error: auth.error }, { status: auth.status })
}
```

`requireAdmin` re-fetches the user from the database every request — it
does not trust the JWT alone. See
`lib/middleware.ts:55` for the canonical implementation.

### 9.3 CSRF protection on mutating endpoints

The `PATCH /api/intel/automation/actions` endpoint is auth-gated via
`requireAuth` (`app/api/intel/automation/actions/route.ts:24-30`). The
client side fetches a CSRF token from `/api/auth/me` and submits it in
both the `X-CSRF-Token` header and the request body
(`action-queue/page.tsx:97-115`).

### 9.4 No upstream-source disclosure

Per workspace rule, the UI never reveals upstream API/source names.
All correlation signals carry an anonymised `source` field
(`correlator.ts:14-18`):

```ts
source?: string  // anonymous label, e.g. "exploit", "feed" — never raw provider name
```

### 9.5 Input sanitisation

Every dynamic SQL parameter goes through the parameterised
`query(sql, params)` wrapper at `lib/db.ts:62-77`. No string
interpolation of user input.

---

## 10. Performance & Scalability

### 10.1 Read paths

All user-facing reads go to small, indexed tables. Indexes:

| Table | Index | File:line |
|-------|-------|-----------|
| `intel_threat_score_history` | `(computed_at DESC)` | `intel-automation-migration.sql:27-28` |
| `intel_correlation_clusters` | `(risk_score DESC, last_seen DESC)` | `intel-automation-migration.sql:60-61` |
| `intel_briefings` | `(generated_at DESC)`, `(briefing_type, generated_at DESC)` | `intel-automation-migration.sql:88-91` |
| `intel_trend_metrics` | `(metric_key, bucket_date DESC)`, partial on emerging | `intel-automation-migration.sql:107-110` |
| `intel_metric_forecasts` | `(metric_key, forecast_date)` | `intel-automation-v2-migration.sql:26-27` |
| `intel_action_queue` | `(status, priority DESC)` | `intel-automation-v2-migration.sql:79-80` |
| `intel_geo_threat` | `(bucket_date DESC, risk_score DESC)` | `intel-automation-v2-migration.sql:101-102` |

### 10.2 Pipeline cost (measured live)

Round-1 only:    ~1.0 s per cycle on a populated database.
Full pipeline:    ~1.0–1.5 s per cycle (eight stages, 1685 CVEs,
                  101 news items, 35 ransomware victims).

| Stage | Approx. cost |
|-------|--------------|
| Threat score | 10 parallel COUNTs |
| Correlation | 1 anchor query + 2 joins for 80 CVEs |
| Trends | 7 parallel COUNTs + upserts |
| Forecast | O(n) per metric; ~50 forecast points written |
| Geo / sector | 6 GROUP BYs |
| Actions | reads + upserts for ≤ 35 candidates |
| Briefing | re-uses cached counters |
| Notifications | webhook fan-out (capped) |

### 10.3 Cache strategy

The automation layer itself does not cache results — every read query
hits Postgres. This is a deliberate trade-off: SSR pages stay simple
(no stale-while-revalidate logic) and the database remains the single
source of truth. Cache lives in the underlying feed tables which are
populated by the separate `intel-sync` cron.

---

## 11. Test Plan & Verification

The full plan is in `docs/defence/test-cases.md`. Runnable scripts are
in `tests/`. To execute:

```bash
# Apply both migrations and the seed
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-migration.sql
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-v2-migration.sql

# Start the dev server (separate terminal)
npm run dev

# Run the test suite
npm run defence:test

# Build the defence PDF
npm run defence:pdf
```

### 11.1 Test categories

| Category | Count | Source |
|----------|-------|--------|
| Migration / schema | 12 | `tests/01-schema.test.mjs` |
| Threat score math | 8  | `tests/02-threat-score.test.mjs` |
| Correlator (v1) | 6  | `tests/03-correlator.test.mjs` |
| Forecast & anomaly | 7  | `tests/04-forecast.test.mjs` |
| Action queue | 6  | `tests/05-actions.test.mjs` |
| API endpoints | 9  | `tests/06-api.test.mjs` |
| PDF & SSE | 4  | `tests/07-pdf-sse.test.mjs` |
| Webhook delivery (E2E) | 4  | `tests/08-webhook.test.mjs` |
| Forecast backtest | 5  | `tests/09-backtest.test.mjs` |
| Collaboration, hunt, rate-limit | 9  | `tests/10-collab-hunt.test.mjs` |
| Attribution + events | 4  | `tests/11-attribution-events.test.mjs` |
| Deep correlator v2 | 10 | `tests/12-deep-correlator.test.mjs` |

Total **84 test cases**, all green on the verified build.

---

## 12. Deployment Workflow

### 12.1 First-time setup

```bash
# 1. Start postgres
docker compose up -d   # or: docker start intelforge-postgres

# 2. Apply schema
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/database.sql                          # base schema (existing)
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-feeds-migration.sql             # feed cache (existing)
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-advanced-feeds-migration.sql    # advanced feeds (existing)
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-migration.sql        # NEW round 1
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-v2-migration.sql     # NEW round 2

# 3. (Optional) backfill 14 days of trend history so forecasts work immediately
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/seed-trend-history.sql

# 4. Start the app
npm run dev   # or: npm run build && npm start

# 5. Bootstrap intelligence + automation
curl -X POST http://localhost:3000/api/cron/intel-sync \
  -H "Authorization: Bearer $CRON_SECRET"
curl -X POST http://localhost:3000/api/cron/automation \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 12.2 Production schedule

Recommended cron (CRON_SECRET-protected):

```
*/30 * * * *   POST /api/cron/intel-sync     # feeds every 30 min
5/30 * * * *   POST /api/cron/automation     # automation 5 min after
0   8 * * *    POST /api/cron/automation     # extra run at 08:00 for the daily briefing
```

---

## 13. Future Work

- LLM-augmented narrative generation for the briefing (currently
  deterministic). The current design swaps in cleanly: replace
  `briefing-generator.ts:123-153` (`buildNarrative`) with an LLM call.
- Real ML forecasting (ARIMA / Prophet / LSTM) for higher-accuracy
  long-horizon prediction.
- Per-tenant automation rows (currently global; the schema would only
  need an extra `tenant_id` column with index).
- Action-queue assignment + comments (`assigned_to` column already
  exists in schema, UI not yet built).
- iCal / email export of the daily briefing.

---

## Appendix A — File Inventory (current)

### A.1 Library code (`lib/intel/automation/` — 20 files, 4 941 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `correlator-v2.ts` | 987 | Deep multi-anchor correlator (CVE/actor/ransomware) |
| `briefing-generator.ts` | 368 | Deterministic narrative + optional LLM rewrite |
| `correlator.ts` | 357 | Legacy v1 correlator (KEV-only, kept for backward compat) |
| `forecast.ts` | 303 | Holt's smoothing + z-score anomaly detection |
| `geo-sector.ts` | 276 | Per-country / per-sector risk index |
| `action-queue.ts` | 272 | Auto-generated analyst tasks with audit trail |
| `threat-score.ts` | 268 | Composite 0–100 global threat score |
| `forecast-backtest.ts` | 230 | Holt + Holt-Winters + naive backtesting (MAPE/RMSE/MAE) |
| `orchestrator.ts` | 220 | 10-stage pipeline runner |
| `briefing-pdf.ts` | 215 | PDFKit A4 renderer |
| `openapi.ts` | 175 | OpenAPI 3.1 spec generator |
| `trends.ts` | 200 | 7-KPI daily capture with emerging-flag |
| `notifications.ts` | 158 | Webhook fan-out + notification log |
| `action-collab.ts` | 145 | Comments, assignment, audit log |
| `briefing-llm.ts` | 150 | Optional LLM rewrite (OpenAI/Anthropic/Gemini/DeepSeek) |
| `events.ts` | 130 | Postgres LISTEN/NOTIFY pub-sub bridge |
| `correlator-nlp.ts` | 105 | Alias dict + pg_trgm fuzzy news matching |
| `anomaly-attribution.ts` | 95 | Source-row attribution for anomalies |
| `cron-rate-limit.ts` | 35 | 10-calls/min/IP cap with Retry-After |
| `README.md` | 60 | Module documentation |

### A.2 API routes (`app/api/` — 17 files, 975 lines)

| File | Lines |
|------|-------|
| `app/api/cron/automation/route.ts` | 72 |
| `app/api/intel/automation/status/route.ts` | 36 |
| `app/api/intel/automation/stream/route.ts` | 90 |
| `app/api/intel/automation/actions/route.ts` | 85 |
| `app/api/intel/automation/actions/bulk/route.ts` | 48 |
| `app/api/intel/automation/actions/[id]/comments/route.ts` | 55 |
| `app/api/intel/automation/actions/[id]/assign/route.ts` | 38 |
| `app/api/intel/automation/forecasts/route.ts` | 22 |
| `app/api/intel/automation/forecast-accuracy/route.ts` | 24 |
| `app/api/intel/automation/geo/route.ts` | 14 |
| `app/api/intel/automation/clusters/route.ts` | 21 |
| `app/api/intel/automation/hunt/route.ts` | 130 |
| `app/api/intel/automation/briefings/route.ts` | 17 |
| `app/api/intel/automation/briefings/export/route.ts` | 35 |
| `app/api/openapi.json/route.ts` | 14 |
| `app/api/admin/automation/run/route.ts` | 38 |
| `app/api/admin/automation/runs/route.ts` | 60 |

### A.3 Pages (5 automation pages, 1 966 lines)

| File | Lines |
|------|-------|
| `app/intelligence/command-center/page.tsx` | 614 |
| `app/intelligence/action-queue/page.tsx` | 583 |
| `app/intelligence/clusters/page.tsx` | 354 |
| `app/intelligence/hunt/page.tsx` | 280 |
| `app/intelligence/briefings/page.tsx` | 135 |
| `app/admin/automation/page.tsx` | 343 |
| `app/api-docs/page.tsx` | 35 |

### A.4 Components (5 files, 522 lines)

| File | Lines |
|------|-------|
| `components/intelligence/threat-score-gauge.tsx` | 132 |
| `components/intelligence/forecast-chart.tsx` | 149 |
| `components/intelligence/geo-heatmap.tsx` | 100 |
| `components/intelligence/sparkline.tsx` | 72 |
| `components/intelligence/live-score-indicator.tsx` | 69 |

### A.5 Migrations & seed scripts (6 SQL files, 876 lines)

| File | Lines |
|------|-------|
| `scripts/intel-automation-migration.sql` | 126 |
| `scripts/intel-automation-v2-migration.sql` | 137 |
| `scripts/intel-automation-v3-migration.sql` | 95 |
| `scripts/intel-automation-v4-migration.sql` | 200 |
| `scripts/seed-trend-history.sql` | 72 |
| `scripts/seed-correlation-demo.sql` | 246 |

### A.6 Tests (14 files, 1 420 lines)

12 test suites + runner + helpers.

### A.7 Defence documentation (22 files, 3 230 lines)

8 Mermaid diagrams + 8 SVG diagrams + 6 prose docs.

### A.8 Defence tooling (3 files, 884 lines)

`scripts/build-defence-pdf.mjs` · `scripts/demo.ps1` · `scripts/inventory.mjs`

---

**Net new code:** ~14 800 lines across 92 files (automation layer only).

**Database tables added:** 17 new tables + 1 materialised view.

**Test coverage:** 84 cases across 12 suites, all green.

---

## Appendix B — Defence Q&A

The most likely committee questions, with the answer and the file:line
where the proof lives.

**Q1. How is the threat score actually calculated?**
A1. Weighted sum of ten cached metrics, baseline 30, capped at 100.
The exact formula is in `lib/intel/automation/threat-score.ts:128-176`.
We can demo by running `npm run defence:test 02` which prints the
intermediate components and the final score.

**Q2. What if you used an LLM for the briefing — wouldn't that be
better?**
A2. We chose deterministic templates so the demo never depends on an
external API key, never burns money, and produces verifiable output.
LLM augmentation is a clean drop-in: see
`briefing-generator.ts:123-153`.

**Q3. How is forecasting done without a real ML library?**
A3. Holt's linear exponential smoothing is a textbook time-series
method (Hyndman & Athanasopoulos, *Forecasting: Principles and
Practice*, ch. 7). We implement it directly in
`lib/intel/automation/forecast.ts:69-101` because it is cheap,
deterministic, and well-suited to short-horizon (≤ 14 day) cyber
KPIs that exhibit weak trend and high noise.

**Q4. Why z-score instead of Isolation Forest / DBSCAN / etc.?**
A4. With only 14 daily points per metric, modern detectors overfit.
A 13-day rolling z-score is the correct level of complexity. See
`forecast.ts:171-227`.

**Q5. How do you avoid double-counting on re-runs?**
A5. Every automation table has an idempotency key — see §6.2. The
correlator upserts on `cluster_key`, the briefing on
`(briefing_type, period_start)`, the action queue on a SHA-256
`action_key`, etc. Re-running the full pipeline with no new feed data
produces zero extra rows.

**Q6. What stops a stale upstream feed from inflating the score?**
A6. Two safeguards. First, the score includes a "feed failures"
penalty (`threat-score.ts:165-170`) so blind spots are visible.
Second, every COUNT query is window-bounded (e.g. "last 24 hours"),
so old data ages out naturally.

**Q7. Show me the data flow from cron to UI.**
A7. See diagram `docs/defence/diagrams/02-pipeline-flow.md`. Cron
hits `app/api/cron/automation/route.ts:46`. That calls
`runFullAutomation` (`orchestrator.ts:60-179`) which writes to all
nine automation tables. The user-facing pages are server components
that read those tables directly via `query()` and render server-side.

**Q8. How does the SSE stream stay alive?**
A8. `app/api/intel/automation/stream/route.ts:13-65` returns a
`ReadableStream` with `text/event-stream`. A 10-second `setInterval`
re-pulls the latest score row and emits a `score` event. The client
(`live-score-indicator.tsx:9-69`) opens an `EventSource` and re-renders.
Aborting the request closes the interval cleanly.

**Q9. Tell me one thing you would refactor with another month.**
A9. Move the per-metric configuration of trends + forecasts out of code
(`trends.ts:21-86`) into a `intel_metric_definitions` table so admins
can add KPIs through the UI rather than editing source.

**Q10. How would you scale this to ten thousand users?**
A10. Three changes. (1) Add a small in-memory cache layer in front
of the read endpoints with a 60-second TTL. (2) Introduce a
materialised view for `intel_correlation_clusters` joined with the
underlying CVE row to avoid the runtime join. (3) Move the SSE
stream behind a Redis pub/sub channel so multiple Next.js instances
can share a single broadcaster.

**Q11. How deep is the correlation? Isn't it just matching CVE IDs?**
A11. No. The v2 correlator (`lib/intel/automation/correlator-v2.ts`)
runs three parallel anchor passes (CVE, actor, ransomware) and
collects 11 distinct signal types: KEV, exploit, news, paste posts,
stealer logs, compromised hosts, combolists, ransomware victims,
dark-web posts, actor-link edges, and related CVEs. Each signal
carries a 0–100 confidence score. The cluster score is a weighted
sum with time-decay (half-life 60 days). On the demo seed, the top
cluster (CVE-2023-34362 / MOVEit) bundles 11 signals across 7 types
with confidence 85. See `docs/defence/correlation-deep-dive.md` for
the full architecture and live verification numbers.

**Q12. Where are the stealer logs / combolists / paste posts?**
A12. Six new tables in `scripts/intel-automation-v4-migration.sql`:
`intel_paste_posts`, `intel_stealer_logs`, `intel_combolist_drops`,
`intel_compromised_hosts`, `intel_actor_cve_links`,
`intel_actor_breach_links`. All passwords are stored as
`<REDACTED:length>` placeholders — never raw credentials. The demo
seed in `scripts/seed-correlation-demo.sql` populates realistic
synthetic data across 6 countries, 4 stealer families, 5 combolist
drops, and 9 paste posts.

**Q13. How does the correlator handle a CVE that has no literal ID
in the news?**
A13. Three fallback strategies: (1) a curated alias dictionary
(`correlator-nlp.ts:13-35`) maps names like "Log4Shell" →
CVE-2021-44228; (2) `pg_trgm` fuzzy similarity on the news title
against the CVE description keywords (threshold 0.30); (3) actor-
link transitivity — if actor X exploits CVE Y and actor X is
mentioned in a news article, that article becomes a signal on the
CVE Y cluster.

**Q14. What's the difference between the old correlator and v2?**
A14. v1 produced 80 KEV-only clusters with 2 signals each and 1
distinct signal type. v2 produces 176 clusters across 3 anchor
types, avg 2.91 signals, max 17, 8 distinct signal types. That's
+120% clusters, +45% density, +700% signal-type diversity. The
comparison is documented in `docs/defence/correlation-deep-dive.md`
section 5.
