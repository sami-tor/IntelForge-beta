-- ================================================
-- Ahmia Dark Web Scraper — Database Migration
-- Creates table for storing scraped .onion URLs
-- from https://ahmia.fi/ (Tor hidden service index)
-- ================================================

BEGIN;

-- Table: ahmia_scraped_onions
-- Stores onion URLs discovered via Ahmia search engine
-- Defensive OSINT — only indexed public .onion sites

CREATE TABLE IF NOT EXISTS ahmia_scraped_onions (
    id              SERIAL PRIMARY KEY,
    onion_url       VARCHAR(500) UNIQUE NOT NULL,
    domain          VARCHAR(255) NOT NULL,
    title           TEXT,
    description     TEXT,
    query_used      VARCHAR(255),          -- Search query that found this onion
    discovered_at   TIMESTAMP DEFAULT NOW(),
    last_seen       TIMESTAMP DEFAULT NOW(),
    scrape_count    INTEGER DEFAULT 1,
    is_verified     BOOLEAN DEFAULT NULL,  -- NULL = not checked, TRUE = live, FALSE = dead
    tags            TEXT[],                -- Array of tags derived from query/context
    source          VARCHAR(50) DEFAULT 'ahmia'
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_ahmia_domain        ON ahmia_scraped_onions(domain);
CREATE INDEX IF NOT EXISTS idx_ahmia_last_seen     ON ahmia_scraped_onions(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_ahmia_query         ON ahmia_scraped_onions(query_used);
CREATE INDEX IF NOT EXISTS idx_ahmia_scrape_count  ON ahmia_scraped_onions(scrape_count DESC);
CREATE INDEX IF NOT EXISTS idx_ahmia_verified      ON ahmia_scraped_onions(is_verified) WHERE is_verified IS NOT NULL;

-- Comments
COMMENT ON TABLE ahmia_scraped_onions IS 'Onion URLs scraped from Ahmia.fi dark web search engine';
COMMENT ON COLUMN ahmia_scraped_onions.query_used IS 'The Ahmia search query that returned this onion URL';
COMMENT ON COLUMN ahmia_scraped_onions.is_verified IS 'Whether this onion responds to HTTP request (NULL=unchecked, TRUE=live, FALSE=dead)';

COMMIT;
