// ================================================
// Intel Hub - Domain Typosquatting Detection
// Generates and checks typo-domain variants for a given domain
// Uses DNS resolution and SSL checks to identify live squatted domains
// ================================================
import { safeFetchJson, memGet, memSet } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { TyposquatResult } from "@/lib/intel/types"
import { lookupCertTransparency } from "@/lib/intel/fetchers/cert-transparency"

// ---- Typosquatting generation algorithms ----
const QWERTY_ADJACENCY: Record<string, string[]> = {
  "a": ["q","w","s","z","x"], "b": ["v","g","h","n"], "c": ["x","d","f","v"],
  "d": ["s","e","r","f","c","x"], "e": ["w","s","d","f","r"], "f": ["d","r","t","g","v","c"],
  "g": ["f","t","y","h","b","v"], "h": ["g","y","u","j","n","b"], "i": ["u","j","k","o"],
  "j": ["h","u","i","k","n","m"], "k": ["j","i","o","l","m"], "l": ["k","o","p"],
  "m": ["n","j","k","l"], "n": ["b","h","j","m"], "o": ["i","k","l","p"],
  "p": ["o","l"], "q": ["w","a","s"], "r": ["e","d","f","t"],
  "s": ["a","w","e","d","x","z"], "t": ["r","f","g","y"], "u": ["y","g","h","j","i"],
  "v": ["c","f","g","b"], "w": ["q","a","s","d","e"], "x": ["z","s","d","c"],
  "y": ["t","g","h","u"], "z": ["a","s","x"],
}

const HOMOGLYPH_MAP: Record<string, string[]> = {
  "a": ["à","á","â","ã","ä","å","α"], "c": ["ç"],
  "e": ["è","é","ê","ë","ē","ė","ę"], "i": ["ì","í","î","ï","ī","ι"],
  "n": ["ñ","ń"], "o": ["ò","ó","ô","õ","ö","ø","ο","ο"],
  "s": ["ś","ŝ","ş","š"], "u": ["ù","ú","û","ü","ū"],
  "y": ["ý","ÿ"], "z": ["ź","ż","ž"],
  "0": ["ο","о"], "1": ["|","l","I","í"],
  "l": ["1","I","í","ł"], "I": ["l","1","í"],
  "m": ["rn"], "rn": ["m"],
  "w": ["vv"], "vv": ["w"],
  "d": ["cl"], "cl": ["d"],
}

const TLD_VARIANTS = [".com", ".net", ".org", ".io", ".co", ".info", ".biz", ".app", ".dev", ".xyz", ".online"]

// ---- Generate typo variants for a domain ----
export function generateTyposquats(domain: string): { variant: string; type: string }[] {
  const parts = domain.split(".")
  const name = parts[0].toLowerCase()
  const tld = parts.length > 1 ? `.${parts.slice(1).join(".")}` : ".com"
  const variants: { variant: string; type: string }[] = []

  // 1. Character omission (remove each char)
  for (let i = 0; i < name.length; i++) {
    if (name.length > 3) {
      variants.push({ variant: name.slice(0, i) + name.slice(i + 1) + tld, type: "omission" })
    }
  }

  // 2. Character substitution (QWERTY adjacency)
  for (let i = 0; i < name.length; i++) {
    const adjacent = QWERTY_ADJACENCY[name[i]] || []
    for (const adj of adjacent) {
      variants.push({ variant: name.slice(0, i) + adj + name.slice(i + 1) + tld, type: "substitution" })
    }
  }

  // 3. Character addition/insertion
  for (let i = 0; i <= name.length; i++) {
    const nearby = QWERTY_ADJACENCY[name[i] || name[Math.max(0, i - 1)]] || []
    for (const adj of nearby.slice(0, 2)) {
      variants.push({ variant: name.slice(0, i) + adj + name.slice(i) + tld, type: "addition" })
    }
  }

  // 4. Homoglyph substitution
  for (let i = 0; i < name.length; i++) {
    const homoglyphs = HOMOGLYPH_MAP[name[i]] || []
    for (const homo of homoglyphs) {
      variants.push({ variant: name.slice(0, i) + homo + name.slice(i + 1) + tld, type: "homoglyph" })
    }
  }

  // 5. TLD swap
  for (const altTld of TLD_VARIANTS) {
    if (altTld !== tld) {
      variants.push({ variant: name + altTld, type: "tld_swap" })
    }
  }

  // 6. Prefix / Suffix
  const prefixes = ["www-", "login-", "secure-", "auth-", "verify-", "portal-", "my-", "web-"]
  const suffixes = ["-secure", "-login", "-auth", "-verify", "-support", "-portal"]
  for (const prefix of prefixes) {
    variants.push({ variant: prefix + name + tld, type: "prefix" })
  }
  for (const suffix of suffixes) {
    variants.push({ variant: name + suffix + tld, type: "suffix" })
  }

  // Deduplicate and limit
  return [...new Map(variants.map((v) => [v.variant, v])).values()].slice(0, 100)
}

