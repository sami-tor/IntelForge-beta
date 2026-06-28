-- External Integrations: Webhooks, MISP, SIEM, Notifications

CREATE TABLE IF NOT EXISTS webhooks (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    organization_id INTEGER REFERENCES organizations(id),
    name            VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,
    secret          VARCHAR(255),
    events          TEXT[] NOT NULL DEFAULT '{}',   -- e.g. '{search.completed,alert.created,case.updated}'
    is_active       BOOLEAN DEFAULT true,
    last_triggered  TIMESTAMPTZ,
    failure_count   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id              SERIAL PRIMARY KEY,
    webhook_id      INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event           VARCHAR(100) NOT NULL,
    request_body    JSONB,
    response_code   INTEGER,
    response_body   TEXT,
    duration_ms     INTEGER,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS integration_configs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    organization_id INTEGER REFERENCES organizations(id),
    integration_type VARCHAR(50) NOT NULL,  -- 'misp','siem','slack','teams','splunk','elastic'
    name            VARCHAR(255),
    config          JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    last_tested     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(organization_id);
