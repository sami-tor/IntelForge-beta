// ================================================
// Intel Hub - GitHub Secret Exposure Scanner
// Uses GitHub's public code search API to find exposed secrets
// Free tier: 30 req/min unauthenticated, 5000/hr with GITHUB_TOKEN
// ================================================
import { safeFetchJson, memGet, memSet } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { GithubSecretExposure } from "@/lib/intel/types"

const GITHUB_API = "https://api.github.com"
const GH_TOKEN = process.env.GITHUB_TOKEN

// ---- GitHub API response types ----
interface GithubSearchItem {
  repository: {
    full_name: string
    owner: { login: string }
    html_url: string
    private: boolean
  }
  name: string
  path: string
  html_url: string
}

interface GithubSearchResponse {
  total_count: number
  items: GithubSearchItem[]
}

// ---- Secret pattern definitions ----
interface SecretPattern {
  type: string
  pattern: RegExp
  riskLevel: string
  description: string
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: "aws_key",
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    riskLevel: "critical",
    description: "AWS Access Key ID",
  },
  {
    type: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    riskLevel: "critical",
    description: "Private cryptographic key",
  },
  {
    type: "api_key",
    pattern: /(?:api[_-]?key|apikey|API_KEY)["\s:=]+["']?([A-Za-z0-9_\-]{20,})["']?/gi,
    riskLevel: "high",
    description: "Generic API key",
  },
  {
    type: "token",
    pattern: /(?:token|secret|password|passwd)["\s:=]+["']?([A-Za-z0-9_\-!@#$%^&*]{8,})["']?/gi,
    riskLevel: "high",
    description: "Generic token or password",
  },
  {
    type: "db_connection",
    pattern: /(?:mongodb|mysql|postgresql|postgres|jdbc|redis):\/\/[^'"\s]+/gi,
    riskLevel: "critical",
    description: "Database connection string",
  },
  {
    type: "jwt_secret",
    pattern: /(?:jwt[_-]?secret|JWT_SECRET|jwt_secret_key)["\s:=]+["']?([A-Za-z0-9_\-]{16,})["']?/gi,
    riskLevel: "high",
    description: "JWT signing secret",
  },
  {
    type: "api_key",
    pattern: /(?:ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{20,}/g,
    riskLevel: "critical",
    description: "GitHub personal access token",
  },
  {
    type: "api_key",
    pattern: /(?:sk-[A-Za-z0-9]{32,})/g,
    riskLevel: "critical",
    description: "OpenAI/Stripe-style API key",
  },
  {
    type: "password",
    pattern: /(?:PASSWORD|DB_PASSWORD|DATABASE_PASSWORD)["\s:=]+["']?([^'"\s]{6,})["']?/gi,
    riskLevel: "high",
    description: "Database password in config",
  },
]

// ---- Search GitHub for a secret pattern ----
async function searchGitHubPattern(
  query: string,
  limit = 30,
): Promise<GithubSearchItem[]> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "IntelForge/1.0",
  }
  if (GH_TOKEN) {
    headers["Authorization"] = `Bearer ${GH_TOKEN}`
  }

  const q = `${query} language:yaml,json,toml,env,js,ts,py,go,php,java`
  const data = await safeFetchJson<GithubSearchResponse>(
    `${GITHUB_API}/search/code?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 30)}`,
    { headers },
  )

  return data?.items || []
}

// ---- Scan for exposed secrets ----
async function scanGithubSecrets(): Promise<GithubSecretExposure[]> {
  const findings: GithubSecretExposure[] = []
  const now = new Date().toISOString()

  // Search for high-value patterns using GitHub code search qualifiers
  const searchQueries = [
    // AWS keys
    { query: '"AKIA" extension:env,json,yaml,yml', type: "aws_key", riskLevel: "critical" },
    // Private keys
    { query: '"BEGIN RSA PRIVATE KEY" extension:pem,key', type: "private_key", riskLevel: "critical" },
    // DB connection strings
    { query: '"mongodb+srv://" OR "postgresql://" OR "mysql://" extension:env,js,py,json,yaml', type: "db_connection", riskLevel: "critical" },
    // GitHub tokens
    { query: '"ghp_" extension:env,json,yaml,yml,sh', type: "api_key", riskLevel: "critical" },
    // JWT secrets
    { query: '"JWT_SECRET" extension:env,json,yaml,yml', type: "jwt_secret", riskLevel: "high" },
    // Generic passwords
    { query: '"DB_PASSWORD" OR "DATABASE_PASSWORD" extension:env,json,yaml,yml', type: "password", riskLevel: "high" },
  ]

  for (const { query: q, type, riskLevel } of searchQueries) {
    try {
      const items = await searchGitHubPattern(q, 15)

      for (const item of items) {
        if (item.repository?.private) continue

        const findingId = Buffer.from(
          `${item.repository.full_name}:${item.path}:${type}:${item.name}`,
        ).toString("base64").slice(0, 60)

        findings.push({
          findingId,
          repoName: item.repository.full_name,
          repoOwner: item.repository.owner?.login,
          filePath: item.path,
          secretType: type,
          isPublic: !item.repository.private,
          discoveredAt: now,
          lastSeenAt: now,
          stillExposed: true,
          riskLevel,
        })
      }
    } catch {
      // Rate limit or network error, skip this query
    }
  }

  return findings
}

