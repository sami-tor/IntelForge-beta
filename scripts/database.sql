-- ================================================
-- Intel Forge Complete Database Schema
-- Consolidated from all migration scripts
-- ================================================
-- This is the single source of truth for the database schema
-- Import this file to set up a fresh database

-- ================================================
-- 1. DROP EXISTING TABLES (for clean import)
-- ================================================

DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS contact_messages CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS extracted_data CASCADE;
DROP TABLE IF EXISTS uploaded_files CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS api_key_usage CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS search_logs CASCADE;
DROP TABLE IF EXISTS search_directories CASCADE;
DROP TABLE IF EXISTS osint_raw_data CASCADE;
DROP TABLE IF EXISTS osint_directories CASCADE;
DROP TABLE IF EXISTS osint_credentials CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS login_alerts CASCADE;
DROP TABLE IF EXISTS search_quotas CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS smtp_settings CASCADE;
DROP TABLE IF EXISTS search_index CASCADE;
DROP TABLE IF EXISTS search_index_lines CASCADE;
DROP TABLE IF EXISTS file_index CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_monthly_quota CASCADE;
DROP TABLE IF EXISTS login_activity CASCADE;
DROP TABLE IF EXISTS billing_records CASCADE;
DROP TABLE IF EXISTS ip_lock_policies CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS security_audit_logs CASCADE;
DROP TABLE IF EXISTS two_factor_sessions CASCADE;
DROP TABLE IF EXISTS monitoring_alerts CASCADE;
DROP TABLE IF EXISTS monitored_items CASCADE;
DROP TABLE IF EXISTS intel_jobs CASCADE;
DROP TABLE IF EXISTS intel_sources CASCADE;
DROP TABLE IF EXISTS intel_entities CASCADE;
DROP TABLE IF EXISTS intel_findings CASCADE;
DROP TABLE IF EXISTS intel_relationships CASCADE;
DROP TABLE IF EXISTS intel_cases CASCADE;
DROP TABLE IF EXISTS intel_reports CASCADE;
DROP TABLE IF EXISTS intel_case_items CASCADE;

