-- ================================================
-- IntelForge - Automation Layer Migration
-- Adds: global threat scoring, auto-correlation,
--       daily briefings, predictive trends.
-- Idempotent. Safe to re-run.
-- ================================================

-- ----------------------------------------------------------------
-- 1. Global Threat Score timeseries
--    One row per scoring snapshot. Drives the live gauge & history.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_threat_score_history (
    id              SERIAL PRIMARY KEY,
    score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    severity        VARCHAR(16) NOT NULL,           -- info | low | medium | high | critical
    components      JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                    -- breakdown: {kev, criticalCves, ransomware30d, ...}
    drivers         JSONB NOT NULL DEFAULT '[]'::jsonb,
                                                    -- ordered list of human-readable contributing factors
    delta_24h       INTEGER NOT NULL DEFAULT 0,     -- score change vs 24h ago
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_score_computed
    ON intel_threat_score_history(computed_at DESC);

-- ----------------------------------------------------------------
-- 2. Correlated Threat Clusters
--    A cluster groups a single CVE/actor with all related signals
--    (exploit PoCs, KEV entries, news, ransomware mentions, IOCs).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_correlation_clusters (
    id                 SERIAL PRIMARY KEY,
    cluster_key        VARCHAR(120) UNIQUE NOT NULL,    -- normalized anchor (e.g. cve_id, actor_slug)
    cluster_type       VARCHAR(40)  NOT NULL,           -- cve | actor | malware | ransomware
    title              TEXT NOT NULL,
    summary            TEXT,
    risk_score         INTEGER NOT NULL DEFAULT 0,
    severity           VARCHAR(16) NOT NULL DEFAULT 'medium',
    signal_count       INTEGER NOT NULL DEFAULT 0,      -- number of evidence signals merged
    signals            JSONB NOT NULL DEFAULT '{}'::jsonb,
                                                        -- {cve, exploits[], news[], ransomware[], iocs[], actors[]}
    tags               TEXT[]   NOT NULL DEFAULT '{}',
    first_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_promoted_at   TIMESTAMPTZ,                     -- last time this was put on the dashboard
    auto_generated     BOOLEAN  NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlation_clusters_score
    ON intel_correlation_clusters(risk_score DESC, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_clusters_type
    ON intel_correlation_clusters(cluster_type);

-- ----------------------------------------------------------------
-- 3. Daily / Hourly Executive Briefings
--    Auto-generated narrative + structured payload.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_briefings (
    id              SERIAL PRIMARY KEY,
    briefing_type   VARCHAR(40) NOT NULL,             -- daily | weekly | flash
    headline        TEXT        NOT NULL,
    threat_level    VARCHAR(16) NOT NULL,             -- info | low | medium | high | critical
    threat_score    INTEGER     NOT NULL DEFAULT 0,
    summary         TEXT        NOT NULL,             -- 2-4 sentence narrative
    highlights      JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                                      -- ordered list of key points (strings or {title,detail})
    top_clusters    JSONB       NOT NULL DEFAULT '[]'::jsonb,
                                                      -- snapshot of top correlation clusters at gen time
    metrics         JSONB       NOT NULL DEFAULT '{}'::jsonb,
                                                      -- raw counters (cves, kev, victims, exploits, ...)
    recommendations JSONB       NOT NULL DEFAULT '[]'::jsonb,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (briefing_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_briefings_generated
    ON intel_briefings(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefings_type
    ON intel_briefings(briefing_type, generated_at DESC);

-- ----------------------------------------------------------------
-- 4. Trend / KPI metrics for predictive sparklines
--    Daily counters per metric_key for the last N days.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_trend_metrics (
    id            SERIAL PRIMARY KEY,
    metric_key    VARCHAR(80) NOT NULL,            -- cve_critical | ransomware_victims | phishing_active | ...
    metric_label  VARCHAR(160),
    bucket_date   DATE NOT NULL,                   -- day bucket
    value         INTEGER NOT NULL DEFAULT 0,
    delta_pct     NUMERIC(8,2) NOT NULL DEFAULT 0, -- % change vs previous bucket
    is_emerging   BOOLEAN NOT NULL DEFAULT false,  -- true when delta crosses threshold
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_key, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_trend_metrics_key_date
    ON intel_trend_metrics(metric_key, bucket_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_metrics_emerging
    ON intel_trend_metrics(is_emerging, bucket_date DESC) WHERE is_emerging = true;

-- ----------------------------------------------------------------
-- 5. Automation run log (separate from intel_jobs/scraper_runs:
--    these are the meta-orchestration runs of the automation cron
--    itself).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_automation_runs (
    id            SERIAL PRIMARY KEY,
    run_type      VARCHAR(60) NOT NULL,             -- scoring | correlation | briefing | trends | full
    status        VARCHAR(20) NOT NULL,             -- running | success | failed
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    output        JSONB NOT NULL DEFAULT '{}'::jsonb,
    error         TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_started
    ON intel_automation_runs(started_at DESC);
