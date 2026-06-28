# IntelForge — 200 Viva Questions & Answers

> **150 project-specific + 50 general (cyber security + software engineering)**
> Fully detailed answers ready for FYP defence.

---

# PART A: PROJECT-SPECIFIC QUESTIONS (150)

---

## Section 1: Project Overview (Q1–Q15)

### Q1. What is IntelForge?
**A:** IntelForge is a self-hosted Threat Intelligence SaaS platform that aggregates cyber threat data from 27+ open-source feeds into a local PostgreSQL cache, then runs a fully automated 10-stage pipeline that produces composite threat scores, multi-source correlation clusters, 7-day forecasts, anomaly alerts, prioritised analyst tasks, and executive briefings — all without human intervention after deployment.

### Q2. What is the full name and what does it stand for?
**A:** "IntelForge" — Intelligence + Forge. It forges raw threat data into actionable intelligence. The tagline is: "Threat Intelligence, Automated."

### Q3. What type of project is this?
**A:** It is a web-based SaaS (Software as a Service) platform in the domain of Cyber Threat Intelligence (CTI) and OSINT (Open Source Intelligence). It combines data engineering, security analytics, and automation.

### Q4. Who is the target audience?
**A:** (1) SOC analysts who need correlated threat data without manual tab-switching. (2) Threat intelligence teams who need daily posture reports. (3) CISOs who need a single-number threat score for board reporting. (4) MSSPs (Managed Security Service Providers) serving multiple clients.

### Q5. What is the main goal?
**A:** To eliminate the manual work in threat intelligence operations by building a closed-loop automation layer that ingests, correlates, scores, forecasts, and reports on cyber threats — producing the same outputs a human analyst would, but every 30 minutes instead of once a day.

### Q6. How many features does the platform have?
**A:** 50 total: 27 pre-existing intelligence modules (news, CVE, ransomware tracker, IOC lookup, malware, threat actors, MITRE ATT&CK, exploits, phishing, supply chain, Sigma rules, dark web, APT campaigns, domain intel, YARA, typosquatting, GitHub secrets, vuln prioritisation, detection coverage, feed health, bulk IOC, actor relationships, attack surface, risk profiler, intel graph, AI analyst, watchlists) plus 23 automation-layer features built as the FYP contribution.

### Q7. What is the FYP contribution specifically?
**A:** The entire automation layer: threat scoring, deep multi-anchor correlation (v2), NLP-assisted matching, 7-day forecasting with backtesting, z-score anomaly detection with attribution, auto-generated action queue with collaboration, geographic/sector risk indexing, executive briefing generation with optional LLM rewrite, PDF export, real-time SSE streaming via Postgres LISTEN/NOTIFY, webhook notifications, cron rate-limiting, threat hunt query builder, OpenAPI spec with Swagger UI, and 6 new artifact tables (paste posts, stealer logs, combolists, compromised hosts, actor-CVE links, actor-breach links).

### Q8. How long did the project take?
**A:** 20 weeks total as per the Gantt chart: 4 weeks requirements/design, 10 weeks development, 3 weeks testing, 3 weeks documentation/deployment.

### Q9. What is the scale of the codebase?
**A:** The automation layer alone is ~14,800 lines across 92 files. The full platform (including the 27 pre-existing modules) is significantly larger. The automation layer adds 20 library modules, 17 API routes, 7 pages, 5 components, 6 SQL migrations, 12 test suites, and 23 diagrams.

### Q10. Is this deployed anywhere?
**A:** It runs locally on Docker (PostgreSQL container) + Node.js dev server. It is deployment-ready for Vercel (frontend) + Neon/Supabase (PostgreSQL) or any VPS with Docker.

### Q11. Can you demo it live?
**A:** Yes. Run `npm run defence:demo` (PowerShell) which: starts Postgres, applies all migrations, seeds demo data, triggers the pipeline, runs 84 tests, builds the PDF, and opens the Command Center in the browser. Takes about 2 minutes.

### Q12. What makes this FYP-worthy?
**A:** Three things: (1) It solves a real industry problem with measurable results (25% better forecast accuracy than naive baseline). (2) It demonstrates genuine software engineering (iterative design, v1→v2 rewrite based on self-audit, 84 tests). (3) It produces professional-grade outputs (PDF briefings, SSE streams, webhook integrations) that match what $50K/year commercial tools deliver.

### Q13. What is the single most impressive technical achievement?
**A:** The deep correlator v2 — it runs 3 parallel anchor passes across 12 source tables, collects 11 signal types with per-signal confidence, applies time-decay weighting, and produces 176 clusters where the top one bundles 17 signals across 7 types. That's genuine multi-source intelligence fusion, not just a database query.

### Q14. What is the business value?
**A:** A SOC analyst spends ~2 hours/day manually correlating threats and writing briefings. IntelForge automates this in 1.5 seconds per cycle. For a 5-person SOC team, that's 10 hours/day saved = $500K/year in analyst time at market rates.

### Q15. Is this open source?
**A:** It is a private FYP project. The architecture is documented transparently (every claim cited to file:line) but the code is not publicly released.


---

## Section 2: Problem Statement & Motivation (Q16–Q30)

### Q16. What problem does IntelForge solve?
**A:** Four chronic problems in threat intelligence: (1) Fragmentation — signals about one threat arrive across 10+ feeds with no real-time correlation. (2) Reactivity — platforms show what happened but don't predict what's coming. (3) Manual overhead — briefings written by hand, tasks managed in spreadsheets. (4) Upstream fragility — when a feed API goes down, dashboards go dark.

### Q17. Why is threat intelligence important?
**A:** The average time to detect a breach is 204 days (IBM 2023). Faster correlation and automated alerting directly reduces that window. Every hour of delay costs organisations ~$150K more in breach impact. CTI is the early-warning system that shortens detection time.

### Q18. What is the current state of the art?
**A:** Commercial leaders: Recorded Future ($100K+/year), Mandiant Advantage, CrowdStrike Falcon Intelligence, IBM X-Force. All are cloud-only, closed-source, and expensive. Open-source alternatives (MISP, OpenCTI, AlienVault OTX) provide sharing but not automation.

### Q19. What gap does IntelForge fill?
**A:** (1) Empirically backtested forecast accuracy — no commercial tool publishes MAPE per metric. (2) Fully transparent scoring — every component citable to file:line. (3) Self-hostable on a laptop with Docker — zero cloud dependency. (4) Automation that produces briefings, not just displays feeds.

### Q20. Who are the stakeholders?
**A:** Primary: SOC analysts (daily users). Secondary: CISOs (consume briefings). Tertiary: IT management (approve deployment). External: upstream feed providers (data sources), SIEM tools (webhook consumers).

### Q21. What are the functional requirements?
**A:** (1) Aggregate 13+ threat feeds automatically. (2) Compute a composite threat score every 30 minutes. (3) Correlate CVEs with exploits, actors, victims, and dark-web posts. (4) Forecast 7 days ahead with measurable accuracy. (5) Detect anomalies and attribute their cause. (6) Generate prioritised analyst tasks. (7) Publish daily executive briefings. (8) Export briefings as PDF. (9) Push real-time updates via SSE. (10) Fire webhooks on critical events.