-- Drop views and functions
DROP VIEW IF EXISTS user_permissions CASCADE;
DROP FUNCTION IF EXISTS clean_expired_sessions() CASCADE;
DROP FUNCTION IF EXISTS is_premium_user(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_user_search_limit(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_search_vector() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_security_logs() CASCADE;

-- ================================================
-- 2. CORE TABLES
-- ================================================

-- Users table with all fields
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    verification_status VARCHAR(20) DEFAULT 'pending',
    subscription_type VARCHAR(50) DEFAULT 'free' CHECK (
        subscription_type IS NULL OR 
        subscription_type IN ('free', 'starter', 'professional', 'enterprise', 'api_access')
    ),
    subscription_start DATE,
    subscription_end DATE,
    subscription_duration_value INTEGER,
    subscription_duration_unit VARCHAR(20),
    is_lifetime BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    search_count INTEGER DEFAULT 0,
    search_limit INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Sessions table for authentication (with security columns)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search index table for storing indexed file metadata
CREATE TABLE search_index (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(512) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    line_count INTEGER,
    file_type TEXT,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search index lines table (line-by-line indexing for fast search)
CREATE TABLE search_index_lines (
    id BIGSERIAL PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT,
    file_type TEXT,
    country TEXT,
    indexed_at TIMESTAMP DEFAULT NOW(),
    search_vector tsvector
);

-- User Monthly Quota tracking
CREATE TABLE user_monthly_quota (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL,
    searches_used INTEGER DEFAULT 0,
    results_viewed INTEGER DEFAULT 0,
    last_search TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, year_month)
);

-- Search history table
CREATE TABLE search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    search_type VARCHAR(50),
    results_count INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search logs table for tracking searches (admin panel)
CREATE TABLE search_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(255),
    user_type VARCHAR(50) DEFAULT 'free',
    search_type VARCHAR(20) DEFAULT 'web',
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded files table
CREATE TABLE uploaded_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    upload_path TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted data table (from ZIP files)
CREATE TABLE extracted_data (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES uploaded_files(id) ON DELETE CASCADE,
    data_type VARCHAR(100),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    monthly_search_limit INTEGER,
    data_sources TEXT[],
    support_level VARCHAR(100),
    user_limit INTEGER,
    api_access BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions table
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'active',
    searches_used INTEGER DEFAULT 0,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table (legacy)
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_value INTEGER,
    duration_unit VARCHAR(20),
    is_lifetime BOOLEAN DEFAULT false,
    search_limit INTEGER DEFAULT 50,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMTP settings table
CREATE TABLE smtp_settings (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    secure BOOLEAN DEFAULT true,
    from_email VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table (consolidated schema)
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key VARCHAR(255) UNIQUE,
    name VARCHAR(100),
    label VARCHAR(150),
    allowed_ips TEXT[],
    is_active BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 100,
    last_used TIMESTAMP,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API key usage tracking
CREATE TABLE api_key_usage (
    id SERIAL PRIMARY KEY,
    key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255),
    status INTEGER,
    ip_address VARCHAR(45),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search quotas table
CREATE TABLE search_quotas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    searches_used INTEGER DEFAULT 0,
    search_limit INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login alerts table
CREATE TABLE login_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_info VARCHAR(255),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alerted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    resolved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP
);

-- Login activity tracking
CREATE TABLE login_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device VARCHAR(255),
    status VARCHAR(20) DEFAULT 'success',
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact/Feedback table
CREATE TABLE contact_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    message_type VARCHAR(50) CHECK (message_type IN ('feedback', 'contact', 'deletion_request')),
    ip_address VARCHAR(45),
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('pending', 'reviewed', 'resolved', 'rejected', 'unread')),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- Admin activity log
CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OSINT Credentials table
CREATE TABLE osint_credentials (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255),
    username VARCHAR(255),
    password VARCHAR(255),
    domain VARCHAR(255),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OSINT Directories table
CREATE TABLE osint_directories (
    id SERIAL PRIMARY KEY,
    directory TEXT,
    ip VARCHAR(45),
    url VARCHAR(255),
    username VARCHAR(255),
    password VARCHAR(255),
    domain VARCHAR(255),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OSINT Raw Data table
CREATE TABLE osint_raw_data (
    id SERIAL PRIMARY KEY,
    raw_data TEXT,
    data_type VARCHAR(100),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search directories used by file scanning
CREATE TABLE search_directories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billing records table
CREATE TABLE billing_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    amount DECIMAL(10, 2) NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    invoice_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IP lock policies table
CREATE TABLE ip_lock_policies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    locked_ip VARCHAR(45) NOT NULL,
    allow_new_ips BOOLEAN DEFAULT false,
    require_approval BOOLEAN DEFAULT true,
    notify_on_new_ip BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security logs table
CREATE TABLE security_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security audit logs table
CREATE TABLE security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_event_id UNIQUE (id)
);

-- Two-factor authentication sessions table
CREATE TABLE two_factor_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Monitored Items table (CTI watchlist entities)
CREATE TABLE monitored_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(40) NOT NULL CHECK (item_type IN ('email', 'domain', 'ip', 'url', 'keyword', 'brand', 'phone', 'username', 'crypto_wallet')),
    item_value VARCHAR(500) NOT NULL,
    verification_code VARCHAR(64),
    verification_expires TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP,
    last_found TIMESTAMP,
    found_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_value)
);

-- Monitoring Alerts table
CREATE TABLE monitoring_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monitored_item_id INTEGER NOT NULL REFERENCES monitored_items(id) ON DELETE CASCADE,
    intel_finding_id BIGINT,
    intel_entity_id BIGINT,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('breach_detected', 'new_exposure', 'domain_found', 'email_found', 'watchlist_match', 'risk_increase')),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    confidence INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_info JSONB,
    evidence_preview TEXT,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    source_count INTEGER DEFAULT 1,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- CTI source registry
CREATE TABLE intel_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL DEFAULT 'indexed_data',
    reliability INTEGER DEFAULT 60 CHECK (reliability BETWEEN 0 AND 100),
    is_enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canonical intelligence entities