// ---- Store to DB ----
async function storeSecretFindings(findings: GithubSecretExposure[]): Promise<number> {
  let stored = 0
  for (const f of findings) {
    const result = await query(
      `INSERT INTO intel_github_secrets
         (finding_id, repo_name, repo_owner, file_path, line_number,
          secret_type, snippet_hash, redacted_snippet, is_public,
          discovered_at, last_seen_at, still_exposed, risk_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (finding_id) DO UPDATE SET
         last_seen_at=EXCLUDED.last_seen_at,
         still_exposed=EXCLUDED.still_exposed,
         fetched_at=NOW()`,
      [
        f.findingId, f.repoName, f.repoOwner || null, f.filePath,
        f.lineNumber || null, f.secretType, f.snippetHash || null,
        f.redactedSnippet || null, f.isPublic, f.discoveredAt,
        f.lastSeenAt || null, f.stillExposed, f.riskLevel,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getSecretFindingsFromDb(
  limit = 50,
  riskLevel?: string,
  secretType?: string,
): Promise<GithubSecretExposure[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (riskLevel && riskLevel !== "all") {
    params.push(riskLevel)
    conditions.push(`risk_level = $${params.length}`)
  }
  if (secretType) {
    params.push(secretType)
    conditions.push(`secret_type = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT finding_id, repo_name, repo_owner, file_path, line_number,
            secret_type, snippet_hash, redacted_snippet, is_public,
            discovered_at, last_seen_at, still_exposed, risk_level
     FROM intel_github_secrets
     ${where}
     ORDER BY
       CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
       discovered_at DESC
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    findingId: row.finding_id as string,
    repoName: row.repo_name as string,
    repoOwner: row.repo_owner as string | undefined,
    filePath: row.file_path as string,
    lineNumber: row.line_number ? Number(row.line_number) : undefined,
    secretType: row.secret_type as string,
    snippetHash: row.snippet_hash as string | undefined,
    redactedSnippet: row.redacted_snippet as string | undefined,
    isPublic: Boolean(row.is_public),
    discoveredAt: String(row.discovered_at || ""),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : undefined,
    stillExposed: Boolean(row.still_exposed),
    riskLevel: row.risk_level as string,
  }))
}

// ---- Stats ----
export async function getSecretStats(): Promise<{
  totalFindings: number
  criticalFindings: number
  exposedRepos: number
}> {
  const [total, critical, repos] = await Promise.all([
    query(`SELECT COUNT(*) as c FROM intel_github_secrets WHERE still_exposed=true`, []),
    query(`SELECT COUNT(*) as c FROM intel_github_secrets WHERE risk_level='critical' AND still_exposed=true`, []),
    query(`SELECT COUNT(DISTINCT repo_name) as c FROM intel_github_secrets WHERE still_exposed=true`, []),
  ])

  return {
    totalFindings: Number(total.data?.[0]?.c) || 0,
    criticalFindings: Number(critical.data?.[0]?.c) || 0,
    exposedRepos: Number(repos.data?.[0]?.c) || 0,
  }
}

// ---- Main sync ----
export async function fetchAndSyncGithubSecrets(): Promise<{ fetched: number; stored: number }> {
  const findings = await scanGithubSecrets()
  const stored = await storeSecretFindings(findings)

  const fresh = await getSecretFindingsFromDb(50)
  memSet("intel:github_secrets:all", fresh, 12 * 3600)

  return { fetched: findings.length, stored }
}

// ---- Public API ----
export async function getGithubSecretFindings(
  limit = 50,
  riskLevel?: string,
  secretType?: string,
): Promise<GithubSecretExposure[]> {
  const cacheKey = `intel:github_secrets:${riskLevel || "all"}:${secretType || "all"}:${limit}`
  const cached = memGet<GithubSecretExposure[]>(cacheKey)
  if (cached) return cached

  let findings = await getSecretFindingsFromDb(limit, riskLevel, secretType)
  if (findings.length === 0) {
    await fetchAndSyncGithubSecrets()
    findings = await getSecretFindingsFromDb(limit, riskLevel, secretType)
  }

  memSet(cacheKey, findings, 12 * 3600)
  return findings
}