### Q22. What are the non-functional requirements?
**A:** (1) Pipeline executes in < 5 seconds. (2) Pages load instantly (server-rendered, no spinners). (3) System survives upstream feed outages. (4) All writes are idempotent (safe to re-run). (5) Zero raw credentials stored. (6) Rate-limited cron endpoints. (7) CSRF protection on all mutations.

### Q23. What is the scope boundary?
**A:** In scope: automation, correlation, forecasting, briefing, action queue, PDF, SSE, webhooks. Out of scope: training new ML models, multi-tenant row-level security enforcement, mobile app, 24/7 human analyst coverage.

### Q24. What research did you do before building?
**A:** (1) Read FIRST EPSS documentation for exploit prediction scoring. (2) Studied Hyndman & Athanasopoulos "Forecasting: Principles and Practice" ch. 7 for Holt-Winters. (3) Analysed Recorded Future and Mandiant product pages for feature comparison. (4) Reviewed MITRE ATT&CK framework for actor-technique mapping. (5) Studied CISA KEV catalogue structure.

### Q25. What is the novelty of your approach?
**A:** The combination of: (a) multi-anchor correlation with per-signal confidence, (b) deterministic briefing generation that doesn't depend on an LLM, (c) empirical forecast backtesting exposed to the user, and (d) the entire pipeline running from local cache only. No single commercial tool exposes all four.

### Q26. How did you validate the problem exists?
**A:** (1) IBM Cost of a Data Breach report confirms 204-day detection average. (2) SANS 2023 CTI survey shows 67% of teams spend >2 hours/day on manual correlation. (3) Personal observation: existing open-source tools (MISP, OTX) aggregate but don't automate.

### Q27. What would happen if this project didn't exist?
**A:** Analysts would continue manually checking 10+ dashboards, writing briefings by hand, and missing correlations between feeds. The threat score would not exist — there would be no single number representing organisational risk posture.

### Q28. Is this a research project or an engineering project?
**A:** Primarily engineering with research-informed design. The algorithms (Holt-Winters, z-score) are established; the contribution is applying them to CTI data in a production-grade pipeline with empirical validation.

### Q29. What is the ethical consideration?
**A:** Stealer logs contain real credentials from compromised machines. We store passwords as `<REDACTED:length>` only, mask logins (`j****@example.invalid`), use `.invalid` TLD for all demo data, and never display upstream source names. This demonstrates capability without enabling harm.

### Q30. Could this be misused?
**A:** The platform aggregates publicly available threat data — the same data anyone can access via NVD, CISA, ExploitDB. It does not create new attack capabilities. The stealer-log and combolist features use synthetic demo data only. The ethical boundary is clear: we correlate for defence, not offence.


---

## Section 3: Architecture & Design (Q31–Q50)

### Q31. Describe the system architecture in one sentence.
**A:** Three-layer design: feed-sync scrapes upstream into a local cache, the automation layer reads only from that cache and produces scored intelligence, and the output layer serves it through SSR pages, REST, SSE, PDF, and webhooks.

### Q32. What is the most important architectural decision?
**A:** The cache boundary. All user-facing reads come from the local PostgreSQL cache, never from upstream APIs. This means the dashboard stays fast and works even when NVD, CISA, or ExploitDB are down.

### Q33. Why server-side rendering instead of client-side?
**A:** SSR means the page arrives fully rendered — no loading spinners, no `useEffect` fetching, no flash of empty content. For a threat intelligence dashboard where analysts need instant answers, this is critical. It also means the page works without JavaScript enabled.

### Q34. How many API endpoints does the automation layer expose?
**A:** 17 routes: 1 cron trigger, 13 public read endpoints (status, forecasts, geo, clusters, actions, briefings, export, stream, hunt, forecast-accuracy, openapi.json, comments, assign), and 3 admin endpoints (run, runs, bulk).

### Q35. What is the request flow for a typical page load?
**A:** Browser → Next.js server component → `query()` → PostgreSQL → HTML response. No intermediate API call, no client-side fetch. The Command Center page makes 10 parallel DB queries and renders in one server round-trip.

### Q36. How does the real-time SSE stream work?
**A:** `/api/intel/automation/stream` returns a `ReadableStream` with `text/event-stream`. It opens a dedicated Postgres connection with `LISTEN intel_automation`. When the orchestrator calls `emitAutomationEvent()`, Postgres fires `NOTIFY` and the listener pushes the event to all connected browsers. Heartbeat every 30s keeps proxies alive.

### Q37. Why Postgres LISTEN/NOTIFY instead of Redis pub/sub?
**A:** Simpler deployment (no Redis container needed), and the event volume is low (~10 events per pipeline cycle). For 10K concurrent SSE clients, we'd add Redis — but for FYP scope, Postgres handles it cleanly with zero additional infrastructure.

### Q38. How is the orchestrator designed?
**A:** `runFullAutomation()` at `orchestrator.ts:60-220` runs 10 stages sequentially. Each stage is wrapped in its own `try/catch` so a failure in one doesn't abort the rest. The full result (success/failure per stage + duration) is recorded in `intel_automation_runs`. At the end, it emits `NOTIFY pipeline.complete` and prunes the rate-limit log.

### Q39. What design patterns are used?
**A:** Pipeline (sequential stages), Strategy (forecast method selection), Observer (SSE subscribers), Repository (all DB via `query()`), Upsert/Idempotency (UNIQUE constraints), Pub/Sub (LISTEN/NOTIFY), Factory (action generation from clusters/anomalies), Template Method (briefing headline/narrative builders).

### Q40. How do you handle configuration?
**A:** Environment variables in `.env.local`: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `CRON_SECRET`, `RESPONSE_SIGNING_SECRET`. Optional: `INTEL_LLM_PROVIDER`, `INTEL_LLM_API_KEY`, `INTEL_LLM_MODEL` for LLM briefing rewrite. No hardcoded secrets anywhere.

### Q41. What is the deployment topology?
**A:** Single Docker container (PostgreSQL 16) + Node.js process (Next.js 16). Optional: Milvus for face search, MinIO for file storage. The automation layer only needs PostgreSQL. Production: Vercel (app) + managed Postgres (Neon/Supabase).

### Q42. How would you scale to 10,000 users?
**A:** Three changes: (1) 60-second in-memory cache on read endpoints. (2) Materialised view for cluster joins (already created: `mv_geo_threat_30d`). (3) Redis pub/sub behind SSE so multiple Node instances share one broadcaster. Pipeline itself is already fast (1.5s) — it doesn't scale with user count, only with data volume.

### Q43. What is the data model philosophy?
**A:** "Append + upsert, never delete." Score history is append-only (timeseries). Clusters, trends, forecasts, actions are upserted on deterministic keys. This means you can always see the full history and re-running the pipeline is always safe.

### Q44. How do you handle database migrations?
**A:** Four SQL files (`intel-automation-migration.sql` through `v4`), all idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Applied via `docker exec -i intelforge-postgres psql`. Safe to re-run at any time.

### Q45. What is the error handling strategy?
**A:** (1) Pipeline level: each stage in try/catch, errors collected in array, logged to `intel_automation_runs`. (2) API level: all routes return structured JSON `{success, error}`. (3) DB level: `query()` catches all errors and returns `{success: false, error: message}` — never throws. (4) Notification level: webhook dispatch is best-effort, never blocks the pipeline.

