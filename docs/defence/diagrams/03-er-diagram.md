# Diagram 3 — Entity-Relationship for the Automation Layer

Only the new automation tables. The wider feed cache schema is
documented in `scripts/intel-feeds-migration.sql` and
`scripts/intel-advanced-feeds-migration.sql`.

```mermaid
erDiagram
    intel_threat_score_history {
        SERIAL id PK
        INTEGER score
        VARCHAR severity
        JSONB components
        JSONB drivers
        INTEGER delta_24h
        TIMESTAMPTZ computed_at
    }

    intel_correlation_clusters {
        SERIAL id PK
        VARCHAR cluster_key UK
        VARCHAR cluster_type
        TEXT title
        TEXT summary
        INTEGER risk_score
        VARCHAR severity
        INTEGER signal_count
        JSONB signals
        TEXT_ARRAY tags
        TIMESTAMPTZ first_seen
        TIMESTAMPTZ last_seen
    }

    intel_trend_metrics {
        SERIAL id PK
        VARCHAR metric_key
        VARCHAR metric_label
        DATE bucket_date
        INTEGER value
        NUMERIC delta_pct
        BOOLEAN is_emerging
    }

    intel_metric_forecasts {
        SERIAL id PK
        VARCHAR metric_key
        DATE forecast_date
        INTEGER predicted_value
        INTEGER lower_bound
        INTEGER upper_bound
        VARCHAR method
        INTEGER confidence
    }

    intel_anomalies {
        SERIAL id PK
        VARCHAR metric_key
        VARCHAR metric_label
        DATE bucket_date
        INTEGER value
        NUMERIC expected_value
        NUMERIC z_score
        VARCHAR severity
        VARCHAR direction
        TEXT explanation
    }

    intel_action_queue {
        SERIAL id PK
        VARCHAR action_key UK
        TEXT title
        TEXT description
        VARCHAR category
        INTEGER priority
        VARCHAR severity
        VARCHAR source_type
        TEXT source_ref
        JSONB suggested_steps
        JSONB metadata
        VARCHAR status
        INTEGER assigned_to
    }

    intel_geo_threat {
        SERIAL id PK
        VARCHAR country
        VARCHAR country_code
        DATE bucket_date
        INTEGER ransomware_count
        INTEGER phishing_count
        INTEGER darknet_count
        INTEGER total_signals
        INTEGER risk_score
    }

    intel_sector_risk {
        SERIAL id PK
        VARCHAR sector
        DATE bucket_date
        INTEGER ransomware_victims
        INTEGER phishing_targets
        INTEGER darknet_mentions
        INTEGER cve_relevance
        INTEGER risk_score
    }

    intel_briefings {
        SERIAL id PK
        VARCHAR briefing_type
        TEXT headline
        VARCHAR threat_level
        INTEGER threat_score
        TEXT summary
        JSONB highlights
        JSONB top_clusters
        JSONB metrics
        JSONB recommendations
        TIMESTAMPTZ period_start
        TIMESTAMPTZ period_end
    }

    intel_notification_log {
        SERIAL id PK
        VARCHAR event
        VARCHAR channel
        TEXT target
        JSONB payload
        VARCHAR status
        TEXT error
        TIMESTAMPTZ sent_at
    }

    intel_automation_runs {
        SERIAL id PK
        VARCHAR run_type
        VARCHAR status
        INTEGER duration_ms
        JSONB output
        TEXT error
        TIMESTAMPTZ started_at
        TIMESTAMPTZ finished_at
    }

    intel_threat_score_history ||..o{ intel_briefings : "snapshot baseline"
    intel_correlation_clusters ||..o{ intel_briefings : "top_clusters JSON"
    intel_trend_metrics        ||..o{ intel_metric_forecasts : "feeds"
    intel_trend_metrics        ||..o{ intel_anomalies : "feeds"
    intel_correlation_clusters ||..o{ intel_action_queue : "source = cluster"
    intel_anomalies            ||..o{ intel_action_queue : "source = anomaly"
    intel_briefings            ||..o{ intel_notification_log : "fires"
    intel_automation_runs      ||..o{ intel_threat_score_history : "produces"
```

## Idempotency contract

| Table | Unique key | Behaviour on conflict |
|-------|------------|------------------------|
| `intel_correlation_clusters` | `cluster_key` | UPDATE: title, summary, signals, last_seen |
| `intel_briefings` | `(briefing_type, period_start)` | UPDATE: headline, summary, highlights, period_end |
| `intel_trend_metrics` | `(metric_key, bucket_date)` | UPDATE: value, delta_pct, is_emerging |
| `intel_metric_forecasts` | `(metric_key, forecast_date)` | UPDATE: predicted, bounds, confidence |
| `intel_anomalies` | `(metric_key, bucket_date)` | UPDATE: value, z_score, severity |
| `intel_action_queue` | `action_key` (sha256 hash) | UPDATE: title, priority, suggested_steps |
| `intel_geo_threat` | `(country, bucket_date)` | UPDATE: counts, risk_score |
| `intel_sector_risk` | `(sector, bucket_date)` | UPDATE: counts, risk_score |