// ---- DNS resolution check ----
async function checkDnsResolves(domain: string): Promise<{ resolves: boolean; ip?: string }> {
  try {
    const dnsApi = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`
    const data = await safeFetchJson<{ Answer?: { data: string }[] }>(dnsApi, {
      headers: { "User-Agent": "IntelForge/1.0" },
    })
    const ip = data?.Answer?.[0]?.data
    return { resolves: Boolean(ip), ip }
  } catch {
    return { resolves: false }
  }
}

// ---- Levenshtein distance ----
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
  return dp[m][n]
}

// ---- Store to DB ----
async function storeTyposquats(results: TyposquatResult[]): Promise<number> {
  let stored = 0
  for (const t of results) {
    const r = await query(
      `INSERT INTO intel_typosquat_cache
         (original_domain, variant_domain, variant_type, levenshtein_distance,
          dns_resolves, resolved_ip, has_mx, has_ssl, is_malicious, risk_score, discovered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (original_domain, variant_domain) DO UPDATE SET
         dns_resolves=EXCLUDED.dns_resolves, resolved_ip=EXCLUDED.resolved_ip,
         is_malicious=EXCLUDED.is_malicious, risk_score=EXCLUDED.risk_score,
         fetched_at=NOW()`,
      [
        t.originalDomain, t.variantDomain, t.variantType,
        t.levenshteinDistance, t.dnsResolves, t.resolvedIp || null,
        t.hasMx, t.hasSsl, t.isMalicious, t.riskScore,
      ],
    )
    if (r.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getTyposquatsFromDb(
  domain: string,
  limit = 50,
): Promise<TyposquatResult[]> {
  const result = await query(
    `SELECT original_domain, variant_domain, variant_type, levenshtein_distance,
            dns_resolves, resolved_ip, has_mx, has_ssl, is_malicious, risk_score, discovered_at
     FROM intel_typosquat_cache
     WHERE original_domain = $1
     ORDER BY risk_score DESC, dns_resolves DESC
     LIMIT $2`,
    [domain, limit],
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    originalDomain: row.original_domain as string,
    variantDomain: row.variant_domain as string,
    variantType: row.variant_type as string,
    levenshteinDistance: Number(row.levenshtein_distance) || 0,
    dnsResolves: Boolean(row.dns_resolves),
    resolvedIp: row.resolved_ip as string | undefined,
    hasMx: Boolean(row.has_mx),
    hasSsl: Boolean(row.has_ssl),
    isMalicious: Boolean(row.is_malicious),
    riskScore: Number(row.risk_score) || 0,
    discoveredAt: String(row.discovered_at || ""),
  }))
}

// ---- Main lookup ----
export async function detectTyposquatting(domain: string): Promise<TyposquatResult[]> {
  const cacheKey = `intel:typosquat:${domain}`
  const cached = memGet<TyposquatResult[]>(cacheKey)
  if (cached) return cached

  // Check DB first
  let results = await getTyposquatsFromDb(domain, 50)
  if (results.length > 0) return results

  // Generate variants
  const baseName = domain.split(".")[0]
  const variants = generateTyposquats(domain)

  // Check DNS resolution for variants (batch)
  const checks = await Promise.allSettled(
    variants.map(async ({ variant, type }) => {
      const { resolves, ip } = await checkDnsResolves(variant)
      const distance = levenshtein(baseName, variant.split(".")[0])
      const riskScore = calculateTyposquatRisk(type, distance, resolves)

      return {
        originalDomain: domain,
        variantDomain: variant,
        variantType: type,
        levenshteinDistance: distance,
        dnsResolves: resolves,
        resolvedIp: ip,
        hasMx: false,
        hasSsl: false,
        isMalicious: riskScore >= 50,
        riskScore,
        discoveredAt: new Date().toISOString(),
      } as TyposquatResult
    }),
  )

  results = []
  for (const c of checks) {
    if (c.status === "fulfilled") results.push(c.value)
  }

  // Store results
  if (results.length > 0) await storeTyposquats(results)

  memSet(cacheKey, results, 12 * 3600)
  return results.sort((a, b) => b.riskScore - a.riskScore)
}

function calculateTyposquatRisk(type: string, distance: number, resolves: boolean): number {
  let score = 0

  // Base score by type
  const typeBase: Record<string, number> = {
    homoglyph: 70,
    tld_swap: 60,
    prefix: 50,
    suffix: 45,
    substitution: 40,
    addition: 35,
    omission: 30,
  }
  score += typeBase[type] || 30

  // Closer distance = higher risk
  if (distance <= 1) score += 20
  else if (distance <= 2) score += 10

  // Resolving = higher concern
  if (resolves) score += 15

  return Math.min(100, score)
}