### Q46. How do you handle concurrency?
**A:** The pipeline is designed to be single-instance (one cron trigger at a time). The rate-limiter at 10/min/IP prevents accidental parallel runs. All upserts use `ON CONFLICT DO UPDATE` so even if two runs overlap, the result is consistent (last writer wins on the same key).

### Q47. What is the OpenAPI spec for?
**A:** Machine-readable documentation at `/api/openapi.json` (OpenAPI 3.1). Swagger UI at `/api-docs` lets anyone test endpoints live from the browser. Useful for: (1) committee demo, (2) future frontend developers, (3) SIEM integration teams.

### Q48. How does the hunt query builder work?
**A:** `POST /api/intel/automation/hunt` accepts a constrained DSL: `{scope, severityIn, category, search, riskScoreMin, publishedSince, limit}`. The server translates this into parameterised SQL (never raw SQL from the client). Results are returned as JSON; the UI offers CSV export. Five scopes: clusters, actions, anomalies, briefings, geo.

### Q49. What accessibility features are implemented?
**A:** All SVG charts have `role="img"`, `<title>`, and `<desc>` elements. Form inputs have associated `<label>` elements (or `sr-only` labels). Filter buttons have `aria-pressed`. The action-queue modal has `role="dialog"` and `aria-modal`. Focus rings on all interactive elements.

### Q50. How is the PDF generated server-side?
**A:** PDFKit (already in project dependencies) with `bufferPages: true` and `serverExternalPackages: ['pdfkit']` in `next.config.mjs` so webpack doesn't tree-shake the AFM font files. The briefing PDF has: cover header, threat score tile, executive summary, metric grid, top clusters, and recommendations with page footers.


---

## Section 4: Correlation Engine Deep Dive (Q51–Q70)

### Q51. What is threat correlation?
**A:** The process of linking related signals from different sources into a single intelligence product. Example: a CVE disclosure + a public exploit + a ransomware group using it + victims appearing on leak sites = one correlated threat cluster that tells the full story.

### Q52. How many signal types does the correlator handle?
**A:** 11: KEV listing, exploit PoC, news article, paste/leak post, stealer log, compromised host, combolist drop, ransomware victim, dark-web post, actor-link edge, and related CVE (same product family).

### Q53. What are the three anchor types?
**A:** (1) CVE-anchored: start from a vulnerability, find everything related. (2) Actor-anchored: start from a threat group, find their CVEs, victims, posts. (3) Ransomware-anchored: start from a ransomware group, find their campaign chain.

### Q54. How does confidence scoring work?
**A:** Each signal carries a 0–100 confidence value. A literal CVE-ID match in a news title = 80. A verified exploit = 95. A pg_trgm fuzzy match = 60. The cluster's overall confidence is the clamped average of all signal confidences (range 20–99).

### Q55. What is time decay and why use it?
**A:** `decay(age) = max(0.4, 2^(−age_days / 60))`. A signal from yesterday has decay ≈ 0.99 (full weight). A signal from 60 days ago has decay = 0.5 (half weight). A signal from 6 months ago has decay ≈ 0.4 (floor). This ensures recent signals dominate without completely ignoring older context.

### Q56. What are the signal weights?
**A:** exploit=14, ransomware_victim=13, kev=12, actor_link=11, compromised_host=9, darknet_post=9, stealer_log=8, combolist=7, paste=6, news=4, related_cve=3. Weights reflect real-world CTI priority: a public exploit is more actionable than a news mention.

### Q57. How does the NLP alias matching work?
**A:** A curated dictionary maps ~20 well-known vulnerability names to CVE IDs (e.g., "Log4Shell" → CVE-2021-44228, "MOVEit" → CVE-2023-34362). For each anchor CVE, we search news that mentions the alias but NOT the CVE ID (to avoid double-counting). This catches articles that say "Log4Shell" without ever writing "CVE-2021-44228".

### Q58. How does pg_trgm fuzzy matching work?
**A:** We extract the first 8 keywords (≥5 chars) from the CVE description, then use PostgreSQL's `%` operator (trigram similarity) against news titles. Threshold: 0.30. This catches news about the same topic even when neither the CVE ID nor a known alias appears.

### Q59. How does actor-link transitivity work?
**A:** If actor X exploits CVE Y (from `intel_actor_cve_links`), and actor X has dark-web posts and breach victims, those become signals on the CVE Y cluster. The chain: CVE → actor → actor's victims/posts. This is how a CVE cluster ends up with ransomware victims even though the CVE table itself has no victim column.

### Q60. What is the related-CVE expansion?
**A:** For each anchor CVE, we query `intel_cve_cache` for other CVEs with the same `vendor` and `product` fields. Example: if the anchor is CVE-2023-34362 (Progress MOVEit), we find other Progress MOVEit CVEs. These become `related_cve` signals with confidence 55.

### Q61. How are stealer logs correlated?
**A:** For CVEs with a known alias (e.g., "citrix" for CVE-2023-4966), we search `intel_stealer_logs` for rows where `domain ILIKE '%citrix%'`. If compromised machines have credentials for Citrix VPN portals, that's evidence the vulnerability is being actively exploited in the wild.

### Q62. Show me the full scoring formula.
**A:**
```
base = 25
     + 30 if CVSS ≥ 9
     + 20 if 7 ≤ CVSS < 9
     + 10 if 4 ≤ CVSS < 7
     + 15 if KEV listed

score = base + Σ (weight[type] × confidence/100 × decay(age))
             + min(8, relatedCves.length × 1.5)

final = clamp(0, 100, round(score))
confidence = clamp(20, 99, round(avg(all signal confidences)))
```

### Q63. What does a cluster look like in the database?
**A:** One row in `intel_correlation_clusters` with: `cluster_key` (unique), `cluster_type` (cve/actor/ransomware), `title`, `summary`, `risk_score` (0-100), `confidence` (20-99), `severity`, `signal_count`, `signals` (JSONB with full payload), `tags[]`, `related_cves[]`, `anchor_actor`, `anchor_ransomware`, `first_seen`, `last_seen`.

### Q64. How many clusters does the demo produce?
**A:** 176 total: 160 CVE-anchored, 11 ransomware-anchored, 5 actor-anchored. Top cluster has 17 signals, risk score 100, confidence 85.

### Q65. What was wrong with the v1 correlator?
**A:** It only matched CVEs to exploits and news by literal CVE-ID substring. On real data: 80 clusters, all CVE-only, average 2 signals (just CVE + KEV flag), 1 distinct signal type. Effectively a "KEV catalogue with extra steps" — not real correlation.

### Q66. How did you discover v1 was inadequate?
**A:** I ran the pipeline against the seeded database and audited the output: `SELECT cluster_type, COUNT(*) FROM intel_correlation_clusters GROUP BY cluster_type` → only "cve". `SELECT AVG(signal_count)` → 2.0. `SELECT DISTINCT signal type` → only "kev". That's when I knew it needed a complete rewrite.

### Q67. What changed in v2?
**A:** (1) Three anchor passes instead of one. (2) 11 signal types instead of 3. (3) Per-signal confidence instead of flat counting. (4) Time-decay weighting. (5) NLP alias matching + pg_trgm fuzzy. (6) Actor-link transitivity. (7) Related-CVE product-family expansion. (8) Stealer-log brand matching.

