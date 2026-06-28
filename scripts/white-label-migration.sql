-- White-Label / Tenant Branding & Reseller System

CREATE TABLE IF NOT EXISTS tenant_branding (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) UNIQUE,
    user_id         INTEGER REFERENCES users(id),          -- For individual white-label (non-org)
    -- Branding
    company_name    VARCHAR(255),
    logo_url        TEXT,
    favicon_url     TEXT,
    primary_color   VARCHAR(7) DEFAULT '#DC2626',           -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#1F2937',
    accent_color    VARCHAR(7) DEFAULT '#3B82F6',
    -- Custom CSS
    custom_css      TEXT,
    -- White-label mode
    hide_intelforge_branding BOOLEAN DEFAULT false,
    hide_powered_by BOOLEAN DEFAULT false,
    -- Custom domain
    custom_domain   VARCHAR(255) UNIQUE,
    domain_verified BOOLEAN DEFAULT false,
    domain_verification_token VARCHAR(128),
    -- Login page customization
    login_title     VARCHAR(255),
    login_subtitle  TEXT,
    login_bg_url    TEXT,
    -- Email
    email_from_name VARCHAR(255),
    email_footer_text TEXT,
    -- Reseller
    is_reseller     BOOLEAN DEFAULT false,
    reseller_commission_percent INTEGER DEFAULT 0,
    parent_reseller_id INTEGER REFERENCES tenant_branding(id),
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_clients (
    id              SERIAL PRIMARY KEY,
    reseller_branding_id INTEGER NOT NULL REFERENCES tenant_branding(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id),
    client_name     VARCHAR(255) NOT NULL,
    client_email    VARCHAR(255),
    subscription_plan VARCHAR(100),
    monthly_revenue DECIMAL(10,2),
    commission_earned DECIMAL(10,2) DEFAULT 0,
    status          VARCHAR(50) DEFAULT 'active',  -- 'active','inactive','trial','cancelled'
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_org ON tenant_branding(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_domain ON tenant_branding(custom_domain);
CREATE INDEX IF NOT EXISTS idx_reseller_clients_reseller ON reseller_clients(reseller_branding_id);
