-- Face Search History
-- Stores past face searches with image hash, thumbnail, and result summary

CREATE TABLE IF NOT EXISTS face_search_history (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,       -- authenticated user ID
    image_hash      TEXT NOT NULL,       -- SHA-256 hash of the uploaded image
    image_thumbnail TEXT,                -- base64 data URL of thumbnail (small, ~10KB max)
    query_url       TEXT,                -- original URL if URL-based search was used
    results_count   INTEGER DEFAULT 0,  -- total results found
    top_matches     JSONB,              -- top 5 face_ids + scores for quick reference
    search_time_ms  INTEGER,            -- how long the search took
    ip_address      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fsh_user ON face_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_fsh_created ON face_search_history(created_at DESC);
