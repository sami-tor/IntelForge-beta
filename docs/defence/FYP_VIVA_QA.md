# IntelForge — FYP Viva Questions & Answers

> 60+ questions covering every angle the committee might ask.
> Organised by topic. Memorise the short answers; use the detailed
> answers when pressed.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [Architecture & Design](#3-architecture--design)
4. [Automation Layer (FYP Contribution)](#4-automation-layer-fyp-contribution)
5. [Correlation Engine](#5-correlation-engine)
6. [Forecasting & Anomaly Detection](#6-forecasting--anomaly-detection)
7. [Database & Schema Design](#7-database--schema-design)
8. [Security](#8-security)
9. [Testing & Quality](#9-testing--quality)
10. [Technology Stack](#10-technology-stack)
11. [AI Usage & Originality](#11-ai-usage--originality)
12. [Limitations & Future Work](#12-limitations--future-work)
13. [Comparison with Existing Tools](#13-comparison-with-existing-tools)
14. [Software Engineering Process](#14-software-engineering-process)

---

## 1. Project Overview

### Q1. What is IntelForge?
**A:** IntelForge is a self-hosted Threat Intelligence SaaS platform that aggregates cyber threat data from 27+ open-source feeds, correlates signals across 12 source tables, and runs a fully automated 10-stage pipeline that produces threat scores, forecasts, analyst tasks, and executive briefings — all without human intervention.

### Q2. What is the main goal of this project?
**A:** To build a closed-loop automation layer on top of a threat intelligence platform so that security teams get actionable intelligence (not just raw data) delivered automatically — scored, correlated, forecasted, and prioritised.

### Q3. Who is the target user?
**A:** Security Operations Centre (SOC) analysts, threat intelligence teams, CISOs who need a daily posture view, and managed security service providers (MSSPs) who serve multiple clients.

### Q4. What makes this different from a simple dashboard?
**A:** Dashboards display data. IntelForge *produces* intelligence. It correlates a CVE with its exploit, the actor who uses it, the victims they hit, the dark-web posts about it, and the stealer logs that reference it — then scores the cluster, forecasts what's coming next, generates a task for the analyst, and publishes a briefing. That's a pipeline, not a dashboard.

### Q5. How many features does the platform have?
**A:** 50 features total: 27 pre-existing intelligence modules (news, CVE, ransomware, IOC lookup, etc.) plus 23 automation-layer features built as the FYP contribution (threat score, deep correlation, forecasting, action queue, briefings, PDF export, SSE stream, webhooks, hunt builder, etc.).

---

## 2. Problem Statement & Motivation

### Q6. What problem does this solve?
**A:** Four problems:
1. **Fragmentation** — signals about one threat arrive across 10+ feeds and nobody correlates them in real time.
2. **Reactivity** — platforms show what happened but don't predict what's coming.
3. **Manual overhead** — briefings are written by hand, task queues managed in spreadsheets.
4. **Upstream fragility** — when a feed API goes down, the dashboard goes dark.

### Q7. Why is this problem important?
**A:** The average time to detect a breach is 204 days (IBM Cost of a Data Breach 2023). Faster correlation and automated alerting directly reduces that window. Every hour of delay costs organisations an average of $150K more in breach impact.

### Q8. Who currently solves this problem?
**A:** Recorded Future ($$$), Mandiant Advantage ($$$), CrowdStrike Falcon Intelligence ($$$). All are cloud-only, closed-source, and cost $50K–$500K/year. IntelForge demonstrates the same automation surface as a self-hosted, transparent, FYP-scope implementation.

### Q9. What gap does IntelForge fill that others don't?
**A:** Three gaps: (1) Empirically backtested forecast accuracy (MAPE/RMSE/MAE exposed per metric). (2) Fully transparent scoring — every component citable to a file:line. (3) Self-hostable on a laptop with Docker.

---

## 3. Architecture & Design

### Q10. Describe the system architecture.
**A:** Three-layer design:
- **Feed-sync layer** — 13 fetchers scrape upstream feeds into a local PostgreSQL cache every 30 minutes.
- **Automation layer** — reads only from that cache, runs 10 stages (score → correlate → trends → forecast → geo → actions → briefing → notifications), writes to 17 automation tables.
- **Output layer** — serves results through server-rendered pages, REST APIs, SSE stream, PDF export, and webhooks.

The key insight is the **cache boundary**: everything downstream of it survives upstream failures.

### Q11. Why Next.js 16?
**A:** Server Components give us instant page loads with zero client-side fetching (no loading spinners). App Router provides file-based API routes. TypeScript gives compile-time safety across 14,800 lines of automation code. The existing project was already on Next.js, so we extended rather than rewrote.

### Q12. Why PostgreSQL instead of MongoDB or Redis?
**A:** Relational integrity (foreign keys between actors → CVEs → victims), complex aggregation queries (GROUP BY country with weighted scoring), full-text search (pg_trgm for fuzzy matching), and LISTEN/NOTIFY for real-time push. PostgreSQL handles all four; MongoDB would need separate solutions for each.

### Q13. Why not microservices?
**A:** For FYP scope, a monolith with clear module boundaries (20 files in `lib/intel/automation/`) is simpler to deploy, test, and demo. The architecture is *modular* (each stage is isolated with its own try/catch), but it runs in one process. Splitting into microservices would add Docker Compose complexity without adding value at this scale.

### Q14. How does the system handle failures?
**A:** Three levels:
1. **Feed failures** — the cache serves stale data; the threat score includes a "feed failures" penalty so analysts know visibility is degraded.
2. **Pipeline stage failures** — each of the 10 stages is wrapped in its own try/catch; a failure in correlation doesn't stop the briefing from generating.
3. **Upstream outages** — all user-facing reads come from the local cache, never from upstream APIs.

### Q15. What design patterns did you use?
**A:**
- **Pipeline pattern** — orchestrator runs stages sequentially with isolated error handling.
- **Upsert/idempotency** — every table has a UNIQUE constraint so re-runs are safe.
- **Pub/sub** — Postgres LISTEN/NOTIFY for real-time events.
- **Strategy pattern** — forecast engine selects between Holt, Holt-Winters, and Naive per metric.
- **Observer pattern** — SSE subscribers receive events from the NOTIFY channel.
- **Repository pattern** — all DB access through `query()` wrapper, never raw pool calls.

---

## 4. Automation Layer (FYP Contribution)

### Q16. What exactly did you build for the FYP?
**A:** The entire automation layer: 20 library modules (4,941 lines), 17 API routes, 5 new pages, 5 UI components, 6 SQL migrations, 2 seed scripts, 12 test suites (84 cases), 23 diagrams, and a 147-page defence PDF. Total: ~14,800 lines across 92 files.

### Q17. How does the pipeline work end-to-end?
**A:** A cron job hits `POST /api/cron/automation` every 30 minutes. The orchestrator runs 10 stages:
1. Compute threat score (10 parallel COUNTs → weighted formula → 0-100)
2. Deep correlation (3 anchor passes × 12 source tables → 176 clusters)
3. Trend capture (7 KPIs → daily bucket → emerging flag)
4. Forecast + anomaly (Holt/HW → 7-day predictions; z-score → anomalies)
5. Anomaly attribution (which source rows caused the spike)
6. Forecast backtest (MAPE/RMSE/MAE per method)
7. Geo + sector index (per-country/industry risk)
8. Action queue (auto-generated analyst tasks)
9. Executive briefing (deterministic narrative + optional LLM)
10. Notifications (webhooks for critical events)

Total execution: ~1.5 seconds per cycle.

### Q18. What is the threat score and how is it calculated?
**A:** A composite 0–100 number derived from 10 cached metrics:
```
score = 30 (baseline)
  + min(25, criticalCves24h × 4)
  + min(10, highCves24h × 1.2)
  + min(10, log10(kev + 1) × 4)
  + min(15, ransomwareVictims7d × 0.5)
  + min(10, exploits24h × 1.5)
  + min(8, log10(activePhishing + 1) × 3)
  + min(6, malware24h × 0.05)
  + min(5, darknetPosts24h × 0.2)
  + min(5, feedFailures × 0.4)
```
Logarithmic terms prevent slow-growing catalogues (KEV, phishing) from dominating. Feed failures are included because lost telemetry is itself a security risk.

### Q19. What is the action queue?
**A:** Auto-generated, prioritised tasks for analysts. Each action has a category (patch/hunt/block/review/drill), a priority score (0-100), suggested steps (a playbook), and a full lifecycle (open → in_progress → done/dismissed). Actions are deduped via SHA-256 hash so re-running the pipeline never creates duplicates.

### Q20. How does the SSE stream work?
**A:** The endpoint at `/api/intel/automation/stream` returns a `ReadableStream` with `text/event-stream` content type. It subscribes to Postgres LISTEN/NOTIFY on the `intel_automation` channel. When the orchestrator finishes a stage, it calls `emitAutomationEvent()` which does `SELECT pg_notify('intel_automation', payload)`. The listener fires and pushes the event to all connected browsers. No polling, true push.

### Q21. How does the PDF export work?
**A:** `GET /api/intel/automation/briefings/export` calls `generateBriefingPdf(briefing)` which uses PDFKit to render an A4 document with: navy header bar, threat score tile, executive summary, metric grid, top clusters, and recommendations. Returns `application/pdf` with `Content-Disposition: attachment`. Verified: produces valid `%PDF-1.3` ... `%%EOF`.

---

## 5. Correlation Engine

### Q22. How deep is the correlation?
**A:** The v2 correlator runs 3 parallel anchor passes (CVE, actor, ransomware) and collects 11 signal types: KEV, exploit, news, paste posts, stealer logs, compromised hosts, combolists, ransomware victims, dark-web posts, actor-link edges, and related CVEs. Each signal carries a 0–100 confidence score. The cluster score is a weighted sum with time-decay (half-life 60 days).

### Q23. Give me an example of a correlation chain.
**A:** CVE-2023-34362 (MOVEit) cluster:
- KEV listing (confidence 100)
- Public exploit PoC (confidence 95)
- News article about mass exploitation (confidence 80)
- Pastebin victim-list dump (confidence 85)
- Linked actor: Cl0p (confidence 95)
- 3 ransomware victims: bank, manufacturer, college (confidence 85-95)
- 2 dark-web blog posts on Cl0p's leak site (confidence 75)

That's 11 signals across 7 types, all chained through actor linkage. Risk score: 100, confidence: 85.

### Q24. How is the cluster score calculated?
**A:**
```
score = base (25 + CVSS tier + KEV bonus)
      + Σ (signal_weight × confidence/100 × decay(age))
      + related_cve_bonus

decay(age) = max(0.4, 2^(−age_days / 60))
```
Signal weights: exploit=14, ransomware_victim=13, kev=12, actor_link=11, darknet_post=9, stealer_log=8, combolist=7, paste=6, news=4, related_cve=3.

### Q25. What's the difference between v1 and v2 correlator?
**A:**
| Metric | v1 | v2 |
|--------|----|----|
| Clusters | 80 | 176 |
| Anchor types | 1 (CVE only) | 3 (CVE + actor + ransomware) |
| Signal types | 1 (KEV only) | 8 observed |
| Avg signals/cluster | 2 | 2.91 (top: 17) |
| Confidence scoring | none | 0-100 per signal |
| Time decay | none | 60-day half-life |

### Q26. Why not use machine learning for correlation?
**A:** With 12 source tables and ~2000 rows of feed data, ML would overfit. The weighted-sum approach with explicit confidence scores is interpretable, auditable, and produces verifiable output. An analyst can look at a cluster and understand exactly why it scored 100 — that's not possible with a neural network.

---

## 6. Forecasting & Anomaly Detection

### Q27. What forecasting method do you use?
**A:** Holt's linear exponential smoothing (level + trend) and Holt-Winters additive (level + trend + weekly seasonality, period=7). We also compute a naive baseline (last-value repeat) for comparison.

### Q28. Why Holt-Winters and not ARIMA or Prophet?
**A:** With only 14 daily data points per metric, ARIMA's parameter estimation is unreliable and Prophet's Bayesian approach is overkill. Holt-Winters with period=7 captures the weekly CVE publishing pattern (more on Tuesdays, fewer on weekends) while remaining cheap and deterministic. We prove it works via backtesting.

### Q29. How do you validate forecast accuracy?
**A:** Every pipeline cycle runs a holdout backtest: hold out the last 7 days, fit all 3 methods on the prior history, score MAPE/RMSE/MAE. Results are stored in `intel_forecast_accuracy` and exposed via `/api/intel/automation/forecast-accuracy`. On our data: Holt-Winters MAPE=0.32%, naive MAPE=0.43% — smart methods beat baseline by 25%.

### Q30. How does anomaly detection work?
**A:** Z-score over a 13-day rolling window (excluding today):
```
μ = mean(window)
σ = sd(window)
z = (today - μ) / σ
```
Threshold: |z| ≥ 2 AND |today - μ| ≥ 2 (the second condition suppresses noise on small-value series). Severity: critical (|z|≥3.5), high (|z|≥2.5), medium otherwise.

### Q31. What is anomaly attribution?
**A:** When an anomaly fires, we query the underlying source table for the same date and attach the top contributing rows to the `caused_by` JSONB column. So the dashboard doesn't just say "critical CVEs spiked" — it shows you the 12 specific CVEs that caused the spike.

---

## 7. Database & Schema Design

### Q32. How many tables does the automation layer add?
**A:** 17 tables + 1 materialised view, across 4 migrations (v1-v4).

### Q33. How do you ensure idempotency?
**A:** Every automation table has a deterministic UNIQUE constraint:
- `intel_correlation_clusters` → `cluster_key`
- `intel_briefings` → `(briefing_type, period_start)`
- `intel_trend_metrics` → `(metric_key, bucket_date)`
- `intel_action_queue` → `action_key` (SHA-256 hash)
- `intel_geo_threat` → `(country, bucket_date)`

All writes use `INSERT ... ON CONFLICT DO UPDATE`. Re-running the pipeline with no new data produces zero extra rows.

### Q34. Why store passwords as `<REDACTED:length>`?
**A:** Ethical and legal obligation. Stealer logs contain real credentials from compromised machines. We demonstrate the correlation capability (URL + domain + stealer family + country) without ever storing or displaying actual passwords. The `<REDACTED:8>` format preserves the password length (useful for complexity analysis) without the value.

### Q35. What indexes do you have?
**A:** 25+ indexes across the automation tables, including:
- B-tree on `(computed_at DESC)` for score history
- B-tree on `(risk_score DESC, last_seen DESC)` for cluster ranking
- GIN on `matched_cves` array for paste-post CVE matching
- GIN trigram on `title` for fuzzy news search
- Partial index on `is_emerging WHERE is_emerging = true` for trend alerts

---

## 8. Security

### Q36. How is the cron endpoint protected?
**A:** Three layers: (1) Bearer token (`CRON_SECRET` — 64-char random hex). (2) Rate limiting (10 calls/min/IP, returns 429 + Retry-After). (3) In production, requests without valid secret are rejected with 401.

### Q37. How do you prevent SQL injection?
**A:** All database access goes through `query(sql, params)` at `lib/db.ts:62-77` which uses PostgreSQL's parameterised query protocol (`$1, $2, ...`). Zero string interpolation of user input anywhere in the codebase.

### Q38. How is the admin panel protected?
**A:** `requireAdmin()` at `lib/middleware.ts:158` re-fetches the user from the database on every request — it never trusts the JWT alone. Even if a JWT is forged with `role: admin`, the DB check will reject it.

### Q39. How do you handle CSRF?
**A:** Double-submit cookie pattern. The client fetches a CSRF token from `/api/auth/me` and submits it in both the `X-CSRF-Token` header and the request body. All mutating endpoints (PATCH, POST, DELETE) validate this token.

### Q40. What about the stealer logs — isn't storing them risky?
**A:** We store: URL (full), domain (full), login (masked: `j****@example.invalid`), password (`<REDACTED:length>` only). The actual password value is never persisted. All demo data uses `.invalid` TLD (RFC 2606 reserved). No real credentials exist in the system.

---

## 9. Testing & Quality

### Q41. How many tests do you have?
**A:** 84 test cases across 12 suites, all passing. They cover: schema constraints, scoring math, correlation depth, forecast accuracy, action-queue state machine, all API endpoints (200/401/403/429), PDF generation, SSE delivery, webhook end-to-end, and the deep correlator's signal-type diversity.

### Q42. What kind of tests are these?
**A:** Integration tests that run against the live dev server + real PostgreSQL. They exercise the full stack: HTTP request → API route → library code → database → response validation. More valuable than unit tests for proving the system actually works end-to-end.

### Q43. How do you run the tests?
**A:** `npm run defence:test` — takes ~45 seconds. Requires the dev server running and PostgreSQL up with migrations applied. Exit code 0 = all pass.

### Q44. What does the test for the correlator verify?
**A:** Suite 12 (10 cases) verifies: all 6 artifact tables exist, demo seed is populated, pipeline produces multiple cluster types, top-10 clusters have avg ≥4 signals, at least 5 distinct signal types are present, every signal has confidence in [0,100], cluster confidence is bounded [20,99], the API returns the correct shape, type-filtering works, and top CVE clusters reference at least one actor.

### Q45. How do you verify the PDF is valid?
**A:** Suite 7 checks: Content-Type is `application/pdf`, first 4 bytes are `%PDF` (magic header), and file size > 1500 bytes (real content rendered, not an error page).

---

## 10. Technology Stack

### Q46. List your tech stack.
**A:**
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI
- **Backend:** Next.js App Router (Node.js 20), PostgreSQL 16
- **Automation:** Custom TypeScript pipeline (no external ML/AI framework)
- **Search:** pg_trgm (fuzzy), Milvus (vector), Quickwit (full-text)
- **PDF:** PDFKit (server-side rendering)
- **Real-time:** Postgres LISTEN/NOTIFY → SSE
- **Auth:** JWT (jose) + bcrypt + TOTP (speakeasy)
- **Deployment:** Docker (PostgreSQL), Node.js
- **Testing:** Custom ESM test harness (no Jest/Vitest dependency)

### Q47. Why no external ML library?
**A:** The forecasting (Holt-Winters) and anomaly detection (z-score) are implemented in ~100 lines of TypeScript each. Adding TensorFlow.js or scikit-learn would add 200MB+ of dependencies for the same result. The algorithms are textbook-simple and the implementation is auditable line-by-line.

### Q48. Why custom test harness instead of Jest?
**A:** Portability. The test suite runs with zero npm dev dependencies beyond Node.js itself. No `jest.config.js`, no `@types/jest`, no transform pipeline. Just `node tests/run-all.mjs`. This means it works identically in CI, on a fresh machine, and during the live demo.

---

## 11. AI Usage & Originality

### Q49. Did you use AI to build this?
**A:** Yes, as a coding accelerator — the same way an architect uses AutoCAD or a surgeon uses a robot arm. AI helped write boilerplate faster (SQL INSERT statements, React JSX, PDFKit rendering calls). The decisions — what to build, how to structure it, which algorithms to use, how to validate correctness — are entirely mine.

### Q50. What's YOUR contribution then?
**A:**
1. **Problem identification** — I identified the fragmentation/reactivity/overhead/fragility gaps.
2. **Architecture decisions** — cache boundary, Postgres LISTEN/NOTIFY, Holt-Winters over ARIMA, multi-anchor correlation.
3. **Data modelling** — 17 tables with idempotency contracts and confidence columns.
4. **Algorithm selection** — signal weights, time-decay half-life, z-score threshold with baseline guard.
5. **Quality assurance** — I caught that v1 was producing trivial output (4/10) and rebuilt it as v2.
6. **Integration engineering** — PDFKit + webpack fix, SSE abort handling, CSRF flow.
7. **Demo corpus design** — chose CVEs the committee would recognise, designed the actor→CVE→victim chain.

### Q51. Prove this is your work.
**A:** I can explain every design decision, defend every trade-off, and show you where I caught and fixed my own mistakes. The v1 correlator scored 4/10 on my own audit — I didn't ship it, I redesigned it. Someone who just prompted an AI and pasted output can't do that. Ask me about any module.

### Q52. Could someone without domain knowledge produce this with AI?
**A:** No. The signal weights (exploit=14, news=4) reflect real-world CTI priority. The decision to include feed-failure penalty in the threat score requires understanding that lost telemetry is a security risk. The choice of 60-day half-life for time decay comes from observing that a 2-month-old signal is still relevant but shouldn't dominate. These are domain judgements, not code generation.

---

## 12. Limitations & Future Work

### Q53. What are the limitations?
**A:**
1. No vector embeddings (pgvector not installed) — uses curated alias dict + pg_trgm instead.
2. Curated alias list is small (~20 historical CVE names).
3. No causality reasoning ("exploit appeared 3 days after CVE").
4. Geographic/sector overlap isn't yet a correlation signal.
5. Multi-tenant isolation not enforced (schema-ready but no row-level security).
6. No mobile-optimised views.

### Q54. What would you do with another month?
**A:**
1. Add pgvector for semantic similarity correlation.
2. Move metric definitions to a DB table so admins can add KPIs via UI.
3. Add MITRE ATT&CK technique mapping to correlation clusters.
4. Build a Slack bot that posts the daily briefing.
5. Add per-tenant automation rows with row-level security.

### Q55. What would you do differently if starting over?
**A:** I'd build the deep correlator (v2) from day one instead of shipping v1 and then rebuilding. The multi-anchor design with confidence scoring should have been the first implementation, not an iteration. I'd also set up the backtest harness earlier so I could validate forecasting accuracy from the start.

---

## 13. Comparison with Existing Tools

### Q56. How does this compare to Recorded Future?
**A:** Recorded Future has: vendor-curated analyst research, ML-driven NLP, 1M+ sources, 24/7 analyst hotline. IntelForge has: transparent scoring (every component citable), empirical forecast accuracy (MAPE exposed), self-hostable, and open data model. We compete on transparency and self-hosting; we don't compete on scale or human analyst coverage.

### Q57. How does this compare to AlienVault OTX?
**A:** OTX is a community-driven IOC sharing platform. IntelForge goes further: it doesn't just aggregate IOCs, it correlates them across 12 tables, scores them with confidence, forecasts trends, generates analyst tasks, and publishes briefings. OTX has no automation layer, no forecasting, no action queue.

### Q58. What's your competitive advantage?
**A:** Three things no commercial platform exposes: (1) Backtested forecast accuracy with published MAPE. (2) Fully transparent scoring formula citable to file:line. (3) Self-hostable on a laptop — zero cloud dependency.

---

## 14. Software Engineering Process

### Q59. What methodology did you follow?
**A:** Iterative development with continuous integration. Each feature was: design → implement → test → verify → document. The automation layer was built in 4 rounds (v1-v4), each adding tables, modules, and tests. The v1→v2 correlator rewrite demonstrates the iterative improvement cycle.

### Q60. How did you manage requirements?
**A:** Started with the 4 problems (fragmentation, reactivity, overhead, fragility). Derived 31 objectives (O1-O31 in the defence doc). Each objective maps to a specific file:line implementation and at least one test case.

### Q61. How did you ensure quality?
**A:** Four mechanisms: (1) TypeScript strict mode — zero compile errors. (2) 84 integration tests against live DB. (3) Self-audit of v1 correlator output led to v2 rewrite. (4) Every pipeline run is logged with duration, output, and errors in `intel_automation_runs`.

### Q62. How is the project documented?
**A:** 147-page defence PDF (auto-generated from markdown), 23 UML diagrams, 84 test cases with code references, demo script, comparison table, correlation deep-dive, and this Q&A document. All regenerable with `npm run defence:pdf`.

### Q63. What was the hardest part?
**A:** Getting the correlation engine to produce genuinely useful output. The v1 implementation looked correct in code but produced trivial results (80 KEV-only clusters with 2 signals each). Diagnosing that required running the pipeline against real data, auditing the output, and redesigning the architecture with multi-anchor passes and confidence-weighted scoring. That's the kind of problem AI can't solve — it requires evaluating your own work critically.

---

## Quick Reference — Numbers to Cite

| Metric | Value |
|--------|-------|
| Total features | 50 (27 intel + 23 automation) |
| Automation library | 20 files, 4,941 lines |
| Total new code | 92 files, ~14,800 lines |
| Database tables (automation) | 17 + 1 materialised view |
| Signal types in correlator | 11 |
| Correlation clusters | 176 (3 anchor types) |
| Top cluster signals | 17 (confidence 75-100) |
| Forecast accuracy (HW vs naive) | 25% better MAPE |
| Test cases | 84 across 12 suites |
| Pipeline execution | ~1.5 seconds per cycle |
| Defence PDF | 147 pages, 200 KB |
| Diagrams | 23 (all rendered, white background) |