CREATE TABLE intel_entities (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(40) NOT NULL CHECK (entity_type IN ('email', 'domain', 'ip', 'url', 'phone', 'username', 'crypto_wallet', 'keyword', 'brand', 'unknown')),
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    confidence INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, normalized_value)
);

-- Normalized intelligence findings
CREATE TABLE intel_findings (
    id BIGSERIAL PRIMARY KEY,
    finding_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    confidence INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
    title TEXT NOT NULL,
    description TEXT,
    source_name VARCHAR(150),
    source_type VARCHAR(50),
    raw_reference JSONB DEFAULT '{}'::jsonb,
    evidence JSONB DEFAULT '{}'::jsonb,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    fingerprint TEXT UNIQUE,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entity and finding relationships
CREATE TABLE intel_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_entity_id BIGINT REFERENCES intel_entities(id) ON DELETE CASCADE,
    target_entity_id BIGINT REFERENCES intel_entities(id) ON DELETE CASCADE,
    finding_id BIGINT REFERENCES intel_findings(id) ON DELETE CASCADE,
    relationship_type VARCHAR(60) NOT NULL,
    weight INTEGER DEFAULT 50 CHECK (weight BETWEEN 0 AND 100),
    evidence JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_entity_id, target_entity_id, finding_id, relationship_type)
);

