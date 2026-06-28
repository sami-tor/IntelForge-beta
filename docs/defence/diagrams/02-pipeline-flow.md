# Diagram 2 — Automation Pipeline Sequence

End-to-end sequence inside one cron cycle (`runFullAutomation` —
`lib/intel/automation/orchestrator.ts:60-179`).

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron caller
    participant API as /api/cron/automation
    participant ORC as orchestrator.runFullAutomation
    participant SCORE as threat-score
    participant CORR as correlator
    participant TRD as trends
    participant FCT as forecast
    participant GEO as geo-sector
    participant ACT as action-queue
    participant BRIEF as briefing-generator
    participant NOTIF as notifications
    participant DB as Postgres
    participant HOOK as Webhook subscribers

    Cron->>API: POST (Bearer CRON_SECRET)
    API->>API: isAuthorized() route.ts:17-23
    API->>ORC: runFullAutomation()
    ORC->>DB: INSERT intel_automation_runs (running)

    rect rgb(232, 243, 255)
    note over ORC,SCORE: Stage 1: Threat Score
    ORC->>SCORE: computeAndPersistThreatScore()
    SCORE->>DB: parallel COUNT(*) ×10 (cached feeds)
    SCORE->>DB: INSERT intel_threat_score_history
    SCORE-->>ORC: {score, severity, delta24h, drivers}
    end

    rect rgb(232, 243, 255)
    note over ORC,CORR: Stage 2: Correlation
    ORC->>CORR: runCorrelationPass()
    CORR->>DB: SELECT 80 anchor CVEs
    CORR->>DB: parallel SELECT exploits, news per CVE
    loop for each correlated CVE
        CORR->>DB: UPSERT intel_correlation_clusters
    end
    CORR-->>ORC: {scanned, persisted}
    end

    rect rgb(232, 243, 255)
    note over ORC,TRD: Stage 3: Trends
    ORC->>TRD: captureTrends()
    loop for 7 metrics
        TRD->>DB: SELECT today value
        TRD->>DB: SELECT previous bucket
        TRD->>DB: UPSERT intel_trend_metrics (+ emerging flag)
    end
    TRD-->>ORC: {captured, emergingCount}
    end

    rect rgb(232, 243, 255)
    note over ORC,FCT: Stage 4: Forecast and Anomaly
    ORC->>FCT: generateForecastsAndAnomalies(7)
    FCT->>DB: SELECT 30-day history
    loop for each metric (≥4 points)
        FCT->>FCT: holt(values, 0.5, 0.2)
        loop h=1..7
            FCT->>DB: UPSERT intel_metric_forecasts
        end
    end
    loop for each metric (≥7 points)
        FCT->>FCT: z-score over 13-day window
        alt |z| ≥ 2 and |y - μ| ≥ 2
            FCT->>DB: UPSERT intel_anomalies
        end
    end
    FCT-->>ORC: {generated, anomalies}
    end

    rect rgb(232, 243, 255)
    note over ORC,GEO: Stage 5: Geo and Sector
    ORC->>GEO: captureGeoAndSector()
    GEO->>DB: GROUP BY country (×3 sources)
    GEO->>DB: GROUP BY sector (×3 sources)
    GEO->>DB: UPSERT intel_geo_threat (top 50)
    GEO->>DB: UPSERT intel_sector_risk (top 25)
    GEO-->>ORC: {countries, sectors}
    end

    rect rgb(232, 243, 255)
    note over ORC,ACT: Stage 6: Action Queue
    ORC->>ACT: generateActions()
    ACT->>DB: SELECT top clusters + recent anomalies
    loop for each (score≥50 cluster) and (high anomaly)
        ACT->>DB: UPSERT intel_action_queue (sha256 key)
    end
    ACT-->>ORC: {created, total}
    end

    rect rgb(232, 243, 255)
    note over ORC,BRIEF: Stage 7: Briefing
    ORC->>BRIEF: generateDailyBriefing()
    BRIEF->>DB: re-pull metrics + clusters + trends
    BRIEF->>BRIEF: buildHeadline()
    BRIEF->>BRIEF: buildNarrative()
    BRIEF->>BRIEF: buildHighlights() and buildRecommendations()
    BRIEF->>DB: UPSERT intel_briefings (today bucket)
    BRIEF-->>ORC: {headline, threatLevel, threatScore}
    end

    rect rgb(255, 232, 232)
    note over ORC,NOTIF: Stage 8: Notifications (best-effort)
    ORC->>NOTIF: notifyBriefing(briefing)
    alt threatLevel ∈ {high, critical}
        NOTIF->>HOOK: dispatchWebhookEvent("alert.created")
        NOTIF->>DB: INSERT intel_notification_log
    end
    ORC->>NOTIF: notifyAnomalies(...)
    ORC->>NOTIF: notifyCriticalClusters(...)
    end

    ORC->>DB: UPDATE intel_automation_runs (success/failed)
    ORC-->>API: AutomationRunOutput
    API-->>Cron: 200 OK with full payload
```

## Plain-text fallback

```
Cron POST /api/cron/automation
   │
   ▼
isAuthorized()  ─┐
                 ├── 401 if CRON_SECRET mismatch (production)
                 └── proceed otherwise
   │
   ▼
runFullAutomation()  → log run start
   │
   ├──[1]── threat-score   → INSERT history snapshot
   │
   ├──[2]── correlator     → UPSERT clusters (idempotent on cluster_key)
   │
   ├──[3]── trends         → UPSERT trend buckets (idempotent on (key, date))
   │
   ├──[4]── forecast       → UPSERT forecasts + anomalies
   │
   ├──[5]── geo-sector     → UPSERT geo / sector rows
   │
   ├──[6]── action-queue   → UPSERT actions (idempotent on action_key)
   │
   ├──[7]── briefing       → UPSERT today's briefing row
   │
   └──[8]── notifications  → fire webhooks (best-effort, never blocks)

→ log run end (success / failed) + duration_ms + output payload
→ return JSON to caller
```