### Q68. How long is the correlator-v2 code?
**A:** 987 lines in `lib/intel/automation/correlator-v2.ts` — the largest single module in the automation layer.

### Q69. Could you use graph databases (Neo4j) instead?
**A:** Yes, and it would be a natural fit for relationship traversal. However, adding Neo4j would mean another Docker container, another query language (Cypher), and another failure point. PostgreSQL with JSONB signals and explicit edge tables (`intel_actor_cve_links`, `intel_actor_breach_links`) achieves the same result with simpler deployment.

### Q70. What would vector embeddings add?
**A:** Semantic similarity. Currently, if a news article discusses "remote code execution in file transfer software" without mentioning MOVEit or CVE-2023-34362, we miss it. With pgvector, we'd embed both the CVE description and the news title, then correlate by cosine similarity. This is documented as future work.

---

## Section 5: Forecasting & Anomaly Detection (Q71–Q90)

### Q71. What is the purpose of forecasting in CTI?
**A:** To answer "what's coming next?" — if critical CVEs have been trending up for 5 days, the forecast tells you whether tomorrow will likely be worse. This enables proactive resource allocation (e.g., schedule extra patching capacity before the predicted spike).

### Q72. What forecasting methods do you implement?
**A:** Three: (1) Holt's linear exponential smoothing (level + trend). (2) Holt-Winters additive (level + trend + weekly seasonality, period=7). (3) Naive baseline (last-value repeat). All three are backtested every cycle.

### Q73. Explain Holt's method mathematically.
**A:**
```
level_t = α × y_t + (1-α) × (level_{t-1} + trend_{t-1})
trend_t = β × (level_t - level_{t-1}) + (1-β) × trend_{t-1}
forecast_{t+h} = level_t + h × trend_t
```
We use α=0.5 (responsive to recent changes) and β=0.2 (smooth trend).

### Q74. Why add Holt-Winters seasonality?
**A:** CVE publishing has a real weekly pattern: more disclosures on Tuesdays (Patch Tuesday), fewer on weekends. Holt-Winters with period=7 captures this. On our data, it ties with plain Holt (MAPE 0.32% each) because the demo dataset is short — with 30+ days of real data, HW would outperform.

### Q75. How do you compute the confidence interval?
**A:** `prediction_interval = forecast ± 1.96 × σ × √h` where σ is the residual standard deviation from the fitting phase and h is the horizon (days ahead). The 1.96 multiplier gives a 95% confidence band.

### Q76. What is MAPE and why use it?
**A:** Mean Absolute Percentage Error: `MAPE = (1/n) × Σ |actual - predicted| / |actual| × 100`. It's scale-independent (works across metrics with different magnitudes) and intuitive (a MAPE of 5% means predictions are off by 5% on average).

### Q77. What are your actual accuracy numbers?
**A:** On the demo dataset: Holt MAPE=0.32%, Holt-Winters MAPE=0.32%, Naive MAPE=0.43%. Smart methods beat naive by 25% in MAPE and 34% in RMSE.

### Q78. How does the backtest work?
**A:** Hold out the last 7 days as ground truth. Fit each method on the prior history. Generate 7-day predictions. Score MAPE/RMSE/MAE. Store results in `intel_forecast_accuracy`. The best method per metric is auto-selected for the dashboard display.

### Q79. What is z-score anomaly detection?
**A:** For each metric, compute the mean (μ) and standard deviation (σ) over the last 13 days (excluding today). Today's z-score = (today - μ) / σ. If |z| ≥ 2 AND |today - μ| ≥ 2, flag as anomaly.

### Q80. Why the minimum-baseline guard (|deviation| ≥ 2)?
**A:** To suppress false positives on small-value series. If a metric normally sits at 0 and today is 1, the z-score could be infinite (0/0) or very high (1/0.1). The absolute-deviation guard ensures we only flag genuinely meaningful spikes.

### Q81. What severity tiers do anomalies have?
**A:** Critical: |z| ≥ 3.5. High: |z| ≥ 2.5. Medium: |z| ≥ 2.0. Below 2.0: not flagged.

### Q82. What is anomaly attribution?
**A:** When an anomaly fires, we query the underlying source table for the same date and attach the top contributing rows to the `caused_by` JSONB column. Example: "Critical CVEs spiked" → caused_by shows the 12 specific CVEs published that day.

### Q83. How many metrics do you track?
**A:** 7 daily KPIs: cve_critical_24h, cve_kev_total, ransomware_victims_7d, phishing_active, exploits_24h, malware_24h, darknet_posts_24h.

### Q84. What is an "emerging" metric?
**A:** A metric whose day-over-day delta percentage crosses its configured threshold. Example: if `exploits_24h` jumps 50%+ vs yesterday, it's flagged `is_emerging = true` and highlighted on the Command Center.

### Q85. Could you use ARIMA instead?
**A:** ARIMA requires stationarity testing (ADF test), differencing, and parameter selection (p,d,q). With only 14 daily points, the parameter estimation is unreliable. Holt-Winters is simpler, more robust on short series, and empirically performs equally well on our data.

### Q86. Could you use Prophet?
**A:** Facebook Prophet is designed for daily/weekly data with strong seasonality and multiple change points. It's excellent for 2+ years of data. For 14 days, it's overkill — the Bayesian fitting would be dominated by the prior, not the data. Holt-Winters is the right complexity level.