-- Analyst cases
CREATE TABLE intel_cases (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    summary TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case links to findings/entities/alerts
CREATE TABLE intel_case_items (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL REFERENCES intel_cases(id) ON DELETE CASCADE,
    entity_id BIGINT REFERENCES intel_entities(id) ON DELETE SET NULL,
    finding_id BIGINT REFERENCES intel_findings(id) ON DELETE SET NULL,
    alert_id INTEGER REFERENCES monitoring_alerts(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated reports
CREATE TABLE intel_reports (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    case_id BIGINT REFERENCES intel_cases(id) ON DELETE SET NULL,
    entity_id BIGINT REFERENCES intel_entities(id) ON DELETE SET NULL,
    report_type VARCHAR(60) NOT NULL,
    title TEXT NOT NULL,
    body JSONB NOT NULL,
    html TEXT,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Durable internal jobs
CREATE TABLE intel_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(60) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    cursor_value TEXT,
    stats JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 3. INDEXES
-- ================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_active ON users(email, is_active) WHERE is_active = true;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_role_active ON users(role) WHERE is_active = true;
CREATE INDEX idx_users_verification ON users(verification_status);
CREATE INDEX idx_users_subscription_type ON users(subscription_type);
CREATE INDEX idx_users_last_login ON users(last_login DESC);
CREATE INDEX idx_users_active_subscription ON users(is_active, subscription_type, subscription_end);
CREATE INDEX idx_users_role_subscription ON users(role, subscription_type);

-- Sessions indexes
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_token_expires ON sessions(session_token, expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_ip_address ON sessions(ip_address);
CREATE INDEX idx_sessions_user_agent ON sessions(user_agent);

-- Search index indexes
CREATE INDEX idx_search_index_file_name ON search_index(file_name);
CREATE INDEX idx_search_index_indexed_at ON search_index(indexed_at DESC);
CREATE INDEX idx_search_index_file_type ON search_index(file_type);
CREATE INDEX idx_search_index_created ON search_index(created_at DESC);

-- Search index lines indexes
CREATE INDEX idx_search_index_lines_file_path ON search_index_lines(file_path);
CREATE INDEX idx_search_index_lines_file_name ON search_index_lines(file_name);
CREATE INDEX idx_search_index_lines_file_name_lower ON search_index_lines(LOWER(file_name));
CREATE INDEX idx_search_index_lines_file_line ON search_index_lines(file_path, line_number);
CREATE INDEX idx_search_index_lines_file_path_line ON search_index_lines(file_path, line_number);
CREATE INDEX idx_content_hash ON search_index_lines(content_hash);
CREATE INDEX idx_search_index_lines_country ON search_index_lines(country);
CREATE INDEX idx_search_index_lines_country_lower ON search_index_lines(LOWER(country));
CREATE INDEX idx_search_index_lines_file_type ON search_index_lines(file_type);
CREATE INDEX idx_search_index_lines_indexed_at ON search_index_lines(indexed_at DESC);
CREATE INDEX idx_search_vector ON search_index_lines USING GIN(search_vector);
CREATE INDEX idx_search_lines_fts ON search_index_lines USING gin(search_vector);

-- User monthly quota indexes
CREATE INDEX idx_quota_user_month ON user_monthly_quota(user_id, year_month);
CREATE INDEX idx_quota_user ON user_monthly_quota(user_id);
CREATE INDEX idx_monthly_quota_user_month ON user_monthly_quota(user_id, year_month);

-- Search history indexes
CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_user_created ON search_history(user_id, created_at DESC);
CREATE INDEX idx_search_history_created ON search_history(created_at DESC);

-- Search logs indexes
CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_user_created ON search_logs(user_id, created_at DESC);
CREATE INDEX idx_search_logs_query ON search_logs(search_query);
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);
CREATE INDEX idx_search_logs_user_type ON search_logs(user_type);
CREATE INDEX idx_search_logs_search_type ON search_logs(search_type);

-- Uploaded files indexes
CREATE INDEX idx_uploaded_files_user ON uploaded_files(user_id);
CREATE INDEX idx_uploaded_files_user_created ON uploaded_files(user_id, created_at DESC);
CREATE INDEX idx_uploaded_files_status ON uploaded_files(status);

-- Extracted data indexes
CREATE INDEX idx_extracted_data_file ON extracted_data(file_id);

-- API keys indexes
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_key ON api_keys(api_key);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_user_active ON api_keys(user_id, is_active);
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used DESC);

-- API key usage indexes
CREATE INDEX idx_usage_key ON api_key_usage(key_id);
CREATE INDEX idx_usage_user ON api_key_usage(user_id);
CREATE INDEX idx_usage_time ON api_key_usage(used_at DESC);

-- Contact messages indexes
CREATE INDEX idx_contact_status ON contact_messages(status);
CREATE INDEX idx_contact_messages_status ON contact_messages(status, created_at DESC);
CREATE INDEX idx_contact_messages_type ON contact_messages(message_type);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_email ON contact_messages(email);

-- Admin logs indexes
CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);

-- OSINT tables indexes
CREATE INDEX idx_osint_credentials_url ON osint_credentials(url);
CREATE INDEX idx_osint_credentials_domain ON osint_credentials(domain);
CREATE INDEX idx_osint_credentials_username ON osint_credentials(username);
CREATE INDEX idx_osint_directories_ip ON osint_directories(ip);
CREATE INDEX idx_osint_directories_domain ON osint_directories(domain);
CREATE INDEX idx_osint_directories_url ON osint_directories(url);
CREATE INDEX idx_osint_raw_data_type ON osint_raw_data(data_type);

-- Search directories indexes
CREATE INDEX idx_search_directories_active ON search_directories(is_active);

-- Login activity indexes
CREATE INDEX idx_login_activity_user ON login_activity(user_id);
CREATE INDEX idx_login_activity_status ON login_activity(status);
CREATE INDEX idx_login_activity_created ON login_activity(created_at DESC);
CREATE INDEX idx_login_user ON login_activity(user_id);
CREATE INDEX idx_login_status ON login_activity(status);
CREATE INDEX idx_login_created ON login_activity(created_at DESC);

-- Login alerts indexes
CREATE INDEX idx_login_alerts_user ON login_alerts(user_id);
CREATE INDEX idx_alerts_user ON login_alerts(user_id);
CREATE INDEX idx_alerts_status ON login_alerts(status);

-- Billing records indexes
CREATE INDEX idx_billing_user ON billing_records(user_id);
CREATE INDEX idx_billing_status ON billing_records(status);
CREATE INDEX idx_billing_paid_at ON billing_records(paid_at DESC);

-- IP lock policies indexes
CREATE INDEX idx_ip_lock_user ON ip_lock_policies(user_id);

-- Security logs indexes
CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX idx_security_logs_ip_address ON security_logs(ip_address);

-- Security audit logs indexes
CREATE INDEX idx_security_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_severity ON security_audit_logs(severity);
CREATE INDEX idx_security_audit_created_at ON security_audit_logs(created_at DESC);
CREATE INDEX idx_security_audit_ip_address ON security_audit_logs(ip_address);
CREATE INDEX idx_security_audit_user_severity ON security_audit_logs(user_id, severity, created_at DESC);
CREATE INDEX idx_security_audit_user ON security_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_security_audit_severity_created ON security_audit_logs(severity, created_at DESC);
CREATE INDEX idx_security_audit_event_type_created ON security_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_security_audit_created ON security_audit_logs(created_at DESC);

-- Two-factor sessions indexes
CREATE INDEX idx_two_factor_sessions_user_id ON two_factor_sessions(user_id);
CREATE INDEX idx_two_factor_sessions_expires_at ON two_factor_sessions(expires_at);

-- Monitored items indexes
CREATE INDEX idx_monitored_items_user ON monitored_items(user_id);
CREATE INDEX idx_monitored_items_user_type ON monitored_items(user_id, item_type);
CREATE INDEX idx_monitored_items_value ON monitored_items(item_value);
CREATE INDEX idx_monitored_items_verified ON monitored_items(is_verified, is_active);
CREATE INDEX idx_monitored_items_last_checked ON monitored_items(last_checked);

-- Monitoring alerts indexes
CREATE INDEX idx_monitoring_alerts_user ON monitoring_alerts(user_id);
CREATE INDEX idx_monitoring_alerts_item ON monitoring_alerts(monitored_item_id);
CREATE INDEX idx_monitoring_alerts_unread ON monitoring_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_monitoring_alerts_created ON monitoring_alerts(created_at DESC);
CREATE INDEX idx_monitoring_alerts_severity ON monitoring_alerts(severity);


-- CTI intelligence indexes
CREATE INDEX idx_intel_sources_type ON intel_sources(source_type);
CREATE INDEX idx_intel_sources_enabled ON intel_sources(is_enabled);
CREATE INDEX idx_intel_entities_type ON intel_entities(entity_type);
CREATE INDEX idx_intel_entities_value_trgm ON intel_entities USING gin(normalized_value gin_trgm_ops);
CREATE INDEX idx_intel_entities_risk ON intel_entities(risk_score DESC);
CREATE INDEX idx_intel_entities_seen ON intel_entities(last_seen DESC);
CREATE INDEX idx_intel_findings_type ON intel_findings(finding_type);
CREATE INDEX idx_intel_findings_severity ON intel_findings(severity);
CREATE INDEX idx_intel_findings_risk ON intel_findings(risk_score DESC);
CREATE INDEX idx_intel_findings_seen ON intel_findings(last_seen DESC);
CREATE INDEX idx_intel_findings_title_trgm ON intel_findings USING gin(title gin_trgm_ops);
CREATE INDEX idx_intel_relationships_source ON intel_relationships(source_entity_id);
CREATE INDEX idx_intel_relationships_target ON intel_relationships(target_entity_id);
CREATE INDEX idx_intel_relationships_finding ON intel_relationships(finding_id);
CREATE INDEX idx_intel_cases_user ON intel_cases(user_id);
CREATE INDEX idx_intel_cases_status ON intel_cases(status);
CREATE INDEX idx_intel_cases_created ON intel_cases(created_at DESC);
CREATE INDEX idx_intel_case_items_case ON intel_case_items(case_id);
CREATE INDEX idx_intel_reports_user ON intel_reports(user_id);
CREATE INDEX idx_intel_reports_case ON intel_reports(case_id);
CREATE INDEX idx_intel_jobs_type_status ON intel_jobs(job_type, status);
CREATE INDEX idx_intel_jobs_created ON intel_jobs(created_at DESC);

-- Subscription plans indexes
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);

-- User subscriptions indexes
CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);

