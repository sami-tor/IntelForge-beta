import { query } from "@/lib/db"

export async function ensureScraperRunTables() {
  await query(`CREATE TABLE IF NOT EXISTS intel_sources (
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
  )`, [])

  await query(`CREATE TABLE IF NOT EXISTS intel_scraper_runs (
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
  )`, [])
}

export async function logScraperRun(input: {
  sourceKey: string
  status: "running" | "success" | "failed" | "skipped"
  fetched?: number
  stored?: number
  error?: string
  durationMs?: number
  metadata?: Record<string, any>
}) {
  await ensureScraperRunTables()
  await query(
    `INSERT INTO intel_scraper_runs (source_key, status, finished_at, fetched_count, stored_count, error_message, duration_ms, metadata)
     VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7::jsonb)`,
    [
      input.sourceKey,
      input.status,
      input.fetched || 0,
      input.stored || 0,
      input.error || null,
      input.durationMs || 0,
      JSON.stringify(input.metadata || {}),
    ],
  )

  if (input.status === "success") {
    await query(
      `UPDATE intel_sources SET last_success_at = NOW(), last_error = NULL, updated_at = NOW() WHERE source_key = $1`,
      [input.sourceKey],
    )
  }

  if (input.status === "failed") {
    await query(
      `UPDATE intel_sources SET last_error = $2, updated_at = NOW() WHERE source_key = $1`,
      [input.sourceKey, input.error || "Unknown scraper failure"],
    )
  }
}
