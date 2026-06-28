-- ================================================
-- IntelForge - Automation Layer v3 Migration
-- ------------------------------------------------
-- Adds:
--   • forecast accuracy backtesting (intel_forecast_accuracy)
--   • action queue collaboration (comments, audit log)
--   • anomaly causality attribution column
--   • cron rate-limiting (intel_cron_rate_log)
--   • geo/sector materialised views
-- Idempotent. Safe to re-run.
-- ================================================

-- ----------------------------------------------------------------
-- 1. Forecast accuracy log — stores backtest results per metric
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_forecast_accuracy (
    id              SERIAL PRIMARY KEY,
    metric_key      VARCHAR(80) NOT NULL,
    method          VARCHAR(40) NOT NULL,         -- holt | holt_winters | naive
    horizon_days    INTEGER NOT NULL DEFAULT 7,
    mape            NUMERIC(8,3) NOT NULL,        -- mean absolute percentage error
    rmse            NUMERIC(12,3) NOT NULL,
    mae             NUMERIC(12,3) NOT NULL,
    sample_size     INTEGER NOT NULL,
    evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (metric_key, method, evaluated_at)
);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_metric
    ON intel_forecast_accuracy(metric_key, evaluated_at DESC);

-- ----------------------------------------------------------------
-- 2. Action queue comments
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_action_comments (
    id              SERIAL PRIMARY KEY,
    action_id       INTEGER NOT NULL REFERENCES intel_action_queue(id) ON DELETE CASCADE,
    author_id       INTEGER,
    author_name     VARCHAR(120),
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_comments_action
    ON intel_action_comments(action_id, created_at DESC);


-- ----------------------------------------------------------------
-- 3. Action queue audit log — every status / assignment change
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_action_audit (
    id              SERIAL PRIMARY KEY,
    action_id       INTEGER NOT NULL REFERENCES intel_action_queue(id) ON DELETE CASCADE,
    actor_id        INTEGER,
    actor_name      VARCHAR(120),
    event           VARCHAR(40) NOT NULL,          -- status_change | assigned | comment | priority_change
    from_value      TEXT,
    to_value        TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_audit_action
    ON intel_action_audit(action_id, created_at DESC);

-- ----------------------------------------------------------------
-- 4. Anomaly causality - which feed rows drove a spike
-- ----------------------------------------------------------------
ALTER TABLE intel_anomalies
    ADD COLUMN IF NOT EXISTS caused_by JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------------------------------
-- 5. Cron rate-limit log - per IP per minute
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_cron_rate_log (
    id          SERIAL PRIMARY KEY,
    endpoint    VARCHAR(120) NOT NULL,
    client_ip   VARCHAR(80) NOT NULL,
    called_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_rate_log_lookup
    ON intel_cron_rate_log(endpoint, client_ip, called_at DESC);


-- ----------------------------------------------------------------
-- 6. Geo + sector materialised views (faster aggregation)
-- ----------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_geo_threat_30d;
CREATE MATERIALIZED VIEW mv_geo_threat_30d AS
SELECT
    LOWER(country) AS country_lower,
    country,
    'ransomware'::text AS source,
    COUNT(*) AS cnt
FROM intel_ransomware_victims
WHERE country IS NOT NULL AND discovered_at > NOW() - INTERVAL '30 days'
GROUP BY country
UNION ALL
SELECT LOWER(country), country, 'phishing', COUNT(*)
FROM intel_phishing_cache
WHERE country IS NOT NULL AND active = true
GROUP BY country
UNION ALL
SELECT LOWER(victim_country), victim_country, 'darknet', COUNT(*)
FROM intel_darknet_posts
WHERE victim_country IS NOT NULL AND discovered_at > NOW() - INTERVAL '30 days'
GROUP BY victim_country;

CREATE INDEX IF NOT EXISTS idx_mv_geo_country
    ON mv_geo_threat_30d(country_lower);

-- ----------------------------------------------------------------
-- 7. Action queue search index (trigram)
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_action_queue_title_trgm
    ON intel_action_queue USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_action_queue_description_trgm
    ON intel_action_queue USING gin (description gin_trgm_ops);

-- ----------------------------------------------------------------
-- 8. News title trigram for entity-aware correlation
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_news_title_trgm
    ON intel_news_cache USING gin (title gin_trgm_ops);