-- Search quotas indexes
CREATE INDEX idx_search_quotas_user ON search_quotas(user_id);

-- ================================================
-- 4. FUNCTIONS
-- ================================================

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions() RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is premium
CREATE OR REPLACE FUNCTION is_premium_user(user_id INTEGER) 
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT role, subscription_type, is_lifetime 
  INTO user_record
  FROM users 
  WHERE id = user_id;
  
  IF user_record.role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  IF user_record.is_lifetime = TRUE THEN
    RETURN TRUE;
  END IF;
  
  IF user_record.subscription_type IN ('starter', 'professional', 'enterprise') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get user search limit
CREATE OR REPLACE FUNCTION get_user_search_limit(user_id INTEGER) 
RETURNS INTEGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT role, subscription_type, is_lifetime, search_limit 
  INTO user_record
  FROM users 
  WHERE id = user_id;
  
  IF user_record.role = 'admin' THEN
    RETURN -1;
  END IF;
  
  RETURN COALESCE(user_record.search_limit, 50);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update search_vector
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old security logs
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM security_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 5. TRIGGERS
-- ================================================

-- Trigger to auto-update search_vector
CREATE TRIGGER trigger_update_search_vector
    BEFORE INSERT OR UPDATE ON search_index_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- ================================================
-- 6. VIEWS
-- ================================================

