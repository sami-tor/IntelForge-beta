-- ================================================
-- IntelForge - Automation Layer v2 Migration
-- ------------------------------------------------
-- Adds:  forecasts, anomalies, action queue,
--        geo heatmap, sector index, webhook
--        notification log.
-- Idempotent. Safe to re-run.
-- ================================================

-- ----------------------------------------------------------------
-- 1. Forecasts — short-horizon predictions for KPIs.
--    One row per (metric_key, forecast_date).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_metric_forecasts (
    id              SERIAL PRIMARY KEY,
    metric_key      VARCHAR(80) NOT NULL,
    forecast_date   DATE NOT NULL,
    predicted_value INTEGER NOT NULL DEFAULT 0,
    lower_bound     INTEGER NOT NULL DEFAULT 0,
    upper_bound     INTEGER NOT NULL DEFAULT 0,
    method          VARCHAR(40) NOT NULL DEFAULT 'exp_smoothing',
    confidence      INTEGER NOT NULL DEFAULT 50,    -- 0-100
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_key, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_metric_forecasts_key_date
    ON intel_metric_forecasts(metric_key, forecast_date);

-- ----------------------------------------------------------------
-- 2. Anomalies — points that broke the trend envelope.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_anomalies (
    id              SERIAL PRIMARY KEY,
    metric_key      VARCHAR(80) NOT NULL,
    metric_label    VARCHAR(160),
    bucket_date     DATE NOT NULL,
    value           INTEGER NOT NULL,
    expected_value  NUMERIC(12,2) NOT NULL,
    z_score         NUMERIC(8,3) NOT NULL,
    severity        VARCHAR(16) NOT NULL DEFAULT 'medium',
    direction       VARCHAR(8)  NOT NULL,           -- spike | drop
    explanation     TEXT,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_key, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_detected
    ON intel_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_metric
    ON intel_anomalies(metric_key, bucket_date DESC);

-- ----------------------------------------------------------------
-- 3. Action Queue — auto-generated, ranked tasks.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_action_queue (
    id              SERIAL PRIMARY KEY,
    action_key      VARCHAR(160) UNIQUE NOT NULL,    -- dedup key for idempotent inserts
    title           TEXT NOT NULL,
    description     TEXT,
    category        VARCHAR(40) NOT NULL,            -- patch | hunt | block | review | drill
    priority        INTEGER NOT NULL DEFAULT 50,     -- 0-100
    severity        VARCHAR(16) NOT NULL DEFAULT 'medium',
    source_type     VARCHAR(40),                     -- cluster | anomaly | trend | briefing
    source_ref      TEXT,                            -- cluster_key or other id
    suggested_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | in_progress | done | dismissed
    assigned_to     INTEGER,                         -- users.id, optional
    done_at         TIMESTAMPTZ,
    done_by         INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_queue_status
    ON intel_action_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_action_queue_created
    ON intel_action_queue(created_at DESC);

-- ----------------------------------------------------------------
-- 4. Geographic Threat Index — per-country risk snapshot.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_geo_threat (
    id              SERIAL PRIMARY KEY,
    country         VARCHAR(120) NOT NULL,
    country_code    VARCHAR(8),
    bucket_date     DATE NOT NULL,
    ransomware_count INTEGER NOT NULL DEFAULT 0,
    phishing_count   INTEGER NOT NULL DEFAULT 0,
    darknet_count    INTEGER NOT NULL DEFAULT 0,
    total_signals    INTEGER NOT NULL DEFAULT 0,
    risk_score       INTEGER NOT NULL DEFAULT 0,    -- 0-100
    captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_geo_threat_date
    ON intel_geo_threat(bucket_date DESC, risk_score DESC);

-- ----------------------------------------------------------------
-- 5. Sector Risk Index — per-industry risk snapshot.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_sector_risk (
    id              SERIAL PRIMARY KEY,
    sector          VARCHAR(160) NOT NULL,
    bucket_date     DATE NOT NULL,
    ransomware_victims INTEGER NOT NULL DEFAULT 0,
    phishing_targets   INTEGER NOT NULL DEFAULT 0,
    darknet_mentions   INTEGER NOT NULL DEFAULT 0,
    cve_relevance      INTEGER NOT NULL DEFAULT 0,
    risk_score         INTEGER NOT NULL DEFAULT 0, -- 0-100
    captured_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sector, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_sector_risk_date
    ON intel_sector_risk(bucket_date DESC, risk_score DESC);

-- ----------------------------------------------------------------
-- 6. Notification dispatch log — audit of webhook fires from
--    the automation layer.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_notification_log (
    id              SERIAL PRIMARY KEY,
    event           VARCHAR(80) NOT NULL,
    channel         VARCHAR(40) NOT NULL,           -- webhook | email | siem
    target          TEXT,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(20) NOT NULL DEFAULT 'sent',
    error           TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_sent
    ON intel_notification_log(sent_at DESC);
