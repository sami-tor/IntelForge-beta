-- ================================================
-- Watchlist System Migration
-- Users can track CVEs, domains, actors for changes
-- ================================================

CREATE TABLE IF NOT EXISTS user_watchlists (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('cve', 'domain', 'actor', 'hash', 'ip', 'keyword')),
    entity_value    TEXT NOT NULL,
    label           TEXT,
    notes           TEXT,
    last_checked_at TIMESTAMPTZ,
    last_result     JSONB,
    change_count    INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_value)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON user_watchlists(is_active);