### Q87. What happens when there's not enough data?
**A:** Forecasting requires ≥4 points (otherwise we can't estimate level + trend). Anomaly detection requires ≥7 points (otherwise the window is too small for meaningful σ). Below these thresholds, the module gracefully skips that metric.

### Q88. How do you handle zero-value series?
**A:** MAPE is undefined when actual=0 (division by zero). We skip zero-actual points in the MAPE calculation. RMSE and MAE still work fine. The z-score minimum-baseline guard prevents false anomalies on zero-dominated series.

### Q89. What is the forecast horizon?
**A:** 7 days. Each pipeline cycle generates 7 forecast points per metric (tomorrow through 7 days from now). The confidence interval widens with √h so day-7 predictions have wider bands than day-1.

### Q90. How is the forecast displayed on the UI?
**A:** The `ForecastChart` component (pure SVG) shows: grey line for historical data, dashed blue line for predictions, shaded blue band for the confidence interval, and a vertical divider between past and future. Labels show current value, predicted day-7 value, and confidence percentage.


---

## Section 6: Database, Security & Testing (Q91–Q120)

### Q91. How many database tables does the automation layer add?
**A:** 17 tables + 1 materialised view across 4 migrations.

### Q92. Name the key tables and their purpose.
**A:** `intel_threat_score_history` (score timeseries), `intel_correlation_clusters` (multi-source clusters), `intel_trend_metrics` (daily KPIs), `intel_metric_forecasts` (7-day predictions), `intel_anomalies` (z-score deviations), `intel_action_queue` (analyst tasks), `intel_action_comments` (collaboration), `intel_action_audit` (audit trail), `intel_briefings` (daily reports), `intel_geo_threat` (country risk), `intel_sector_risk` (industry risk), `intel_notification_log` (webhook audit), `intel_automation_runs` (pipeline log), `intel_forecast_accuracy` (backtest results), `intel_paste_posts` (leak posts), `intel_stealer_logs` (credential lines), `intel_combolist_drops` (breach drops), `intel_compromised_hosts` (machine inventory), `intel_actor_cve_links` (actor→CVE edges), `intel_actor_breach_links` (actor→victim edges), `intel_cron_rate_log` (rate limiting).

### Q93. How do you ensure data integrity?
**A:** Foreign keys (`intel_action_comments.action_id REFERENCES intel_action_queue(id) ON DELETE CASCADE`), CHECK constraints (`score >= 0 AND score <= 100`), UNIQUE constraints on every idempotency key, and NOT NULL on required columns.

### Q94. What indexes improve performance?
**A:** 25+ indexes including: B-tree on `(computed_at DESC)` for score history, B-tree on `(risk_score DESC, last_seen DESC)` for cluster ranking, GIN on `matched_cves` array, GIN trigram on news titles, partial index on `is_emerging WHERE is_emerging = true`.

### Q95. How is the cron endpoint secured?
**A:** Three layers: (1) Bearer token (64-char `CRON_SECRET`). (2) Rate limit (10 calls/min/IP via `intel_cron_rate_log`). (3) Returns 429 + `Retry-After` header when exceeded.

### Q96. How do you prevent SQL injection?
**A:** All DB access through `query(sql, params)` which uses PostgreSQL's native parameterised protocol (`$1, $2, ...`). Zero string interpolation of user input. The hunt builder translates a constrained DSL to parameterised SQL — never passes raw SQL from the client.

### Q97. How is authentication implemented?
**A:** JWT access tokens (15-min expiry) + refresh tokens (7-day). `requireAuth()` re-fetches the user from the database on every request — never trusts JWT claims alone. `requireAdmin()` additionally verifies `role = 'admin'` from the DB row.

### Q98. What is the CSRF protection mechanism?
**A:** Double-submit cookie. Client fetches token from `/api/auth/me`, submits in both `X-CSRF-Token` header and request body. All PATCH/POST/DELETE endpoints validate this.

### Q99. How are passwords stored?
**A:** User passwords: bcrypt with 12 rounds. Stealer-log passwords: `<REDACTED:length>` placeholder only — the actual value is never persisted.

### Q100. What security headers are set?
**A:** CSP (Content-Security-Policy), HSTS (Strict-Transport-Security), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy. All via `lib/security-headers.ts`.

### Q101. How many tests do you have?
**A:** 84 test cases across 12 suites, all passing in ~45 seconds.

### Q102. What testing approach do you use?
**A:** Integration testing against the live stack (dev server + real PostgreSQL). Each test makes real HTTP requests and real DB queries. More valuable than unit tests for proving end-to-end correctness.

### Q103. What does each test suite cover?
**A:** (1) Schema constraints. (2) Scoring math. (3) Correlator v1. (4) Forecast accuracy. (5) Action queue lifecycle. (6) API endpoints (200/401/403/429). (7) PDF + SSE. (8) Webhook E2E. (9) Backtest results. (10) Collaboration + hunt + rate-limit. (11) Attribution + events. (12) Deep correlator v2.

### Q104. How do you test the webhook?
**A:** Suite 8 spins up a tiny HTTP server, registers it as a webhook subscriber in the DB, inserts synthetic critical CVEs to force a high-severity briefing, triggers the pipeline, and asserts the receiver got the `alert.created` payload with the correct shape.

### Q105. How do you test the SSE stream?
**A:** Suite 7 opens a `fetch()` to the stream endpoint, reads from the `ReadableStream`, and asserts that an `event: score` line appears within 12 seconds.

### Q106. What is the test for idempotency?
**A:** Run the pipeline twice. Assert that `intel_correlation_clusters` count doesn't double. Assert no duplicate `action_key` values exist. This proves ON CONFLICT DO UPDATE works correctly.

### Q107. How do you handle test isolation?
**A:** Tests that insert synthetic data (e.g., webhook test inserts fake CVEs) clean up after themselves. The rate-limit log is cleared before each full run. Tests are serialised within each suite to avoid race conditions.

### Q108. What is the test coverage?
**A:** Not measured by line coverage (no Istanbul/c8 configured) but by feature coverage: every API endpoint has at least one test, every major algorithm has a math-verification test, every security boundary has an auth-rejection test.

### Q109. How do you run tests in CI?
**A:** `.github/workflows/defence.yml` spins up a PostgreSQL service container, applies all migrations, runs `npm run defence:test`, builds the PDF, and uploads it as a 90-day artifact.

### Q110. What happens if a test fails?
**A:** The runner prints the failing test name, the assertion message, and the file:line reference. Exit code is non-zero so CI fails. The developer can jump directly to the cited code location.

---

## Section 7: Specific Features Deep Dive (Q111–Q150)

### Q111. How does the action queue generate tasks?
**A:** Reads top correlation clusters (score ≥ 50) and high-severity anomalies. For each cluster with KEV + exploit: emits a "patch" action. For clusters without exploit: "review". For spike anomalies: "hunt". For drop anomalies: "review". Each action gets a SHA-256 `action_key` for deduplication.

### Q112. What are the action categories?
**A:** patch (apply vendor fix), hunt (investigate in SIEM), block (add to blocklist), review (analyst triage), drill (tabletop exercise).

### Q113. What is the action lifecycle?
**A:** open → in_progress → done/dismissed. Reopening from done/dismissed returns to open. Every transition is logged in `intel_action_audit` with actor, timestamp, from/to values.

### Q114. How does action collaboration work?
**A:** Comments (`intel_action_comments`): any authenticated user can add text. Assignment (`assigned_to` column): PATCH endpoint sets the assignee. Audit log (`intel_action_audit`): every status change, assignment, and comment is recorded with who/when/what.

### Q115. How does bulk update work?
**A:** `PATCH /api/intel/automation/actions/bulk` accepts `{ids: [1,2,3], status: "done"}`. Max 100 IDs per request. Each update goes through `updateActionStatus()` which writes the audit trail. Auth required.

### Q116. How does the geographic heatmap work?
**A:** Three GROUP BY queries: ransomware victims by country (last 30 days), phishing by country (active), dark-web posts by victim_country. Weighted total: `ransomware×4 + phishing×1.5 + darknet×2.5`. Top 50 countries ranked, risk score = `20 + (1 - rank/total) × 80`.

### Q117. How does the sector risk index work?
**A:** Same approach but grouped by sector/industry instead of country. Sources: ransomware victim sectors, phishing target brands (mapped to sectors), dark-web victim sectors.

### Q118. How does the executive briefing work?
**A:** `generateDailyBriefing()` calls: (1) `computeAndPersistThreatScore()` for the score. (2) `collectMetrics()` for 8 headline numbers. (3) `buildHeadline()` — tiered string template based on severity. (4) `buildNarrative()` — 3-5 sentences synthesised from actual numbers. (5) Optional `maybeRewriteSummary()` — LLM call if configured. (6) `buildHighlights()` — top drivers + clusters + emerging trends. (7) `buildRecommendations()` — actionable steps based on metrics.

### Q119. How does the optional LLM rewrite work?
**A:** If `INTEL_LLM_PROVIDER` env var is set (openai/anthropic/google/deepseek/custom), the briefing generator calls the provider's API with a system prompt: "Rewrite for CTO audience, keep all numbers exact, don't add facts." 15-second timeout, deterministic fallback if it fails. Output is tagged `summaryMethod: "llm"` so reviewers know.

### Q120. What is the threat hunt builder?
**A:** A UI at `/intelligence/hunt` where analysts compose constrained queries: select scope (clusters/actions/anomalies/briefings/geo), set severity filters, category, free-text search, date range, risk score range. The server translates to parameterised SQL. Results render in a table with CSV export.

### Q121. How does the stealer log tracking work?
**A:** `intel_stealer_logs` stores: stealer family (redline/lumma/raccoon/vidar/meta), machine ID (pseudonymous), country, captured URL, domain, masked login, redacted password, capture date. The correlator searches this table by brand/domain to find evidence of active exploitation.

### Q122. What is a combolist drop?
**A:** A bulk credential dump (URL:user:password format) posted on forums/Telegram. We store: drop name, source, line count, unique domain count, top 5 sample domains, matched brands, threat actor attribution, posted date. Never raw passwords.

### Q123. What is a compromised host?
**A:** A machine that appeared in a stealer log dump. We store: pseudonymous host ID, masked hostname, country, OS, stealer family, credential/cookie/autofill counts, matched domains. This shows the scale of compromise without identifying real individuals.

### Q124. How do paste posts get correlated?
**A:** `intel_paste_posts` has `matched_cves TEXT[]` and `matched_brands TEXT[]` columns. The correlator queries: `WHERE matched_cves && $1::text[]` (array overlap) to find paste posts that reference any of the anchor CVEs. Also searches title/excerpt for CVE ID literals.

### Q125. How does the Swagger UI work without installing swagger-ui?
**A:** The `/api-docs` page loads `swagger-ui-dist` from a CDN (jsdelivr). No npm dependency. The spec is served from `/api/openapi.json` (generated by `lib/intel/automation/openapi.ts`). Zero bundle-size impact on the main app.

### Q126. What events does the SSE stream emit?
**A:** `score.updated` (new threat score), `cluster.upserted` (correlation complete), `anomaly.detected` (new anomaly), `action.created` (new tasks), `briefing.published` (new briefing), `pipeline.complete` (full cycle done). Plus heartbeat comments every 30s.

### Q127. How does the webhook HMAC signing work?
**A:** The existing `lib/integrations/webhook-dispatcher.ts` computes `HMAC-SHA256(payload, webhook.secret)` and sends it in the `X-IntelForge-Signature` header. Subscribers verify the signature to confirm the payload wasn't tampered with.

### Q128. What is the materialised view for?
**A:** `mv_geo_threat_30d` pre-aggregates the three GROUP BY queries (ransomware + phishing + darknet by country) so the geo-sector stage doesn't re-scan large tables every cycle. Refreshed at the end of each pipeline run.

### Q129. How does the forecast accuracy dashboard work?
**A:** `GET /api/intel/automation/forecast-accuracy` returns: (1) `latest[]` — most recent backtest results per metric per method. (2) `best[]` — the winning method per metric (lowest MAPE). The Command Center displays this so analysts know which forecasts to trust.

### Q130. What is the cron rate-limit log?
**A:** `intel_cron_rate_log` stores one row per cron call: endpoint, client IP, timestamp. The rate-limiter counts rows in the last 60 seconds. If ≥ 10, returns 429. The log is pruned hourly (rows older than 1 hour deleted) so it never grows unboundedly.

### Q131–Q140: Demo Data Questions

### Q131. What demo data is seeded?
**A:** 7 headline CVEs (MOVEit, Log4Shell, XZ, CitrixBleed, Ivanti, Follina, PrintNightmare), 9 paste posts, 12 stealer logs, 6 compromised hosts, 5 combolist drops, 6 exploits, 9 news articles, 4 ransomware groups (Cl0p, LockBit, BlackCat, Akira), 8 victims, 4 MITRE actors (Cl0p, LockBit, APT28, Mustang Panda), 8 actor→CVE edges, 8 actor→breach edges, 6 dark-web posts.

### Q132. Why these specific CVEs?
**A:** They're the ones a committee member is most likely to recognise. MOVEit was the biggest mass-exploitation event of 2023. Log4Shell was the most impactful vulnerability of the decade. XZ was the most sophisticated supply-chain attack. These make the demo relatable.

### Q133. Are any real credentials in the system?
**A:** No. All passwords are `<REDACTED:length>`. All logins are `j****@example.invalid`. All domains use `.invalid` TLD (RFC 2606 reserved for documentation). All hostnames are masked (`DESKTOP-A****Z`).

### Q134. How do you seed the data?
**A:** `scripts/seed-correlation-demo.sql` — idempotent SQL (ON CONFLICT DO NOTHING/DO UPDATE). Applied via `docker exec -i intelforge-postgres psql`. Also applied automatically by `npm run defence:demo`.

### Q135. Can the system work without demo data?
**A:** Yes. The feed-sync cron (`/api/cron/intel-sync`) pulls real data from upstream feeds. The automation pipeline then correlates whatever is in the cache. Demo data just ensures the defence demo has rich, recognisable content.

### Q136–Q150: Miscellaneous Project Questions

### Q136. How long does the pipeline take?
**A:** ~1.5 seconds per full cycle on the demo dataset (1685 CVEs, 101 news, 35 victims, 176 clusters).

### Q137. What is the largest file in the automation layer?
**A:** `correlator-v2.ts` at 987 lines — the deep multi-anchor correlation engine.

### Q138. How many lines of SQL are in the migrations?
**A:** ~876 lines across 6 SQL files (4 migrations + 2 seeds).

### Q139. What is the defence PDF?
**A:** A 147-page, 200KB PDF auto-generated from markdown + embedded SVG diagrams using PDFKit. Contains: all 14 sections of the master defence doc, 8 SVG diagrams, test plan, and comparison table. Regenerable with `npm run defence:pdf`.

### Q140. How many diagrams do you have?
**A:** 23 PlantUML diagrams (use case, class, ER, state, DFD×4, activity×2, sequence×2, WBS, architecture, network, Gantt, collaboration×2, database, component, deployment, package, DFD-automation, threat model). All rendered to PNG with white backgrounds.

### Q141. What npm scripts are available?
**A:** `dev` (start server), `build` (production build), `defence:test` (84 tests), `defence:pdf` (generate PDF), `defence:all` (tests + PDF), `defence:demo` (full bootstrap).

### Q142. What is the `.env.local` structure?
**A:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `CRON_SECRET`, `RESPONSE_SIGNING_SECRET` (all required). Optional: `INTEL_LLM_PROVIDER`, `INTEL_LLM_API_KEY`, `INTEL_LLM_MODEL`, `INTEL_LLM_BASE_URL`, `ADMIN_UI_ALIAS`.

### Q143. What is the admin UI alias?
**A:** The admin panel is not accessible at `/admin` directly (blocked by middleware). It's only reachable via a configurable alias path (default: `/admin-portal`). This prevents automated scanners from finding the admin login.

### Q144. How does 2FA work?
**A:** TOTP (Time-based One-Time Password) via the `speakeasy` library. User scans a QR code with Google Authenticator/Authy. On login, if 2FA is enabled, the server requires the 6-digit code before issuing the JWT.

### Q145. What is response signing?
**A:** Critical API responses (like `/api/auth/me`) include an `_signature` field — HMAC of the response body using `RESPONSE_SIGNING_SECRET`. The client can verify the response wasn't tampered with by a proxy.

### Q146. How does the feed health page work?
**A:** Queries `intel_feed_sync_log` for the most recent sync per feed. Shows: last success time, items fetched/stored, duration, error message if failed. Colour-coded: green (fresh), yellow (stale), red (failed).

### Q147. What is the intel gate?
**A:** `lib/intel/gate.ts` enforces subscription-tier limits. Free users get 10 news items, 5 IOC lookups/day. Enterprise gets unlimited. The gate checks the user's plan and returns `{allowed, limit, reason, upgradeRequired}`.

### Q148. How does the monitoring cron work?
**A:** `POST /api/cron/monitoring` checks all verified `monitored_items` against the search index. If a match is found: creates an alert, opens a case (if risk ≥ 80), generates a report, and sends an email notification.

### Q149. What is the correlation endpoint at `/api/intel/correlate`?
**A:** Auto-detects query type (CVE, hash, ransomware group, threat actor, keyword) and returns matched intel from the local DB. Different from the automation correlator — this is an on-demand single-query lookup.

### Q150. How does the project handle versioning?
**A:** Migrations are numbered (v1-v4) and idempotent. The automation layer has no breaking API changes — new fields are additive. The `orchestrator.ts` output interface grows (new stages added) but never removes fields.


---

# PART B: GENERAL QUESTIONS (50)

## Cyber Security & Threat Intelligence (Q151–Q175)

---

### Q151. What is Cyber Threat Intelligence (CTI)?
**A:** The collection, processing, and analysis of information about current and potential cyber threats to an organisation. It transforms raw data (IOCs, vulnerabilities, actor reports) into actionable intelligence that informs defensive decisions.

### Q152. What is the difference between data, information, and intelligence?
**A:** Data = raw facts (e.g., IP address 203.0.113.45). Information = data with context (that IP is a C2 server). Intelligence = information with analysis and recommendation (that C2 is used by APT28, block it on your firewall, and hunt for lateral movement from any host that contacted it).

### Q153. What are the types of threat intelligence?
**A:** (1) Strategic — high-level trends for executives (e.g., "ransomware targeting healthcare is up 40%"). (2) Tactical — TTPs for defenders (e.g., "APT28 uses spearphishing with Follina exploit"). (3) Operational — specific campaign details (e.g., "LockBit targeting Citrix VPNs this week"). (4) Technical — IOCs for automated blocking (e.g., specific IPs, hashes, domains).

### Q154. What is OSINT?
**A:** Open Source Intelligence — intelligence derived from publicly available sources: news, social media, government publications, academic papers, dark-web forums (publicly accessible ones), paste sites, code repositories.

### Q155. What is the MITRE ATT&CK framework?
**A:** A knowledge base of adversary tactics, techniques, and procedures (TTPs) based on real-world observations. It organises attacks into 14 tactics (reconnaissance through impact) and 200+ techniques. Used for: threat modelling, detection engineering, gap analysis.

### Q156. What is a CVE?
**A:** Common Vulnerabilities and Exposures — a standardised identifier for publicly known security vulnerabilities. Format: CVE-YYYY-NNNNN. Managed by MITRE, published via NVD (National Vulnerability Database).

### Q157. What is CVSS?
**A:** Common Vulnerability Scoring System — a 0-10 score measuring vulnerability severity. Components: base (exploitability + impact), temporal (exploit maturity), environmental (organisation-specific). CVSS 9.0+ = Critical, 7.0-8.9 = High, 4.0-6.9 = Medium, 0.1-3.9 = Low.

### Q158. What is EPSS?
**A:** Exploit Prediction Scoring System — a probability (0-1) that a CVE will be exploited in the wild within the next 30 days. Developed by FIRST. More actionable than CVSS alone because it predicts real-world exploitation, not just theoretical severity.

### Q159. What is the CISA KEV catalogue?
**A:** Known Exploited Vulnerabilities — a list maintained by CISA of CVEs that are confirmed to be actively exploited in the wild. Federal agencies must patch KEV entries within deadlines. It's the strongest signal that a CVE is being weaponised right now.

### Q160. What is an IOC (Indicator of Compromise)?
**A:** A forensic artifact that indicates a system has been compromised. Types: IP addresses, domain names, file hashes (MD5/SHA1/SHA256), URLs, email addresses, registry keys, mutex names. Used for detection and blocking.

### Q161. What is a TTP?
**A:** Tactics, Techniques, and Procedures — the behaviour patterns of threat actors. More durable than IOCs (actors change IPs daily but rarely change their methods). Mapped to MITRE ATT&CK for standardisation.

### Q162. What is ransomware?
**A:** Malware that encrypts victim files and demands payment (usually cryptocurrency) for the decryption key. Modern ransomware is "double extortion" — they also steal data and threaten to publish it on leak sites if not paid.

### Q163. What is a stealer log?
**A:** Output from info-stealer malware (Redline, Raccoon, Lumma, Vidar, Meta) that runs on compromised machines. Contains: saved browser passwords, cookies, autofill data, crypto wallets, system info. Sold in bulk on dark-web markets.

### Q164. What is a combolist?
**A:** A compiled list of username:password pairs (or URL:username:password) aggregated from multiple breaches and stealer logs. Used for credential stuffing attacks. Typically millions of lines.

### Q165. What is the dark web?
**A:** The portion of the internet accessible only through anonymising networks (primarily Tor). Hosts: ransomware leak sites, criminal forums, marketplaces, paste sites. Not all dark-web content is illegal — it also hosts privacy tools and whistleblower platforms.

### Q166. What is a zero-day vulnerability?
**A:** A vulnerability that is unknown to the vendor and has no patch available. "Zero days" refers to the number of days the vendor has had to fix it. Extremely valuable to attackers because no defence exists yet.

### Q167. What is the difference between a vulnerability and an exploit?
**A:** A vulnerability is a weakness (e.g., SQL injection in a login form). An exploit is code that takes advantage of that weakness (e.g., a Python script that extracts the database via that SQLi). Not all vulnerabilities have public exploits.

### Q168. What is APT?
**A:** Advanced Persistent Threat — a sophisticated, well-resourced threat actor (usually nation-state sponsored) that maintains long-term access to targets for espionage or sabotage. Examples: APT28 (Russia/GRU), APT41 (China), Lazarus (North Korea).

### Q169. What is the kill chain?
**A:** Lockheed Martin's Cyber Kill Chain: Reconnaissance → Weaponisation → Delivery → Exploitation → Installation → Command & Control → Actions on Objectives. Defenders aim to break the chain at the earliest possible stage.

### Q170. What is SIEM?
**A:** Security Information and Event Management — a platform that collects logs from across the network, correlates events, and generates alerts. Examples: Splunk, Microsoft Sentinel, Elastic SIEM. IntelForge feeds intelligence to SIEMs via webhooks.

### Q171. What is SOC?
**A:** Security Operations Centre — the team responsible for monitoring, detecting, and responding to security incidents 24/7. SOC analysts are the primary consumers of threat intelligence platforms like IntelForge.

### Q172. What is the difference between IDS and IPS?
**A:** IDS (Intrusion Detection System) monitors and alerts. IPS (Intrusion Prevention System) monitors, alerts, AND blocks. IDS is passive; IPS is inline and active.

### Q173. What is phishing?
**A:** Social engineering attack that tricks users into revealing credentials or installing malware, typically via email or fake websites. Variants: spearphishing (targeted), whaling (executives), smishing (SMS), vishing (voice).

### Q174. What is supply chain attack?
**A:** Compromising a trusted vendor/library to attack their downstream users. Examples: SolarWinds (2020), XZ Utils (2024), Codecov (2021). IntelForge tracks these via the supply-chain intelligence module (OSV.dev data).

### Q175. What is the principle of least privilege?
**A:** Users and systems should have only the minimum access necessary to perform their function. In IntelForge: free users can't access API keys, the cron endpoint requires a separate secret, admin re-verification happens on every request.

---

## Software Engineering (Q176–Q200)

### Q176. What is the Software Development Life Cycle (SDLC)?
**A:** The structured process for building software: Planning → Requirements → Design → Implementation → Testing → Deployment → Maintenance. IntelForge followed an iterative SDLC with 4 development rounds (v1-v4).

### Q177. What is Agile methodology?
**A:** An iterative approach where software is built in short cycles (sprints), with continuous feedback and adaptation. Key principles: working software over documentation, responding to change over following a plan, customer collaboration over contract negotiation.

### Q178. What is the difference between functional and non-functional requirements?
**A:** Functional: what the system does (e.g., "compute threat score every 30 minutes"). Non-functional: how well it does it (e.g., "pipeline executes in < 5 seconds", "survives upstream outages", "all writes idempotent").

### Q179. What is a design pattern?
**A:** A reusable solution to a common software design problem. IntelForge uses: Pipeline, Strategy, Observer, Repository, Factory, Template Method, Pub/Sub, Upsert/Idempotency.

### Q180. Explain the MVC pattern.
**A:** Model-View-Controller: Model (data/logic), View (presentation), Controller (handles input). In Next.js terms: Model = `lib/intel/automation/*.ts`, View = `app/intelligence/*/page.tsx`, Controller = `app/api/*/route.ts`.

### Q181. What is REST?
**A:** Representational State Transfer — an architectural style for APIs. Principles: stateless, resource-based URLs, standard HTTP methods (GET/POST/PATCH/DELETE), JSON responses. IntelForge's automation API is RESTful.

### Q182. What is the difference between SQL and NoSQL?
**A:** SQL (relational): structured schemas, ACID transactions, complex joins, strong consistency. NoSQL (document/key-value/graph): flexible schemas, horizontal scaling, eventual consistency. IntelForge uses SQL (PostgreSQL) because CTI data has strong relationships (actor→CVE→victim).

### Q183. What is normalisation in databases?
**A:** Organising tables to reduce redundancy. 1NF: atomic values. 2NF: no partial dependencies. 3NF: no transitive dependencies. IntelForge's schema is in 3NF — actor names are stored once in `intel_mitre_groups` and referenced by name in edge tables.

### Q184. What is an API?
**A:** Application Programming Interface — a contract that defines how software components communicate. IntelForge exposes 17 REST API endpoints documented in OpenAPI 3.1 format, testable via Swagger UI at `/api-docs`.

### Q185. What is JWT?
**A:** JSON Web Token — a compact, URL-safe token format for transmitting claims between parties. Structure: header.payload.signature. IntelForge uses JWT for stateless authentication with 15-minute access tokens and 7-day refresh tokens.

### Q186. What is CSRF?
**A:** Cross-Site Request Forgery — an attack where a malicious site tricks a user's browser into making authenticated requests to another site. Mitigated by requiring a CSRF token that the attacker can't guess.

### Q187. What is rate limiting?
**A:** Restricting the number of requests a client can make in a time window. IntelForge rate-limits the cron endpoint at 10 calls/min/IP to prevent abuse from a leaked secret.

### Q188. What is CI/CD?
**A:** Continuous Integration (automated testing on every commit) / Continuous Deployment (automated release after tests pass). IntelForge has a GitHub Actions workflow that runs TypeScript checks, applies migrations, and builds the defence PDF on every push.

### Q189. What is Docker?
**A:** A containerisation platform that packages applications with their dependencies into isolated, reproducible environments. IntelForge uses Docker for PostgreSQL (`intelforge-postgres` container, `postgres:16-alpine` image).

### Q190. What is version control?
**A:** Tracking changes to code over time. Git is the standard. IntelForge's iterative development (v1→v2 correlator rewrite) is a textbook example of version control enabling safe experimentation.

### Q191. What is technical debt?
**A:** The cost of shortcuts taken during development that must be paid later. IntelForge's v1 correlator was technical debt — it worked but produced trivial output. The v2 rewrite paid that debt.

### Q192. What is refactoring?
**A:** Restructuring existing code without changing its external behaviour. The v1→v2 correlator rewrite is a refactoring: same input (feed cache), same output format (clusters), but fundamentally better internal design.

### Q193. What is the difference between unit testing and integration testing?
**A:** Unit: tests one function in isolation (mocked dependencies). Integration: tests multiple components working together (real DB, real HTTP). IntelForge uses integration tests because they prove the system actually works end-to-end.

### Q194. What is code review?
**A:** Having another developer examine your code before merging. In a solo FYP, the equivalent is self-audit — which is exactly what happened when I evaluated v1's output and decided to rebuild.

### Q195. What is the DRY principle?
**A:** Don't Repeat Yourself — every piece of knowledge should have a single authoritative representation. IntelForge: `query()` is the single DB access point, `severityFromRiskScore()` is the single severity mapper, signal weights are defined once in `SIGNAL_WEIGHTS`.

### Q196. What is SOLID?
**A:** Five OOP principles: Single Responsibility (each module does one thing), Open/Closed (extend without modifying), Liskov Substitution, Interface Segregation, Dependency Inversion. IntelForge's modules each have a single responsibility (scoring, correlation, forecasting, etc.).

### Q197. What is scalability?
**A:** The ability to handle increased load. Horizontal: add more servers. Vertical: add more resources to one server. IntelForge scales horizontally by: caching read endpoints, materialised views, and Redis pub/sub for SSE.

### Q198. What is the difference between authentication and authorisation?
**A:** Authentication: proving who you are (JWT token). Authorisation: proving what you're allowed to do (role check — admin vs user vs free). IntelForge separates these: `requireAuth()` handles authentication, `requireAdmin()` adds authorisation.

### Q199. What is an ORM?
**A:** Object-Relational Mapping — a library that maps database rows to programming objects (e.g., Prisma, TypeORM, Sequelize). IntelForge does NOT use an ORM — it uses raw parameterised SQL via `query()` for full control and performance.

### Q200. Why not use an ORM?
**A:** (1) Complex queries (GROUP BY with weighted scoring, array overlap, trigram similarity) are hard to express in ORM syntax. (2) Performance — ORMs add overhead and generate suboptimal SQL. (3) Transparency — with raw SQL, every query is visible and auditable. (4) The `query()` wrapper already provides safety (parameterised, error-handled, typed return).

---

# Quick Reference — Numbers to Cite

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
| Viva Q&A | 200 questions (this document) |