-- User permissions view
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
  u.id,
  u.email,
  u.username,
  u.role,
  u.subscription_type,
  u.is_lifetime,
  u.search_limit,
  u.search_count,
  u.verification_status,
  u.is_active,
  CASE 
    WHEN u.role = 'admin' THEN TRUE
    ELSE FALSE
  END AS is_admin,
  CASE 
    WHEN u.role = 'admin' THEN TRUE
    WHEN u.is_lifetime = TRUE THEN TRUE
    WHEN u.subscription_type IN ('starter', 'professional', 'enterprise') THEN TRUE
    ELSE FALSE
  END AS is_premium,
  CASE 
    WHEN u.role = 'admin' THEN TRUE
    WHEN u.is_lifetime = TRUE THEN TRUE
    WHEN u.subscription_type IN ('starter', 'professional', 'enterprise') THEN TRUE
    ELSE FALSE
  END AS can_generate_api_keys,
  CASE 
    WHEN u.role = 'admin' THEN -1
    WHEN u.search_limit IS NOT NULL THEN u.search_limit
    WHEN u.subscription_type = 'enterprise' THEN -1
    WHEN u.subscription_type = 'professional' THEN 1500
    WHEN u.subscription_type = 'starter' THEN 500
    ELSE 50
  END AS effective_search_limit,
  CASE 
    WHEN u.role = 'admin' THEN 'Administrator'
    WHEN u.is_lifetime = TRUE THEN 'Premium User'
    WHEN u.subscription_type IN ('starter', 'professional', 'enterprise') THEN 'Premium User'
    ELSE 'Free User'
  END AS display_role,
  CASE 
    WHEN u.role = 'admin' THEN 'admin_access'
    WHEN u.subscription_type = 'enterprise' THEN 'Enterprise'
    WHEN u.subscription_type = 'professional' THEN 'Professional'
    WHEN u.subscription_type = 'starter' THEN 'Starter'
    ELSE 'Free'
  END AS display_subscription
FROM users u;

-- ================================================
-- 7. DEFAULT DATA
-- ================================================

-- Insert default admin user (CHANGE PASSWORD AFTER FIRST LOGIN)
-- Bcrypt hash — rotate in production
INSERT INTO users (
    email, 
    password_hash, 
    username, 
    role, 
    verification_status, 
    subscription_type, 
    is_lifetime, 
    search_limit
) VALUES (
    'admin@intelforge.com', 
    '$2a$12$KHubqvfDuG.c1rUADz3Df.VBjCjqjKwuFazUAUMhOdrmyl7OBtVgS', 
    'admin', 
    'admin', 
    'verified', 
    NULL, 
    true, 
    -1
)
ON CONFLICT (email) 
DO UPDATE SET
    role = 'admin',
    subscription_type = NULL,
    is_lifetime = true,
    search_limit = -1,
    verification_status = 'verified',
    is_active = true;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price, monthly_search_limit, data_sources, support_level, user_limit, api_access, sort_order) VALUES
