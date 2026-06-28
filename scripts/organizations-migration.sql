-- Organizations & Multi-Tenancy
-- Enables team/org management, data scoping, and RBAC within organizations

CREATE TABLE IF NOT EXISTS organizations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    logo_url        TEXT,
    website         VARCHAR(500),
    industry        VARCHAR(100),
    size            VARCHAR(50),           -- '1-10','11-50','51-200','201-1000','1000+'
    billing_email   VARCHAR(255),
    settings        JSONB DEFAULT '{}',     -- org-wide feature flags, defaults
    is_active       BOOLEAN DEFAULT true,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL DEFAULT 'member',  -- 'owner','admin','member','viewer'
    invited_by      INTEGER REFERENCES users(id),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    invited_at      TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'member',
    token           VARCHAR(128) NOT NULL UNIQUE,
    invited_by      INTEGER NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- Add current_org_id to users so they can switch active org
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_org_id INTEGER REFERENCES organizations(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
