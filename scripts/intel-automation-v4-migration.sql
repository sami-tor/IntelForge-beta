-- ================================================
-- IntelForge - Automation Layer v4 Migration
-- ------------------------------------------------
-- Adds CTI artifacts that the deep correlator needs:
--   • Pastebin / leak posts
--   • Stealer log records (URL/login/password lines)
--   • Combolist breach drops
--   • Compromised hosts (machines exposed in stealer dumps)
--   • Threat-actor → CVE explicit edges
--   • Threat-actor → breach victim edges
-- All tables are idempotent and demo-friendly.
-- ================================================

-- ----------------------------------------------------------------
-- 1. Pastebin / paste-site monitor
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_paste_posts (
    id              SERIAL PRIMARY KEY,
    post_uid        VARCHAR(120) UNIQUE NOT NULL,
    source          VARCHAR(40) NOT NULL,            -- pastebin | ghostbin | rentry | gist (anonymised)
    title           TEXT,
    excerpt         TEXT,                             -- redacted preview
    indicator_kinds TEXT[] NOT NULL DEFAULT '{}',     -- e.g. {credential, api_key, db_dump, ioc}
    matched_brands  TEXT[] NOT NULL DEFAULT '{}',     -- brands referenced
    matched_cves    TEXT[] NOT NULL DEFAULT '{}',
    threat_actor    VARCHAR(160),
    severity        VARCHAR(16) NOT NULL DEFAULT 'medium',
    discovered_at   TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_paste_discovered ON intel_paste_posts(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_paste_actor ON intel_paste_posts(threat_actor);
CREATE INDEX IF NOT EXISTS idx_paste_brands ON intel_paste_posts USING GIN (matched_brands);
CREATE INDEX IF NOT EXISTS idx_paste_cves ON intel_paste_posts USING GIN (matched_cves);

-- ----------------------------------------------------------------
-- 2. Stealer log lines (URL · login · password redacted)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_stealer_logs (
    id              SERIAL PRIMARY KEY,
    log_uid         VARCHAR(160) UNIQUE NOT NULL,
    stealer_family  VARCHAR(60) NOT NULL,             -- redline | raccoon | lumma | vidar | meta | redacted
    machine_id      VARCHAR(80),                      -- pseudonymous host id
    country         VARCHAR(80),
    captured_url    TEXT NOT NULL,
    domain          VARCHAR(255),
    login_user      VARCHAR(255),                     -- masked: e.g. j****@example.com
    password_redacted VARCHAR(60),                    -- masked placeholder e.g. <REDACTED:8>
    record_type     VARCHAR(40) NOT NULL DEFAULT 'credential',  -- credential | cookie | autofill
    severity        VARCHAR(16) NOT NULL DEFAULT 'high',
    captured_at     TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stealer_domain ON intel_stealer_logs(domain);
CREATE INDEX IF NOT EXISTS idx_stealer_captured ON intel_stealer_logs(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_stealer_family ON intel_stealer_logs(stealer_family);
CREATE INDEX IF NOT EXISTS idx_stealer_machine ON intel_stealer_logs(machine_id);


-- ----------------------------------------------------------------
-- 3. Combolist drops (URL:user:password style breach drops)
--    We store one row per drop, with summary stats only — never
--    raw passwords.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_combolist_drops (
    id              SERIAL PRIMARY KEY,
    drop_uid        VARCHAR(160) UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    source          VARCHAR(60) NOT NULL,             -- forum | telegram | breach (anonymised)
    line_count      INTEGER NOT NULL DEFAULT 0,
    unique_domains  INTEGER NOT NULL DEFAULT 0,
    sample_domains  TEXT[] NOT NULL DEFAULT '{}',     -- top 5 domains in the drop
    matched_brands  TEXT[] NOT NULL DEFAULT '{}',
    severity        VARCHAR(16) NOT NULL DEFAULT 'high',
    threat_actor    VARCHAR(160),
    posted_at       TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_combolist_posted ON intel_combolist_drops(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_combolist_actor ON intel_combolist_drops(threat_actor);
CREATE INDEX IF NOT EXISTS idx_combolist_domains ON intel_combolist_drops USING GIN (sample_domains);

-- ----------------------------------------------------------------
-- 4. Compromised hosts — pseudonymous machine inventory
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_compromised_hosts (
    id              SERIAL PRIMARY KEY,
    host_uid        VARCHAR(80) UNIQUE NOT NULL,      -- pseudonymous, e.g. host-a1b2c3
    hostname        VARCHAR(160),                     -- masked
    country         VARCHAR(80),
    os              VARCHAR(80),
    stealer_family  VARCHAR(60),
    credential_count INTEGER NOT NULL DEFAULT 0,
    cookie_count     INTEGER NOT NULL DEFAULT 0,
    autofill_count   INTEGER NOT NULL DEFAULT 0,
    matched_domains TEXT[] NOT NULL DEFAULT '{}',     -- domains touched by this host
    first_seen      TIMESTAMPTZ NOT NULL,
    last_seen       TIMESTAMPTZ NOT NULL,
    severity        VARCHAR(16) NOT NULL DEFAULT 'high',
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_hosts_country ON intel_compromised_hosts(country);
CREATE INDEX IF NOT EXISTS idx_hosts_stealer ON intel_compromised_hosts(stealer_family);
CREATE INDEX IF NOT EXISTS idx_hosts_domains ON intel_compromised_hosts USING GIN (matched_domains);

-- ----------------------------------------------------------------
-- 5. Threat-actor → CVE explicit edges
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_actor_cve_links (
    id              SERIAL PRIMARY KEY,
    actor_name      VARCHAR(160) NOT NULL,
    cve_id          VARCHAR(40) NOT NULL,
    relationship    VARCHAR(40) NOT NULL DEFAULT 'exploits',  -- exploits | discovered | observed
    confidence      INTEGER NOT NULL DEFAULT 70,              -- 0-100
    first_seen      DATE,
    last_seen       DATE,
    sources         TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE (actor_name, cve_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_actor_cve_actor ON intel_actor_cve_links(actor_name);
CREATE INDEX IF NOT EXISTS idx_actor_cve_cve ON intel_actor_cve_links(cve_id);


-- ----------------------------------------------------------------
-- 6. Threat-actor → breach / victim edges
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intel_actor_breach_links (
    id              SERIAL PRIMARY KEY,
    actor_name      VARCHAR(160) NOT NULL,
    victim_name     VARCHAR(300) NOT NULL,
    sector          VARCHAR(120),
    country         VARCHAR(80),
    breach_date     DATE,
    breach_type     VARCHAR(60) NOT NULL DEFAULT 'data_leak',  -- data_leak | ransomware | extortion | wiper
    record_count    BIGINT,                                     -- approx records exposed
    confidence      INTEGER NOT NULL DEFAULT 70,
    severity        VARCHAR(16) NOT NULL DEFAULT 'high',
    references_urls TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE (actor_name, victim_name, breach_date)
);

CREATE INDEX IF NOT EXISTS idx_actor_breach_actor ON intel_actor_breach_links(actor_name);
CREATE INDEX IF NOT EXISTS idx_actor_breach_sector ON intel_actor_breach_links(sector);
CREATE INDEX IF NOT EXISTS idx_actor_breach_date ON intel_actor_breach_links(breach_date DESC);

-- ----------------------------------------------------------------
-- 7. Pre-existing intel_correlation_clusters needs a few more
--    columns to support multi-anchor correlation v2.
-- ----------------------------------------------------------------
ALTER TABLE intel_correlation_clusters
    ADD COLUMN IF NOT EXISTS confidence INTEGER NOT NULL DEFAULT 50;
ALTER TABLE intel_correlation_clusters
    ADD COLUMN IF NOT EXISTS related_cves TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE intel_correlation_clusters
    ADD COLUMN IF NOT EXISTS anchor_actor TEXT;
ALTER TABLE intel_correlation_clusters
    ADD COLUMN IF NOT EXISTS anchor_ransomware TEXT;