('Starter', 'Starter plan with limited sources', 50.00, 500, ARRAY['logs','ulp','stealer'], 'Email support', 1, false, 1),
('Security Analyst / Cyber Expert', 'Full analyst access without API', 300.00, 1500, ARRAY['all'], 'Priority support', 1, false, 2),
('API Access Fair', 'Unlimited users with full API access', 1499.00, NULL, ARRAY['all','custom'], '24/7 dedicated support', NULL, true, 3)
ON CONFLICT DO NOTHING;

-- Insert SMTP settings
INSERT INTO smtp_settings (host, port, username, password, secure, from_email) VALUES
('mail.osintsearch.online', 465, 'sender@osintsearch.online', 'StrongPass#ChangeMe', true, 'sender@osintsearch.online')
ON CONFLICT DO NOTHING;

-- Insert default subscriptions
INSERT INTO subscriptions (name, description, price, duration_value, duration_unit, search_limit, features) VALUES
('Free', 'Basic access to Intel Forge', 0.00, NULL, NULL, 50, '["50 searches/month", "Basic data extraction", "Community support"]'),
('Pro', 'Professional OSINT tools', 29.99, 1, 'month', 1000, '["1000 searches/month", "Advanced data extraction", "Priority support", "API access"]'),
('Enterprise', 'Full enterprise features', 99.99, 1, 'month', 10000, '["10000 searches/month", "Everything in Pro", "Custom integrations", "Dedicated support", "Team collaboration"]'),
('Lifetime', 'One-time payment for lifetime access', 499.99, NULL, NULL, 999999, '["Unlimited searches", "Everything in Enterprise", "Lifetime updates", "VIP support"]')
ON CONFLICT DO NOTHING;

-- ================================================
-- 8. COMMENTS
-- ================================================

COMMENT ON TABLE api_keys IS 'Stores API keys for premium users with rate limiting';
COMMENT ON COLUMN api_keys.api_key IS 'API key string';
COMMENT ON COLUMN api_keys.rate_limit IS 'Requests per minute allowed for this key';
COMMENT ON COLUMN api_keys.expires_at IS 'When the key expires (NULL = never)';
COMMENT ON TABLE security_logs IS 'Audit trail for security events';
COMMENT ON COLUMN security_logs.event_type IS 'Type of security event (login_failed, rate_limit_exceeded, etc.)';
COMMENT ON COLUMN security_logs.details IS 'JSON details about the event';
COMMENT ON TABLE search_index_lines IS 'Stores every line from every file for instant search';
COMMENT ON COLUMN search_index_lines.content IS 'The actual line content';
COMMENT ON COLUMN search_index_lines.content_hash IS 'MD5 hash for deduplication';
COMMENT ON COLUMN search_index_lines.search_vector IS 'PostgreSQL full-text search vector';
COMMENT ON COLUMN search_logs.user_type IS 'User subscription type: free, premium, api, starter, professional, enterprise';
COMMENT ON COLUMN search_logs.search_type IS 'Search method: web (website), api (API key)';
COMMENT ON TABLE contact_messages IS 'Stores user feedback, contact messages, and deletion requests';
COMMENT ON COLUMN contact_messages.message_type IS 'Type: feedback, contact, or deletion_request';
COMMENT ON COLUMN contact_messages.status IS 'Status: pending, reviewed, resolved, or rejected';

-- ================================================
-- 9. ANALYZE TABLES
-- ================================================

ANALYZE users;
ANALYZE sessions;
ANALYZE search_index;
ANALYZE search_index_lines;
ANALYZE search_history;
ANALYZE search_logs;
ANALYZE security_audit_logs;
ANALYZE api_keys;
ANALYZE monitored_items;
ANALYZE monitoring_alerts;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ Intel Forge Database Schema Created Successfully!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Default Admin User:';
  RAISE NOTICE '   Email: admin@intelforge.com';
  RAISE NOTICE '   Password: admin123 (CHANGE THIS!)';
  RAISE NOTICE '   Role: admin';
  RAISE NOTICE '   Search Limit: Unlimited (-1)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All tables, indexes, functions, and views created';
  RAISE NOTICE '✅ Default data inserted';
  RAISE NOTICE '';
END $$;

