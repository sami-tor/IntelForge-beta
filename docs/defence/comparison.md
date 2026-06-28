# IntelForge vs Commercial CTI Platforms

This is an honest comparison: where IntelForge competes well with commercial
threat-intelligence platforms, and where it deliberately doesn't try to.

## Capability Matrix

| Capability | IntelForge | Recorded Future | Mandiant Advantage | AlienVault OTX |
|------------|------------|-----------------|---------------------|----------------|
| Aggregated open-source feeds (CVE, KEV, exploits, ransomware leak sites) | ✅ 27 modules | ✅ | ✅ | ✅ |
| Composite global threat score | ✅ deterministic, 10-component formula | ✅ proprietary | ✅ proprietary | partial |
| Cross-source correlation clusters | ✅ literal CVE id + alias map + pg_trgm fuzzy | ✅ ML-driven | ✅ ML-driven | basic |
| 7-day forecasts with backtested accuracy | ✅ Holt + Holt-Winters + naive baseline, MAPE/RMSE/MAE per metric | not exposed | not exposed | ❌ |
| Z-score anomaly detection with caused_by attribution | ✅ 14-day window, severity tiers, source-row attribution | ✅ | ✅ | ❌ |
| Auto-generated, prioritised action queue | ✅ patch/hunt/block/review/drill, suggested-step playbooks | ✅ | ✅ | ❌ |
| Action collaboration (assignment, comments, audit log) | ✅ | ✅ | ✅ | ❌ |
| Geographic + sector risk index | ✅ rolling 30-day | ✅ | ✅ | partial |
| Daily executive briefing | ✅ deterministic + optional LLM rewrite | ✅ analyst-written | ✅ analyst-written | ❌ |
| PDF export of briefings | ✅ PDFKit, server-side | ✅ | ✅ | ❌ |
| Real-time push (Server-Sent Events) | ✅ Postgres LISTEN/NOTIFY | partial | partial | ❌ |
| Webhook fan-out to SIEM | ✅ HMAC-signed | ✅ | ✅ | ✅ |
| OpenAPI 3.1 spec + Swagger UI | ✅ | ✅ | ✅ | ✅ |
| Threat-hunting query builder | ✅ DSL → parameterised SQL, CSV export | ✅ proprietary query language | ✅ proprietary | basic |
| Self-hosted / data sovereignty | ✅ default | ❌ SaaS-only | ❌ SaaS-only | partial |
| Open-source proof-of-concept | ✅ | ❌ | ❌ | partial |
| ML-driven natural-language analyst | ⚠ optional via LLM provider | ✅ Recorded Future AI | ✅ Mandiant Hunter AI | ❌ |
| MITRE ATT&CK mapping | ✅ via existing `intel_mitre_*` cache | ✅ | ✅ | ✅ |
| Dark-web monitoring | ✅ | ✅ | ✅ | partial |
| Multi-tenant data isolation | ⚠ schema-ready (tenant_id columns), policy not yet enforced | ✅ | ✅ | ✅ |
| 24/7 analyst hot-line | ❌ | ✅ | ✅ | ❌ |
| Vendor-curated APT campaign attribution | ⚠ uses curated alias list, not new attribution research | ✅ | ✅ | partial |
| Pricing | self-host, free | $$$$ | $$$$ | free / paid tiers |

## Where IntelForge competes

1. **Empirical forecast accuracy.** Most CTI platforms display predictions
   without disclosing accuracy. IntelForge's `intel_forecast_accuracy`
   table backtests three methods every cycle and exposes MAPE/RMSE/MAE
   per metric (`/api/intel/automation/forecast-accuracy`). This is
   unusual transparency for the space.

2. **Survives upstream outages.** The dashboard is read entirely from
   the local cache. When NVD or CISA KEV is degraded, IntelForge keeps
   serving the most recent good data while the rest of the industry
   shows blank tiles.

3. **Self-hostable by a single developer.** A laptop with Docker can run
   the full stack. Recorded Future and Mandiant cannot.

4. **Code-traceable scoring.** Every component of the threat score is
   citable to a file:line in the codebase. Commercial platforms ship
   black-box composite scores.

5. **Open data model.** Eleven explicit Postgres tables with idempotent
   upsert keys. A SOC engineer can write their own queries against the
   same data the dashboard uses.

## Where IntelForge does NOT compete

1. **Vendor-curated threat-actor research.** Recorded Future and Mandiant
   employ analysts who write original attribution. IntelForge ingests
   public MITRE data only.

2. **Real-time human analyst on-call.** No phone number to dial. Pure
   software.

3. **Long-term trend ML at scale.** Holt-Winters works well for ≤ 14-day
   horizons. Commercial platforms use deeper ML for monthly/quarterly
   forecasting that IntelForge does not attempt.

4. **Custom data licensing partnerships.** Big vendors get private feeds
   from telemetry partners. IntelForge has only what is publicly
   available.

5. **Enterprise compliance certifications** (SOC 2, ISO 27001, FedRAMP).
   These take quarters of audit work; out of scope for an FYP.

## Honest takeaway for the committee

IntelForge is a **production-quality FYP demonstrator** of an automation
layer that genuinely belongs in a commercial CTI product. It is not a
turnkey replacement for a paid platform — and it doesn't claim to be.
What it does demonstrate is that the *automation surface* of a CTI tool
can be built clearly, transparently, and at FYP scope, while still
producing outputs (PDF briefings, SSE streams, webhook alerts, hunt
queries) that match what enterprise customers actually consume.
