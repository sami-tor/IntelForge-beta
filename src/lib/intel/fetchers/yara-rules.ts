// ================================================
// Intel Hub - YARA Rule Repository
// Sources: YARA Forge, Awesome YARA collections, Elastic, ReversingLabs
// All sourced from public GitHub repos (free, no auth)
// ================================================
import { safeFetchJson, safeFetchText, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { YaraRule } from "@/lib/intel/types"

// ---- Curated YARA rules from well-known public repositories ----
interface YaraRuleTemplate {
  ruleName: string
  description: string
  author?: string
  category: string
  severity: string
  targetFamily: string[]
  mitreTechniques: string[]
  rawRule: string
  tags: string[]
  sourceRepo: string
}

// Well-known YARA rules for common malware families
const CURATED_RULES: YaraRuleTemplate[] = [
  // Ransomware
  {
    ruleName: "Ransom_WannaCry",
    description: "Detects WannaCry ransomware samples and components",
    author: "IntelForge CTI",
    category: "ransomware",
    severity: "critical",
    targetFamily: ["WannaCry", "WanaCrypt0r", "WCry"],
    mitreTechniques: ["T1486", "T1210"],
    rawRule: `rule Ransom_WannaCry {
    meta:
        description = "Detects WannaCry ransomware"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "WannaCry"
        mitre_attack = "T1486"
    strings:
        $ransom_note = "Wana Decrypt0r" ascii wide nocase
        $ext = ".WNCRY" ascii wide
        $url1 = "iuqerfsodp9ifjaposdfjhgosurijfaewrwergwea.com" ascii wide
        $crypto1 = "Microsoft Enhanced RSA and AES Cryptographic Provider" ascii wide
        $hash1 = { 8B 45 08 8B 55 0C 8B 4D 10 8B 5D 14 8B 75 18 }
    condition:
        uint16(0) == 0x5A4D and ($ransom_note or $ext or $url1) and ($crypto1 or $hash1)
}`,
    tags: ["ransomware", "wannacry", "eternalblue", "worm"],
    sourceRepo: "IntelForge/cti-rules",
  },
  {
    ruleName: "Ransom_Conti",
    description: "Detects Conti ransomware samples",
    author: "IntelForge CTI",
    category: "ransomware",
    severity: "critical",
    targetFamily: ["Conti", "conti"],
    mitreTechniques: ["T1486", "T1059"],
    rawRule: `rule Ransom_Conti {
    meta:
        description = "Detects Conti ransomware"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "Conti"
    strings:
        $note1 = "CONTI" ascii wide nocase
        $note2 = "Your personal ID" ascii wide
        $ext1 = ".CONTI" ascii wide
        $reg1 = "SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run" ascii wide
        $cmd1 = "vssadmin.exe Delete Shadows /All /Quiet" ascii wide nocase
    condition:
        uint16(0) == 0x5A4D and ($note1 or $note2 or $ext1) and ($reg1 or $cmd1)
}`,
    tags: ["ransomware", "conti", "ryuk-successor"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // RAT
  {
    ruleName: "RAT_CobaltStrike_Beacon",
    description: "Detects Cobalt Strike Beacon payload configurations",
    author: "IntelForge CTI",
    category: "rat",
    severity: "critical",
    targetFamily: ["CobaltStrike", "Cobalt Strike"],
    mitreTechniques: ["T1071", "T1105", "T1055"],
    rawRule: `rule RAT_CobaltStrike_Beacon {
    meta:
        description = "Detects Cobalt Strike Beacon"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "CobaltStrike"
    strings:
        $beacon_config = { 00 00 00 00 ?? ?? ?? ?? [4] FF FF FF FF }
        $sleeptime_jmp = { 6A 00 6A 00 FF 35 ?? ?? ?? ?? E8 ?? ?? ?? ?? }
        $xordecode = { 33 C0 8B D0 8B 4D ?? 8B 55 ?? 33 CB 33 D1 83 C0 04 }
        $http_get = "/submit.php?id=" ascii
        $http_post = "Cookie: " ascii
    condition:
        uint16(0) == 0x5A4D and
        (($beacon_config and $sleeptime_jmp) or $xordecode) and
        any of ($http_*)
}`,
    tags: ["rat", "cobaltstrike", "c2", "beacon"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // Infostealer
  {
    ruleName: "Stealer_RedLine",
    description: "Detects RedLine stealer samples",
    author: "IntelForge CTI",
    category: "stealer",
    severity: "high",
    targetFamily: ["RedLine", "RedLine Stealer"],
    mitreTechniques: ["T1555", "T1539", "T1003"],
    rawRule: `rule Stealer_RedLine {
    meta:
        description = "Detects RedLine Stealer"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "high"
        malware_family = "RedLine"
    strings:
        $str1 = "RedLine" ascii wide nocase
        $str2 = "stealer" ascii wide nocase
        $m1 = "SOFTWARE\\\\Microsoft\\\\Windows NT\\\\CurrentVersion" ascii wide
        $m2 = "login data" ascii wide nocase
        $m3 = "Local State" ascii wide
        $telegram = "t.me" ascii
        $discord = "discord.com" ascii wide nocase
    condition:
        uint16(0) == 0x5A4D and
        3 of ($str*, $m*) and any of ($telegram, $discord)
}`,
    tags: ["stealer", "redline", "infostealer", "credentials"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // APT malware
  {
    ruleName: "APT_Emotet_Loader",
    description: "Detects Emotet malware loader components",
    author: "IntelForge CTI",
    category: "apt",
    severity: "critical",
    targetFamily: ["Emotet", "Geodo"],
    mitreTechniques: ["T1566", "T1204", "T1059"],
    rawRule: `rule APT_Emotet_Loader {
    meta:
        description = "Detects Emotet loader"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "Emotet"
    strings:
        $macro_str = "AutoOpen" ascii wide
        $ole_str = "Word.Document" ascii wide nocase
        $url1 = /https?:\\/\\/[a-z0-9.-]+\\/(?:wp-content|uploads|include|css|js|images)\\//
        $drop1 = "regsvr32.exe" ascii wide nocase
        $drop2 = "rundll32.exe" ascii wide nocase
    condition:
        (uint16(0) == 0x5A4D or ($macro_str and $ole_str)) and
        $url1 and any of ($drop*)
}`,
    tags: ["apt", "emotet", "loader", "banking-trojan"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // Webshell
  {
    ruleName: "Webshell_ChinaChopper",
    description: "Detects China Chopper webshell variants",
    author: "IntelForge CTI",
    category: "exploit",
    severity: "critical",
    targetFamily: ["China Chopper", "caidao"],
    mitreTechniques: ["T1505", "T1059"],
    rawRule: `rule Webshell_ChinaChopper {
    meta:
        description = "Detects China Chopper webshell"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "China Chopper"
    strings:
        $chopper1 = "chopper" ascii wide nocase
        $chopper_eval = "eval(base64_decode" ascii wide
        $chopper_post = "=base64_decode(" ascii wide
        $phpinfo = "phpinfo()" ascii wide
    condition:
        filesize < 10KB and any of ($chopper*) and $phpinfo
}`,
    tags: ["webshell", "china-chopper", "hafnium", "command-control"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // Ransomware
  {
    ruleName: "Ransom_LockBit",
    description: "Detects LockBit ransomware samples",
    author: "IntelForge CTI",
    category: "ransomware",
    severity: "critical",
    targetFamily: ["LockBit", "LockBit 3.0"],
    mitreTechniques: ["T1486", "T1490", "T1562"],
    rawRule: `rule Ransom_LockBit {
    meta:
        description = "Detects LockBit ransomware"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "LockBit"
    strings:
        $note1 = "LockBit" ascii wide nocase
        $ext1 = ".lockbit" ascii wide nocase
        $wallpaper = "ransomware" ascii wide nocase
        $bcdedit = "bcdedit" ascii wide
        $delete_shadows = "Delete Shadows" ascii wide nocase
    condition:
        uint16(0) == 0x5A4D and ($note1 or $ext1) and
        2 of ($wallpaper, $bcdedit, $delete_shadows)
}`,
    tags: ["ransomware", "lockbit", "ransomware-as-a-service"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // Generic malware
  {
    ruleName: "Malware_Generic_PE_Packer_Detection",
    description: "Generic detection for packed/obfuscated PE files",
    author: "IntelForge CTI",
    category: "generic",
    severity: "medium",
    targetFamily: ["Packed", "Obfuscated"],
    mitreTechniques: ["T1027"],
    rawRule: `rule Malware_Generic_PE_Packer_Detection {
    meta:
        description = "Detects packed or obfuscated PE files"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "medium"
    strings:
        $section_upx0 = ".UPX0" ascii
        $section_upx1 = ".UPX1" ascii
        $section_aspack = ".aspack" ascii
        $section_petite = ".petite" ascii
        $high_entropy = { 00 00 00 00 00 00 00 00 [0-64] FF FF FF FF }
    condition:
        uint16(0) == 0x5A4D and
        (any of ($section_*) or
         (pe.sections > 2 and pe.sections < 5 and
          for any i in (0..pe.number_of_sections-1):
          (pe.sections[i].raw_data_size == 0 or
           pe.sections[i].characteristics & 0xE0000020 == 0xE0000020)))
}`,
    tags: ["packer", "obfuscation", "generic-detection", "pe-analysis"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // Stealer
  {
    ruleName: "Stealer_Vidar",
    description: "Detects Vidar infostealer samples",
    author: "IntelForge CTI",
    category: "stealer",
    severity: "high",
    targetFamily: ["Vidar", "Vidar Stealer"],
    mitreTechniques: ["T1555", "T1539"],
    rawRule: `rule Stealer_Vidar {
    meta:
        description = "Detects Vidar Stealer"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "high"
        malware_family = "Vidar"
    strings:
        $str1 = "Vidar" ascii wide nocase
        $m1 = "Software\\\\Microsoft\\\\Internet Explorer\\\\IntelliForms" ascii wide
        $m2 = "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Explorer\\\\Browser Helper Objects" ascii wide
        $telegram_api = "api.telegram.org" ascii
        $encrypt_key = "CryptDeriveKey" ascii wide
    condition:
        uint16(0) == 0x5A4D and
        ($str1 or ($m1 and $m2)) and any of ($telegram_api, $encrypt_key)
}`,
    tags: ["stealer", "vidar", "infostealer", "credentials"],
    sourceRepo: "IntelForge/cti-rules",
  },
  // APT
  {
    ruleName: "APT_Mimikatz",
    description: "Detects Mimikatz credential dumping tool",
    author: "IntelForge CTI",
    category: "exploit",
    severity: "critical",
    targetFamily: ["Mimikatz", "mimikatz"],
    mitreTechniques: ["T1003", "T1555"],
    rawRule: `rule APT_Mimikatz {
    meta:
        description = "Detects Mimikatz"
        author = "IntelForge CTI"
        date = "2024-01"
        severity = "critical"
        malware_family = "Mimikatz"
    strings:
        $m1 = "mimikatz" ascii wide nocase
        $m2 = "sekurlsa" ascii wide nocase
        $m3 = "kerberos" ascii wide nocase
        $m4 = "gentilkiwi" ascii wide nocase
        $m5 = "privilege::debug" ascii wide
        $m6 = "mimilib" ascii wide nocase
    condition:
        uint16(0) == 0x5A4D and ($m1 or ($m2 and ($m3 or $m5)) or (filesize < 2MB and 3 of them))
}`,
    tags: ["apt", "mimikatz", "credential-dumping", "lsass"],
    sourceRepo: "IntelForge/cti-rules",
  },
]

// ---- Fetch additional YARA rules from GitHub repos ----
async function fetchCommunityRules(): Promise<YaraRule[]> {
  // Fetch YARA rules from popular open-source repositories
  const repos = [
    { owner: "YARA-Rules", repo: "rules", path: "" },
    { owner: "elastic", repo: "protections-artifacts", path: "yara/rules" },
    { owner: "reversinglabs", repo: "yara-rules", path: "" },
  ]

  const rules: YaraRule[] = []

  for (const { owner, repo, path } of repos) {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
      const data = await safeFetchJson<{ name: string; type: string; download_url: string }[]>(
        apiUrl,
        { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "IntelForge/1.0" } },
      )

      if (!data || !Array.isArray(data)) continue

      const yarFiles = data.filter((f) => f.name.endsWith(".yar") || f.name.endsWith(".yara"))
      for (const file of yarFiles.slice(0, 10)) {
        const content = await safeFetchText(file.download_url, {
          headers: { "User-Agent": "IntelForge/1.0" },
        })
        if (content && content.length < 50000) {
          rules.push(parseCommunityRule(content, file.name, `${owner}/${repo}`))
        }
      }
    } catch {
      // Repo might not exist or rate limited
    }
  }

  return rules
}

function parseCommunityRule(rawRule: string, fileName: string, repo: string): YaraRule {
  const nameMatch = rawRule.match(/rule\s+(\w+)\s*\{/)
  const descMatch = rawRule.match(/description\s*=\s*"([^"]+)"/)
  const authorMatch = rawRule.match(/author\s*=\s*"([^"]+)"/)
  const familyMatch = rawRule.match(/malware_family\s*=\s*"([^"]+)"/)
  const severityMatch = rawRule.match(/severity\s*=\s*"([^"]+)"/)
  const mitreMatch = rawRule.match(/mitre_attack\s*=\s*"([^"]+)"/)

  return {
    ruleName: nameMatch?.[1] || fileName.replace(/\.ya?r$/, ""),
    description: descMatch?.[1] || fileName,
    author: authorMatch?.[1],
    category: detectYaraCategory(rawRule),
    severity: severityMatch?.[1] || "medium",
    targetFamily: familyMatch?.[1] ? [familyMatch[1]] : undefined,
    mitreTechniques: mitreMatch?.[1] ? [mitreMatch[1]] : undefined,
    rawRule: rawRule.slice(0, 10000), // truncate
    tags: extractYaraTags(rawRule),
    sourceRepo: repo,
    filePath: fileName,
  }
}

function detectYaraCategory(rule: string): string {
  const lower = rule.toLowerCase()
  if (lower.includes("ransomware") || lower.includes("ransom")) return "ransomware"
  if (lower.includes("apt") || lower.includes("nation-state")) return "apt"
  if (lower.includes("rat") || lower.includes("trojan")) return "rat"
  if (lower.includes("stealer") || lower.includes("credential")) return "stealer"
  if (lower.includes("exploit") || lower.includes("cve")) return "exploit"
  return "generic"
}

function extractYaraTags(rule: string): string[] {
  const tags: string[] = []
  const tagMatch = rule.match(/tags\s*=\s*\[([^\]]+)\]/)
  if (tagMatch) {
    tags.push(...tagMatch[1].split(",").map((t) => t.trim().replace(/"/g, "")))
  }
  return tags
}

// ---- Store to DB ----
async function storeYaraRules(rules: YaraRule[]): Promise<number> {
  let stored = 0
  for (const r of rules) {
    const result = await query(
      `INSERT INTO intel_yara_rules
         (rule_name, description, author, category, severity, target_family,
          mitre_techniques, raw_rule, references_urls, tags,
          source_repo, file_path, published_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (rule_name) DO UPDATE SET
         raw_rule=EXCLUDED.raw_rule, updated_at=EXCLUDED.updated_at,
         fetched_at=NOW()`,
      [
        r.ruleName, r.description || null, r.author || null,
        r.category || null, r.severity || null, r.targetFamily || null,
        r.mitreTechniques || null, r.rawRule, r.referencesUrls || null,
        r.tags || null, r.sourceRepo || null, r.filePath || null,
        r.publishedAt || null, r.updatedAt || new Date().toISOString(),
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getYaraRulesFromDb(
  limit = 50,
  category?: string,
  severity?: string,
  searchFamily?: string,
): Promise<YaraRule[]> {
  const conditions: string[] = []
  const params: (string | number)[] = [limit]

  if (category) {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }
  if (severity) {
    params.push(severity)
    conditions.push(`severity = $${params.length}`)
  }
  if (searchFamily) {
    params.push(`%${searchFamily}%`)
    conditions.push(`target_family::text ILIKE $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT rule_name, description, author, category, severity, target_family,
            mitre_techniques, raw_rule, references_urls, tags,
            source_repo, file_path, published_at, updated_at
     FROM intel_yara_rules
     ${where}
     ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       rule_name ASC
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    ruleName: row.rule_name as string,
    description: row.description as string | undefined,
    author: row.author as string | undefined,
    category: row.category as string | undefined,
    severity: row.severity as string | undefined,
    targetFamily: row.target_family as string[] | undefined,
    mitreTechniques: row.mitre_techniques as string[] | undefined,
    rawRule: row.raw_rule as string,
    referencesUrls: row.references_urls as string[] | undefined,
    tags: row.tags as string[] | undefined,
    sourceRepo: row.source_repo as string | undefined,
    filePath: row.file_path as string | undefined,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }))
}

// ---- YARA Match Simulator (rule matching against IOC strings) ----
export function matchYaraRule(rule: string, target: string): boolean {
  try {
    // Extract strings section and check for string matches
    const stringsSection = rule.match(/strings:\s*\n([\s\S]*?)(?:\n\s*condition:)/)
    if (!stringsSection) return false

    const stringPatterns = stringsSection[1]
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const match = l.match(/=\s*(.+?)(?:\s+(?:ascii|wide|nocase|fullword))*(?:\s*$)/)
        return match ? match[1].replace(/^"|"$/g, "").trim() : null
      })
      .filter(Boolean) as string[]

    return stringPatterns.some((pattern) =>
      pattern.startsWith("/") ? false : target.toLowerCase().includes(pattern.toLowerCase()),
    )
  } catch {
    return false
  }
}

// ---- Main sync ----
export async function fetchAndSyncYara(): Promise<{ fetched: number; stored: number }> {
  // Curated rules
  const curatedRules: YaraRule[] = CURATED_RULES.map((r) => ({
    ruleName: r.ruleName,
    description: r.description,
    author: r.author,
    category: r.category,
    severity: r.severity,
    targetFamily: r.targetFamily,
    mitreTechniques: r.mitreTechniques,
    rawRule: r.rawRule,
    referencesUrls: undefined,
    tags: r.tags,
    sourceRepo: r.sourceRepo,
    filePath: undefined,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  // Community rules (optional, may timeout)
  let communityRules: YaraRule[] = []
  try {
    communityRules = await fetchCommunityRules()
  } catch {
    // Non-fatal
  }

  const all = [...curatedRules, ...communityRules]
  const stored = await storeYaraRules(all)

  const fresh = await getYaraRulesFromDb(200)
  memSet("intel:yara:all", fresh, TTL.MITRE)

  return { fetched: all.length, stored }
}

// ---- Public API ----
export async function getYaraRules(
  limit = 50,
  category?: string,
  severity?: string,
  searchFamily?: string,
): Promise<YaraRule[]> {
  const cacheKey = `intel:yara:${category || "all"}:${severity || "all"}:${searchFamily || "all"}:${limit}`
  const cached = memGet<YaraRule[]>(cacheKey)
  if (cached) return cached

  let rules = await getYaraRulesFromDb(limit, category, severity, searchFamily)
  if (rules.length === 0) {
    await fetchAndSyncYara()
    rules = await getYaraRulesFromDb(limit, category, severity, searchFamily)
  }

  memSet(cacheKey, rules, TTL.MITRE)
  return rules
}
