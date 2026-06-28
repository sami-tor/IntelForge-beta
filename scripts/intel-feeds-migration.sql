-- ================================================
-- Intel Feeds Migration
-- Threat Intelligence SaaS Hub - Feed Tables
-- ================================================
-- Run this after the main database.sql migration

-- ================================================
-- INTEL FEED TABLES
-- ================================================

-- Aggregated news from RSS sources
CREATE TABLE IF NOT EXISTS intel_news_cache (
    id SERIAL PRIMARY KEY,
    guid VARCHAR(512) UNIQUE NOT NULL,       -- dedup key (URL hash or feed GUID)
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    source VARCHAR(100) NOT NULL,            -- e.g. 'bleepingcomputer', 'hackernews'
    source_label VARCHAR(100),               -- e.g. 'BleepingComputer'
    category VARCHAR(50),                    -- ransomware | apt | vulnerability | breach | malware | nation-state
    published_at TIMESTAMPTZ,
    image_url TEXT,
    author TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_cache_published ON intel_news_cache(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_cache_category ON intel_news_cache(category);
CREATE INDEX IF NOT EXISTS idx_news_cache_source ON intel_news_cache(source);

-- Ransomware groups and recent victims
CREATE TABLE IF NOT EXISTS intel_ransomware_groups (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    first_seen DATE,
    victim_count INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    locations TEXT[],                        -- targeted countries
    sectors TEXT[],                          -- targeted industries
    aliases TEXT[],
    meta JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_ransomware_victims (
    id SERIAL PRIMARY KEY,
    victim_name VARCHAR(300),
    url TEXT,
    group_name VARCHAR(100) NOT NULL,
    discovered_at TIMESTAMPTZ,
    country VARCHAR(100),
    sector VARCHAR(100),
    description TEXT,
    screenshot TEXT,
    published BOOLEAN DEFAULT false,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ransom_victims_group ON intel_ransomware_victims(group_name);
CREATE INDEX IF NOT EXISTS idx_ransom_victims_discovered ON intel_ransomware_victims(discovered_at DESC);

-- CVE / Vulnerability cache
CREATE TABLE IF NOT EXISTS intel_cve_cache (
    id SERIAL PRIMARY KEY,
    cve_id VARCHAR(30) UNIQUE NOT NULL,      -- e.g. CVE-2024-1234
    description TEXT,
    cvss_v3_score DECIMAL(3,1),
    cvss_v3_severity VARCHAR(20),            -- CRITICAL | HIGH | MEDIUM | LOW | NONE
    cvss_v2_score DECIMAL(3,1),
    epss_score DECIMAL(6,5),                 -- 0.0 - 1.0
    epss_percentile DECIMAL(6,5),
    cwe TEXT[],
    vendor TEXT,
    product TEXT,
    published_at TIMESTAMPTZ,
    last_modified TIMESTAMPTZ,
    is_kev BOOLEAN DEFAULT false,            -- CISA Known Exploited Vulnerability
    kev_added_date DATE,
    kev_due_date DATE,
    kev_required_action TEXT,
    ref_urls TEXT[],
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cve_published ON intel_cve_cache(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cve_severity ON intel_cve_cache(cvss_v3_severity);
CREATE INDEX IF NOT EXISTS idx_cve_kev ON intel_cve_cache(is_kev) WHERE is_kev = true;
CREATE INDEX IF NOT EXISTS idx_cve_id ON intel_cve_cache(cve_id);

-- IOC lookup history (per user for rate gating)
CREATE TABLE IF NOT EXISTS intel_ioc_lookups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ioc_type VARCHAR(20) NOT NULL,           -- ip | domain | hash | url
    ioc_value TEXT NOT NULL,
    result JSONB,                            -- cached aggregated result
    sources_queried TEXT[],
    queried_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ioc_user ON intel_ioc_lookups(user_id, queried_at DESC);
CREATE INDEX IF NOT EXISTS idx_ioc_value ON intel_ioc_lookups(ioc_value, ioc_type);

-- Malware samples / IOC feeds
CREATE TABLE IF NOT EXISTS intel_malware_cache (
    id SERIAL PRIMARY KEY,
    sha256 VARCHAR(64),
    sha1 VARCHAR(40),
    md5 VARCHAR(32),
    file_name TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    malware_family TEXT[],
    tags TEXT[],
    iocs TEXT[],                             -- associated URLs/IPs/domains
    source VARCHAR(50),                      -- malwarebazaar | urlhaus | threatfox | feodotracker
    raw_url TEXT,                            -- original malicious URL (for urlhaus entries)
    url_status VARCHAR(50),
    reporter TEXT,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    meta JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_malware_source ON intel_malware_cache(source);
CREATE INDEX IF NOT EXISTS idx_malware_first_seen ON intel_malware_cache(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_malware_family ON intel_malware_cache USING GIN(malware_family);

-- MITRE ATT&CK groups (threat actors)
CREATE TABLE IF NOT EXISTS intel_mitre_groups (
    id SERIAL PRIMARY KEY,
    stix_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    aliases TEXT[],
    description TEXT,
    group_id VARCHAR(20),                    -- e.g. G0001
    url TEXT,
    techniques TEXT[],                       -- associated technique IDs
    software TEXT[],                         -- associated software IDs
    sectors TEXT[],
    countries TEXT[],
    meta JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mitre_groups_name ON intel_mitre_groups(name);

-- MITRE ATT&CK techniques
CREATE TABLE IF NOT EXISTS intel_mitre_techniques (
    id SERIAL PRIMARY KEY,
    stix_id VARCHAR(100) UNIQUE NOT NULL,
    technique_id VARCHAR(20),                -- e.g. T1059
    name VARCHAR(300) NOT NULL,
    description TEXT,
    tactic TEXT[],                           -- tactic names
    platforms TEXT[],                        -- Windows, Linux, macOS, Cloud, etc.
    detection TEXT,
    mitigation TEXT,
    url TEXT,
    is_subtechnique BOOLEAN DEFAULT false,
    parent_technique_id VARCHAR(20),
    meta JSONB,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mitre_tech_id ON intel_mitre_techniques(technique_id);
CREATE INDEX IF NOT EXISTS idx_mitre_tech_tactic ON intel_mitre_techniques USING GIN(tactic);

-- Feed sync status (cron job tracking)
CREATE TABLE IF NOT EXISTS intel_feed_sync_log (
    id SERIAL PRIMARY KEY,
    feed_name VARCHAR(100) NOT NULL,         -- news | ransomware | cve | malware | mitre
    status VARCHAR(20) NOT NULL,             -- success | failed | running
    items_fetched INTEGER DEFAULT 0,
    items_stored INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_log_feed ON intel_feed_sync_log(feed_name, started_at DESC);

-- ================================================
-- ADD ENV KEYS TRACKING (optional, for admin UI)
-- ================================================
-- Add new optional API key fields to settings (admin can configure in UI)
-- These are stored in environment variables, not DB
-- But we track which keys are configured for admin visibility

CREATE TABLE IF NOT EXISTS intel_api_key_config (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) UNIQUE NOT NULL,   -- VIRUSTOTAL_API_KEY, GREYNOISE_API_KEY, etc.
    is_configured BOOLEAN DEFAULT false,
    last_verified TIMESTAMPTZ,
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the API key config rows
INSERT INTO intel_api_key_config (key_name, is_configured, note) VALUES
  ('VIRUSTOTAL_API_KEY',  false, 'Free tier: 500 req/day - https://virustotal.com'),
  ('GREYNOISE_API_KEY',   false, 'Free community tier - https://greynoise.io'),
  ('ABUSEIPDB_API_KEY',   false, 'Free tier: 1000 checks/day - https://abuseipdb.com'),
  ('OTX_API_KEY',         false, 'Free AlienVault OTX - https://otx.alienvault.com'),
  ('HYBRID_API_KEY',      false, 'Free Hybrid Analysis - https://hybrid-analysis.com'),
  ('HIBP_API_KEY',        false, 'HaveIBeenPwned - https://haveibeenpwned.com/API/Key')
ON CONFLICT (key_name) DO NOTHING;
