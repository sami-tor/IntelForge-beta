-- ================================================
-- Intel Advanced Feeds Migration
-- 10 advanced threat intelligence features
-- ================================================

-- 1. Exploit Intelligence (Exploit-DB PoC matching for CVEs)
CREATE TABLE IF NOT EXISTS intel_exploit_cache (
    id SERIAL PRIMARY KEY,
    exploit_id VARCHAR(100) UNIQUE NOT NULL,     -- EDB-ID or CVE reference
    cve_id VARCHAR(30),                          -- linked CVE
    title TEXT NOT NULL,
    description TEXT,
    exploit_type VARCHAR(50),                    -- remote | local | webapp | dos | privesc
    platform VARCHAR(50),                        -- linux | windows | php | etc.
    author TEXT,
    raw_code TEXT,                               -- exploit source code (truncated)
    poc_url TEXT,                                -- link to full PoC
    published_at TIMESTAMPTZ,
    verified BOOLEAN DEFAULT false,
    has_poc BOOLEAN DEFAULT true,
    tags TEXT[],
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exploit_cve ON intel_exploit_cache(cve_id);
CREATE INDEX IF NOT EXISTS idx_exploit_published ON intel_exploit_cache(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_exploit_type ON intel_exploit_cache(exploit_type);

-- 2. Certificate Transparency Domain Intel
CREATE TABLE IF NOT EXISTS intel_cert_cache (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    issuer VARCHAR(500),
    serial_number VARCHAR(200),
    fingerprint_sha256 VARCHAR(64),
    not_before TIMESTAMPTZ,
    not_after TIMESTAMPTZ,
    subject_alt_names TEXT[],
    wildcard BOOLEAN DEFAULT false,
    revoked BOOLEAN DEFAULT false,
    crt_sh_id BIGINT,
    logged_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_domain ON intel_cert_cache(domain);
CREATE INDEX IF NOT EXISTS idx_cert_logged ON intel_cert_cache(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_san ON intel_cert_cache USING GIN(subject_alt_names);

-- 3. Phishing Intelligence Feed
CREATE TABLE IF NOT EXISTS intel_phishing_cache (
    id SERIAL PRIMARY KEY,
    phish_id VARCHAR(200) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    target_brand VARCHAR(200),
    phish_type VARCHAR(50),                      -- credential_harvesting | smishing | vishing | malware_delivery
    ip_address VARCHAR(45),
    asn VARCHAR(50),
    country VARCHAR(100),
    screenshot_url TEXT,
    verified BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    reported_at TIMESTAMPTZ,
    tags TEXT[],
    source VARCHAR(50) NOT NULL,                 -- openphish | phishtank
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phish_url ON intel_phishing_cache(url);
CREATE INDEX IF NOT EXISTS idx_phish_brand ON intel_phishing_cache(target_brand);
CREATE INDEX IF NOT EXISTS idx_phish_reported ON intel_phishing_cache(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_phish_active ON intel_phishing_cache(active) WHERE active = true;

-- 4. Supply Chain / Dependency Vulnerability Intel (OSV.dev)
CREATE TABLE IF NOT EXISTS intel_supply_chain_cache (
    id SERIAL PRIMARY KEY,
    osv_id VARCHAR(100) UNIQUE NOT NULL,         -- OSV.dev ID (e.g. GHSA-xxxx)
    package_name VARCHAR(200) NOT NULL,
    package_ecosystem VARCHAR(50),               -- npm | pypi | maven | go | crates | nuget | etc.
    summary TEXT,
    details TEXT,
    severity VARCHAR(20),
    cvss_v3_score DECIMAL(3,1),
    cvss_v3_vector TEXT,
    aliases TEXT[],                              -- CVE-xxxx, GHSA-xxxx
    fixed_version VARCHAR(100),
    affected_versions TEXT[],
    references_urls TEXT[],
    published_at TIMESTAMPTZ,
    modified_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_ecosystem ON intel_supply_chain_cache(package_ecosystem);
CREATE INDEX IF NOT EXISTS idx_supply_package ON intel_supply_chain_cache(package_name);
CREATE INDEX IF NOT EXISTS idx_supply_severity ON intel_supply_chain_cache(severity);
CREATE INDEX IF NOT EXISTS idx_supply_published ON intel_supply_chain_cache(published_at DESC);

-- 5. Sigma Detection Rules
CREATE TABLE IF NOT EXISTS intel_sigma_rules (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(200) UNIQUE NOT NULL,        -- UUID from Sigma repo
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(20),                          -- stable | experimental | deprecated
    author TEXT,
    level VARCHAR(20),                           -- low | medium | high | critical
    logsource_product VARCHAR(100),              -- windows | linux | aws | azure | okta | etc.
    logsource_service VARCHAR(100),
    logsource_category VARCHAR(100),
    tactic TEXT[],                               -- MITRE ATT&CK tactic
    technique_id TEXT[],                         -- TXXXX
    raw_rule_yaml TEXT NOT NULL,                 -- full Sigma YAML
    tags TEXT[],
    references_urls TEXT[],
    source_repo VARCHAR(100) DEFAULT 'SigmaHQ/sigma',
    file_path TEXT,                              -- path in the Sigma repo
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sigma_level ON intel_sigma_rules(level);
CREATE INDEX IF NOT EXISTS idx_sigma_product ON intel_sigma_rules(logsource_product);
CREATE INDEX IF NOT EXISTS idx_sigma_technique ON intel_sigma_rules USING GIN(technique_id);
CREATE INDEX IF NOT EXISTS idx_sigma_tactic ON intel_sigma_rules USING GIN(tactic);

-- 6. Dark Web Leak Site Monitor
CREATE TABLE IF NOT EXISTS intel_darknet_sources (
    id SERIAL PRIMARY KEY,
    source_key VARCHAR(200) UNIQUE NOT NULL,
    source_name VARCHAR(300) NOT NULL,
    onion_url TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL,            -- ransomware_blog | forum_public | paste | marketplace_watch | research_honeypot
    enabled BOOLEAN DEFAULT true,
    rate_limit_minutes INTEGER DEFAULT 1440,
    legal_basis TEXT,
    collection_policy TEXT,
    reliability_score INTEGER DEFAULT 50,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE intel_darknet_sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_darknet_sources_enabled ON intel_darknet_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_darknet_sources_type ON intel_darknet_sources(source_type);

CREATE TABLE IF NOT EXISTS intel_darknet_posts (
    id SERIAL PRIMARY KEY,
    post_uid VARCHAR(300) UNIQUE NOT NULL,       -- unique identifier (hash of source+content)
    source VARCHAR(100) NOT NULL,                -- ransomware blog / forum / market
    source_type VARCHAR(50),                     -- ransomware_blog | forum | market | telegram
    title TEXT,
    content TEXT,
    url TEXT,                                    -- .onion URL (informational)
    author TEXT,
    threat_actor VARCHAR(200),                   -- group or actor name
    victim_name VARCHAR(300),
    victim_sector VARCHAR(100),
    victim_country VARCHAR(100),
    leak_type VARCHAR(50),                       -- data_leak | ransom_note | auction | general
    severity VARCHAR(20),                        -- critical | high | medium | low
    tags TEXT[],
    discovered_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_darknet_source ON intel_darknet_posts(source);
CREATE INDEX IF NOT EXISTS idx_darknet_actor ON intel_darknet_posts(threat_actor);
CREATE INDEX IF NOT EXISTS idx_darknet_discovered ON intel_darknet_posts(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_darknet_severity ON intel_darknet_posts(severity);

-- 7. APT Campaign Timeline
CREATE TABLE IF NOT EXISTS intel_apt_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) UNIQUE NOT NULL,
    campaign_name VARCHAR(300) NOT NULL,
    threat_actor VARCHAR(200) NOT NULL,
    actor_aliases TEXT[],
    target_sectors TEXT[],
    target_countries TEXT[],
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    techniques TEXT[],                           -- MITRE technique IDs
    malware_families TEXT[],
    iocs TEXT[],
    cves TEXT[],
    references_urls TEXT[],
    confidence VARCHAR(20),                      -- confirmed | probable | possible
    source VARCHAR(200),                         -- attribution source
    first_reported TIMESTAMPTZ,
    last_updated TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apt_actor ON intel_apt_campaigns(threat_actor);
CREATE INDEX IF NOT EXISTS idx_apt_active ON intel_apt_campaigns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_apt_country ON intel_apt_campaigns USING GIN(target_countries);
CREATE INDEX IF NOT EXISTS idx_apt_sector ON intel_apt_campaigns USING GIN(target_sectors);

-- 8. Domain Typosquatting Detection
CREATE TABLE IF NOT EXISTS intel_typosquat_cache (
    id SERIAL PRIMARY KEY,
    original_domain VARCHAR(255) NOT NULL,
    variant_domain VARCHAR(255) NOT NULL,
    variant_type VARCHAR(50),                    -- homoglyph | omission | addition | substitution | tld_swap | prefix | suffix
    levenshtein_distance INTEGER,
    dns_resolves BOOLEAN DEFAULT false,
    resolved_ip VARCHAR(45),
    has_mx BOOLEAN DEFAULT false,
    has_ssl BOOLEAN DEFAULT false,
    is_malicious BOOLEAN DEFAULT false,
    risk_score INTEGER DEFAULT 0,                -- 0-100
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(original_domain, variant_domain)
);

CREATE INDEX IF NOT EXISTS idx_typo_original ON intel_typosquat_cache(original_domain);
CREATE INDEX IF NOT EXISTS idx_typo_malicious ON intel_typosquat_cache(is_malicious) WHERE is_malicious = true;
CREATE INDEX IF NOT EXISTS idx_typo_risk ON intel_typosquat_cache(risk_score DESC);

-- 9. GitHub Secret Exposure Scanner
CREATE TABLE IF NOT EXISTS intel_github_secrets (
    id SERIAL PRIMARY KEY,
    finding_id VARCHAR(200) UNIQUE NOT NULL,     -- hash of repo+path+line+secret_type
    repo_name VARCHAR(300) NOT NULL,
    repo_owner VARCHAR(200),
    file_path TEXT NOT NULL,
    line_number INTEGER,
    secret_type VARCHAR(50),                     -- api_key | aws_key | private_key | token | password | db_connection | jwt_secret
    snippet_hash VARCHAR(64),                    -- SHA256 of the redacted snippet
    redacted_snippet TEXT,                       -- snippet with secret masked
    is_public BOOLEAN DEFAULT true,
    discovered_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    still_exposed BOOLEAN DEFAULT true,
    risk_level VARCHAR(20),                      -- critical | high | medium | low
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gh_secret_repo ON intel_github_secrets(repo_name);
CREATE INDEX IF NOT EXISTS idx_gh_secret_type ON intel_github_secrets(secret_type);
CREATE INDEX IF NOT EXISTS idx_gh_secret_risk ON intel_github_secrets(risk_level);
CREATE INDEX IF NOT EXISTS idx_gh_secret_exposed ON intel_github_secrets(still_exposed) WHERE still_exposed = true;

-- 10. YARA Rule Repository
CREATE TABLE IF NOT EXISTS intel_yara_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(300) UNIQUE NOT NULL,
    description TEXT,
    author TEXT,
    category VARCHAR(100),                       -- malware | ransomware | apt | rat | stealer | exploit | generic
    severity VARCHAR(20),                        -- low | medium | high | critical
    target_family TEXT[],                        -- malware family names
    mitre_techniques TEXT[],                     -- ATT&CK T-codes
    raw_rule TEXT NOT NULL,                      -- full YARA rule content
    references_urls TEXT[],
    tags TEXT[],
    source_repo VARCHAR(200),                    -- YARA rule collection source
    file_path TEXT,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yara_category ON intel_yara_rules(category);
CREATE INDEX IF NOT EXISTS idx_yara_severity ON intel_yara_rules(severity);
CREATE INDEX IF NOT EXISTS idx_yara_family ON intel_yara_rules USING GIN(target_family);
CREATE INDEX IF NOT EXISTS idx_yara_technique ON intel_yara_rules USING GIN(mitre_techniques);

-- Add API key tracking for new services
INSERT INTO intel_api_key_config (key_name, is_configured, note) VALUES
  ('GITHUB_TOKEN',         false, 'Free: 60 req/hr unauthenticated, 5000 with token - https://github.com/settings/tokens'),
  ('URLSCAN_API_KEY',      false, 'Free tier available - https://urlscan.io'),
  ('SECURITYTRAILS_KEY',   false, 'Free tier: 50 queries/month - https://securitytrails.com'),
  ('ALIENVAULT_OTX_KEY',   false, 'Free unlimited - https://otx.alienvault.com')
ON CONFLICT (key_name) DO NOTHING;

-- 11. Unified Intel Source Registry and Scraper Runs
CREATE TABLE IF NOT EXISTS intel_sources (
    id SERIAL PRIMARY KEY,
    source_key VARCHAR(120) UNIQUE NOT NULL,
    source_name VARCHAR(250) NOT NULL,
    source_type VARCHAR(80) NOT NULL,
    endpoint TEXT,
    enabled BOOLEAN DEFAULT true,
    trust_score INTEGER DEFAULT 70,
    rate_limit_minutes INTEGER DEFAULT 60,
    collection_policy TEXT,
    tenant_scope VARCHAR(80) DEFAULT 'global',
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intel_scraper_runs (
    id SERIAL PRIMARY KEY,
    source_key VARCHAR(120) NOT NULL,
    status VARCHAR(40) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    fetched_count INTEGER DEFAULT 0,
    stored_count INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE intel_sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
UPDATE intel_sources SET enabled = COALESCE(is_enabled, true) WHERE enabled IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'intel_sources' AND column_name = 'is_enabled'
);

CREATE INDEX IF NOT EXISTS idx_intel_sources_enabled ON intel_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_intel_scraper_runs_source ON intel_scraper_runs(source_key, started_at DESC);
