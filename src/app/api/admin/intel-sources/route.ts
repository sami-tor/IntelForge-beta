import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"

const DEFAULT_SOURCES = [
  ["news", "Cyber News", "rss", "https://feeds.feedburner.com/TheHackersNews", true, 80, 30, "CTI news ingestion"],
  ["cve", "CVE Database", "api", "https://services.nvd.nist.gov/rest/json/cves/2.0", true, 95, 360, "Vulnerability intelligence"],
  ["malware", "Malware Intelligence", "api", "https://mb-api.abuse.ch/api/v1/", true, 85, 60, "Malware metadata and IOC collection"],
  ["ransomware", "Ransomware Intelligence", "api", "internal:ransomware", true, 85, 60, "Ransomware groups and victims"],
  ["phishing", "Phishing Intelligence", "api", "internal:phishing", true, 80, 30, "Phishing URL intelligence"],
  ["exploit", "Exploit Intelligence", "api", "internal:exploit", true, 80, 360, "Public exploit metadata"],
  ["cert", "Certificate Transparency", "api", "https://crt.sh", true, 75, 360, "Certificate and domain discovery"],
  ["supply_chain", "Supply Chain Intelligence", "api", "https://api.osv.dev", true, 90, 360, "Package vulnerability intelligence"],
  ["sigma", "Sigma Rules", "git", "https://github.com/SigmaHQ/sigma", true, 90, 720, "Detection rule intelligence"],
  ["yara", "YARA Rules", "git", "internal:yara", true, 85, 720, "Malware detection rule intelligence"],
  ["github_secrets", "GitHub Secret Exposure", "api", "internal:github-secrets", true, 70, 720, "Public repository exposure intelligence"],
  ["typosquat", "Typosquatting", "generated", "internal:typosquat", true, 75, 720, "Lookalike domain intelligence"],
  ["apt_campaigns", "APT Campaigns", "api", "internal:apt-campaigns", true, 85, 720, "Campaign and actor intelligence"],
  ["darknet", "Darknet Posts", "registry", "intel_darknet_sources", true, 70, 1440, "Approved onion source collection"],
]

async function ensureTables() {
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

  await query(`CREATE INDEX IF NOT EXISTS idx_intel_sources_enabled ON intel_sources(enabled)`, [])
  await query(`CREATE INDEX IF NOT EXISTS idx_scraper_runs_source_started ON intel_scraper_runs(source_key, started_at DESC)`, [])

  for (const source of DEFAULT_SOURCES) {
    await query(
      `INSERT INTO intel_sources (source_key, source_name, source_type, endpoint, enabled, trust_score, rate_limit_minutes, collection_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_key) DO NOTHING`,
      source,
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const [sources, runs] = await Promise.all([
    query(`SELECT * FROM intel_sources ORDER BY enabled DESC, source_name ASC`, []),
    query(`SELECT * FROM intel_scraper_runs ORDER BY started_at DESC LIMIT 50`, []),
  ])

  return NextResponse.json({
    success: true,
    sources: sources.data || [],
    runs: runs.data || [],
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const body = await request.json().catch(() => ({}))
  const sourceKey = String(body.sourceKey || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
  const sourceName = String(body.sourceName || "").trim()
  const sourceType = String(body.sourceType || "api").trim()
  if (!sourceKey || !sourceName) return NextResponse.json({ error: "sourceKey and sourceName are required" }, { status: 400 })

  const result = await query(
    `INSERT INTO intel_sources (source_key, source_name, source_type, endpoint, enabled, trust_score, rate_limit_minutes, collection_policy, tenant_scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (source_key) DO UPDATE SET
       source_name = EXCLUDED.source_name,
       source_type = EXCLUDED.source_type,
       endpoint = EXCLUDED.endpoint,
       enabled = EXCLUDED.enabled,
       trust_score = EXCLUDED.trust_score,
       rate_limit_minutes = EXCLUDED.rate_limit_minutes,
       collection_policy = EXCLUDED.collection_policy,
       tenant_scope = EXCLUDED.tenant_scope,
       updated_at = NOW()
     RETURNING *`,
    [
      sourceKey,
      sourceName,
      sourceType,
      body.endpoint || null,
      body.enabled !== false,
      Number(body.trustScore || 70),
      Number(body.rateLimitMinutes || 60),
      body.collectionPolicy || null,
      body.tenantScope || "global",
    ],
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true, source: result.data?.[0] })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const body = await request.json().catch(() => ({}))
  const id = Number(body.id)
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const result = await query(
    `UPDATE intel_sources
     SET enabled = COALESCE($2, enabled),
         trust_score = COALESCE($3, trust_score),
         rate_limit_minutes = COALESCE($4, rate_limit_minutes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, body.enabled, body.trustScore ?? null, body.rateLimitMinutes ?? null],
  )

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true, source: result.data?.[0] })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const id = Number(request.nextUrl.searchParams.get("id") || 0)
  if (!id) return NextResponse.json({ error: "Invalid source id" }, { status: 400 })
  await query(`DELETE FROM intel_sources WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
