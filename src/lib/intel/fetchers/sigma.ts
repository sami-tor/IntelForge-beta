// ================================================
// Intel Hub - Sigma Detection Rule Repository
// Source: SigmaHQ/sigma GitHub repo (free, no auth)
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { SigmaRule } from "@/lib/intel/types"

const GITHUB_API = "https://api.github.com/repos/SigmaHQ/sigma"
const RAW_BASE = "https://raw.githubusercontent.com/SigmaHQ/sigma/master/rules"

// ---- GitHub API types ----
interface GithubTreeItem {
  path: string
  type: string // "blob" | "tree"
  sha: string
  url: string
}

interface GithubContent {
  name: string
  path: string
  content: string // base64
  encoding: string
}

// ---- Parse Sigma YAML metadata ----
function parseSigmaMetadata(yaml: string, filePath: string): Partial<SigmaRule> {
  const get = (key: string): string | undefined => {
    const m = yaml.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"))
    return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : undefined
  }

  const getList = (key: string): string[] | undefined => {
    const section = yaml.match(new RegExp(`^\\s*${key}:\\s*\\n((?:\\s+-.+\\n?)+)`, "m"))
    if (!section) return undefined
    return section[1].split("\n")
      .filter((l) => l.trim().startsWith("-"))
      .map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^['"]|['"]$/g, ""))
  }

  const title = get("title") || filePath.split("/").pop()?.replace(".yml", "") || "Untitled"
  const ruleId = get("id") || filePath

  return {
    ruleId,
    title,
    description: get("description"),
    status: get("status"),
    author: get("author"),
    level: get("level"),
    logsourceProduct: get("product"),
    logsourceService: get("service"),
    logsourceCategory: get("category"),
    tags: getList("tags"),
    techniqueId: getList("attack"),
    tactic: undefined, // derived from technique mapping if needed
    referencesUrls: getList("references"),
    rawRuleYaml: yaml,
    filePath,
  }
}

// ---- Index Sigma rule tree (GitHub API) ----
async function getSigmaRulePaths(): Promise<string[]> {
  // Use GitHub API to list rule yml files in the rules directory
  const paths: string[] = []

  // Top-level rule directories
  const dirs = [
    "rules/web", "rules/windows", "rules/linux", "rules/cloud",
    "rules/macos", "rules/network", "rules/application",
    "rules-threat-hunting/windows", "rules-emerging-threats",
  ]

  for (const dir of dirs) {
    const data = await safeFetchJson<{ tree: GithubTreeItem[] }>(
      `${GITHUB_API}/git/trees/master?recursive=1`,
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "IntelForge/1.0",
        },
      },
    )

    if (!data?.tree) continue

    const ruleFiles = data.tree
      .filter((item) =>
        item.path.startsWith(dir.replace("rules/", "rules/")) &&
        (item.path.endsWith(".yml") || item.path.endsWith(".yaml")),
      )
      .map((item) => item.path)

    paths.push(...ruleFiles)
  }

  return [...new Set(paths)].slice(0, 100)
}

// ---- Fetch a single Sigma rule from raw GitHub ----
async function fetchSigmaRule(filePath: string): Promise<SigmaRule | null> {
  const rawUrl = `${RAW_BASE}/${filePath.replace(/^rules\//, "")}`
  const res = await fetch(rawUrl, {
    headers: { "User-Agent": "IntelForge/1.0" },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return null
  const yaml = await res.text()
  const metadata = parseSigmaMetadata(yaml, filePath)
  return metadata as SigmaRule
}

// ---- Fetch sample of Sigma rules (batch) ----
async function fetchSigmaRulesBatch(): Promise<SigmaRule[]> {
  // Fetch a curated list of high-value Sigma rules
  const highValueRules = [
    "rules/windows/process_creation/proc_creation_win_susp_powershell_enc_cmd.yml",
    "rules/windows/process_creation/proc_creation_win_mimikatz.yml",
    "rules/windows/process_creation/proc_creation_win_susp_rundll32.yml",
    "rules/windows/registry/registry_set_persistence.yml",
    "rules/linux/process_creation/proc_creation_lnx_susp_reverse_shell.yml",
    "rules/cloud/aws/aws_root_account_usage.yml",
    "rules/network/net_connection_win_susp_rdp.yml",
    "rules/windows/builtin/security/win_security_malicious_service_install.yml",
    "rules/web/web_cve_exploitation.yml",
  ]

  const results = await Promise.allSettled(
    highValueRules.map((path) => fetchSigmaRule(path)),
  )

  const rules: SigmaRule[] = []
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) rules.push(r.value)
  }

  return rules
}

