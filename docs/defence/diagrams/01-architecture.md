# Diagram 1 — System Architecture

Layered view of IntelForge with the new automation layer highlighted.

```mermaid
graph TB
    subgraph EXT["External Threat Feeds (read-only)"]
        F1[NVD CVE feed]
        F2[CISA KEV catalogue]
        F3[ExploitDB]
        F4[Ransomware leak sites]
        F5[Phishing intel]
        F6[Dark-web forums]
        F7[MITRE ATT&CK]
        F8[News RSS]
    end

    subgraph SYNC["Feed-sync Layer (existing)"]
        FETCHERS["lib/intel/fetchers/*.ts"]
        SYNCCRON["app/api/cron/intel-sync/route.ts"]
    end

    subgraph CACHE["Postgres Feed Cache (existing)"]
        T1[("intel_cve_cache")]
        T2[("intel_news_cache")]
        T3[("intel_ransomware_*")]
        T4[("intel_exploit_cache")]
        T5[("intel_phishing_cache")]
        T6[("intel_darknet_posts")]
    end

    subgraph AUTO["Automation Layer (NEW)"]
        SCORE["threat-score.ts"]
        CORR["correlator.ts"]
        TRD["trends.ts"]
        FCT["forecast.ts"]
        GEO["geo-sector.ts"]
        ACT["action-queue.ts"]
        BRIEF["briefing-generator.ts"]
        NOTIF["notifications.ts"]
        ORC["orchestrator.ts"]
    end

    subgraph AUTOTABLES["Postgres Automation Tables (NEW)"]
        A1[("intel_threat_score_history")]
        A2[("intel_correlation_clusters")]
        A3[("intel_trend_metrics")]
        A4[("intel_metric_forecasts")]
        A5[("intel_anomalies")]
        A6[("intel_geo_threat / sector_risk")]
        A7[("intel_action_queue")]
        A8[("intel_briefings")]
        A9[("intel_automation_runs")]
    end

    subgraph OUT["Output Channels"]
        UI1["Command Center page"]
        UI2["Action Queue page"]
        UI3["Briefings archive"]
        API1["REST endpoints"]
        SSE["SSE stream"]
        PDF["Briefing PDF"]
        WEB["Webhooks"]
    end

    F1 & F2 & F3 & F4 & F5 & F6 & F7 & F8 --> FETCHERS
    SYNCCRON --> FETCHERS
    FETCHERS --> CACHE

    CACHE --> SCORE
    CACHE --> CORR
    CACHE --> TRD
    CACHE --> GEO

    ORC --> SCORE
    ORC --> CORR
    ORC --> TRD
    ORC --> FCT
    ORC --> GEO
    ORC --> ACT
    ORC --> BRIEF
    ORC --> NOTIF

    TRD --> A3
    SCORE --> A1
    CORR --> A2
    FCT --> A4
    FCT --> A5
    GEO --> A6
    ACT --> A7
    BRIEF --> A8
    ORC --> A9

    A1 & A2 & A3 & A4 & A5 & A6 & A7 & A8 --> UI1
    A7 --> UI2
    A8 --> UI3
    A8 --> PDF
    A1 --> SSE
    NOTIF --> WEB

    classDef new fill:#0ea5e9,stroke:#075985,color:#fff
    classDef existing fill:#475569,stroke:#1e293b,color:#fff
    class AUTO,AUTOTABLES new
    class SYNC,CACHE existing
```

## Plain-text fallback

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ External feeds │──▶│  intel-sync    │──▶│ Postgres feed  │
└────────────────┘   │  cron          │   │ cache (12+     │
                     └────────────────┘   │ tables)        │
                                          └────────┬───────┘
                                                   │ read
                                                   ▼
                              ┌─────────────────────────────────┐
                              │     AUTOMATION LAYER            │
                              │ orchestrator                    │
                              │   ├─ threat-score               │
                              │   ├─ correlator                 │
                              │   ├─ trends                     │
                              │   ├─ forecast                   │
                              │   ├─ geo-sector                 │
                              │   ├─ action-queue               │
                              │   ├─ briefing-generator         │
                              │   └─ notifications              │
                              └─────────────┬───────────────────┘
                                            ▼
                              ┌─────────────────────────────────┐
                              │ Postgres automation tables (9)  │
                              └─────────────┬───────────────────┘
                                            ▼
                ┌──────────┬─────────────┬──────────┬─────────┐
                ▼          ▼             ▼          ▼         ▼
              Pages     REST APIs     SSE       PDF      Webhooks
```