// ---- Store to DB ----
async function storeSigmaRules(rules: SigmaRule[]): Promise<number> {
  let stored = 0
  for (const r of rules) {
    const result = await query(
      `INSERT INTO intel_sigma_rules
         (rule_id, title, description, status, author, level, logsource_product,
          logsource_service, logsource_category, tactic, technique_id,
          raw_rule_yaml, tags, references_urls, file_path, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (rule_id) DO UPDATE SET
         title=EXCLUDED.title, status=EXCLUDED.status,
         level=EXCLUDED.level, raw_rule_yaml=EXCLUDED.raw_rule_yaml,
         tags=EXCLUDED.tags, fetched_at=NOW()`,
      [
        r.ruleId, r.title, r.description || null, r.status || null,
        r.author || null, r.level || null, r.logsourceProduct || null,
        r.logsourceService || null, r.logsourceCategory || null,
        r.tactic || null, r.techniqueId || null,
        r.rawRuleYaml, r.tags || null, r.referencesUrls || null,
        r.filePath || null, r.publishedAt || null,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getSigmaRulesFromDb(
  limit = 50,
  level?: string,
  product?: string,
  techniqueId?: string,
): Promise<SigmaRule[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (level) {
    params.push(level.toLowerCase())
    conditions.push(`level = $${params.length}`)
  }
  if (product) {
    params.push(product)
    conditions.push(`logsource_product = $${params.length}`)
  }
  if (techniqueId) {
    params.push(techniqueId)
    conditions.push(`$${params.length} = ANY(technique_id)`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT rule_id, title, description, status, author, level, logsource_product,
            logsource_service, logsource_category, tactic, technique_id,
            raw_rule_yaml, tags, references_urls, file_path, published_at
     FROM intel_sigma_rules
     ${where}
     ORDER BY
       CASE level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       title ASC
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    ruleId: row.rule_id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    status: row.status as string | undefined,
    author: row.author as string | undefined,
    level: row.level as string | undefined,
    logsourceProduct: row.logsource_product as string | undefined,
    logsourceService: row.logsource_service as string | undefined,
    logsourceCategory: row.logsource_category as string | undefined,
    tactic: row.tactic as string[] | undefined,
    techniqueId: row.technique_id as string[] | undefined,
    rawRuleYaml: row.raw_rule_yaml as string,
    tags: row.tags as string[] | undefined,
    referencesUrls: row.references_urls as string[] | undefined,
    filePath: row.file_path as string | undefined,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
  }))
}

// ---- Main sync ----
export async function fetchAndSyncSigma(): Promise<{ fetched: number; stored: number }> {
  const rules = await fetchSigmaRulesBatch()
  const stored = await storeSigmaRules(rules)

  const fresh = await getSigmaRulesFromDb(100)
  memSet("intel:sigma:all", fresh, TTL.MITRE)

  return { fetched: rules.length, stored }
}

// ---- Public API ----
export async function getSigmaRules(
  limit = 50,
  level?: string,
  product?: string,
  techniqueId?: string,
): Promise<SigmaRule[]> {
  const cacheKey = `intel:sigma:${level || "all"}:${product || "all"}:${techniqueId || "all"}:${limit}`
  const cached = memGet<SigmaRule[]>(cacheKey)
  if (cached) return cached

  let rules = await getSigmaRulesFromDb(limit, level, product, techniqueId)
  if (rules.length === 0) {
    await fetchAndSyncSigma()
    rules = await getSigmaRulesFromDb(limit, level, product, techniqueId)
  }

  memSet(cacheKey, rules, TTL.MITRE)
  return rules
}
