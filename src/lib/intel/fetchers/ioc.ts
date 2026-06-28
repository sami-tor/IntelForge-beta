// ================================================
// Intel Hub - IOC Multi-Source Lookup
// Sources (all free or free-tier):
//   Shodan InternetDB (IP - no auth)
//   AbuseIPDB         (IP - free API key)
//   GreyNoise Community (IP - free API key)
//   VirusTotal        (IP/domain/hash/url - free API key)
//   MalwareBazaar     (hash - no auth)
//   URLhaus           (url/domain - no auth)
//   ThreatFox         (ip/domain/hash - no auth)
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import type { IOCLookupResult, IOCSourceResult, IOCType } from "@/lib/intel/types"

// ---- Auto-detect IOC type ----
export function detectIOCType(value: string): IOCType {
  const v = value.trim()

  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"

  // IPv6
  if (/^[0-9a-fA-F:]+:[0-9a-fA-F:]+$/.test(v) && v.includes(":")) return "ip"

  // MD5 / SHA1 / SHA256
  if (/^[0-9a-fA-F]{32}$/.test(v)) return "hash"
  if (/^[0-9a-fA-F]{40}$/.test(v)) return "hash"
  if (/^[0-9a-fA-F]{64}$/.test(v)) return "hash"

  // URL
  if (/^https?:\/\//i.test(v)) return "url"

  // Domain (catch-all)
  return "domain"
}

// ---- Source: Shodan InternetDB ----
async function queryShodanInternetDB(ip: string): Promise<IOCSourceResult> {
  const start = Date.now()
  try {
    const data = await safeFetchJson<Record<string, unknown>>(
      `https://internetdb.shodan.io/${encodeURIComponent(ip)}`,
      { headers: { "User-Agent": "IntelForge/1.0" } },
    )
    const hasVulns = Array.isArray(data?.vulns) && (data.vulns as string[]).length > 0
    const hasMalware = Array.isArray(data?.tags) && (data.tags as string[]).some(
      (t) => ["honeypot", "vpn", "tor", "cloud", "cdn"].includes(t.toLowerCase()),
    )
    return {
      source: "shodan",
      label: "Shodan InternetDB",
      verdict: hasVulns ? "suspicious" : "unknown",
      data: {
        ports: data?.ports,
        hostnames: data?.hostnames,
        tags: data?.tags,
        cpes: data?.cpes,
        vulns: data?.vulns,
      },
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "shodan", label: "Shodan InternetDB", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: AbuseIPDB ----
async function queryAbuseIPDB(ip: string): Promise<IOCSourceResult> {
  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    return { source: "abuseipdb", label: "AbuseIPDB", error: "API key not configured", data: {}, queriedAt: new Date().toISOString() }
  }
  try {
    const data = await safeFetchJson<{ data: Record<string, unknown> }>(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      { headers: { Key: apiKey, Accept: "application/json", "User-Agent": "IntelForge/1.0" } },
    )
    const score = Number((data?.data as Record<string, unknown>)?.abuseConfidenceScore) || 0
    const verdict = score >= 80 ? "malicious" : score >= 25 ? "suspicious" : "clean"
    return {
      source: "abuseipdb",
      label: "AbuseIPDB",
      verdict,
      data: data?.data || {},
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "abuseipdb", label: "AbuseIPDB", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: GreyNoise Community ----
async function queryGreyNoise(ip: string): Promise<IOCSourceResult> {
  const apiKey = process.env.GREYNOISE_API_KEY
  if (!apiKey) {
    return { source: "greynoise", label: "GreyNoise", error: "API key not configured", data: {}, queriedAt: new Date().toISOString() }
  }
  try {
    const data = await safeFetchJson<Record<string, unknown>>(
      `https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`,
      { headers: { key: apiKey, "User-Agent": "IntelForge/1.0" } },
    )
    const noise = Boolean(data?.noise)
    const riot = Boolean(data?.riot)
    const classification = (data?.classification as string) || "unknown"
    const verdict = noise && classification === "malicious" ? "malicious"
      : noise ? "suspicious"
      : riot ? "clean"
      : "unknown"
    return {
      source: "greynoise",
      label: "GreyNoise",
      verdict,
      data: { noise, riot, classification, name: data?.name, link: data?.link },
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "greynoise", label: "GreyNoise", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: VirusTotal (IP, domain, hash, url) ----
async function queryVirusTotal(type: IOCType, value: string): Promise<IOCSourceResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) {
    return { source: "virustotal", label: "VirusTotal", error: "API key not configured", data: {}, queriedAt: new Date().toISOString() }
  }

  const pathMap: Record<IOCType, string> = {
    ip: `ip_addresses/${encodeURIComponent(value)}`,
    domain: `domains/${encodeURIComponent(value)}`,
    hash: `files/${encodeURIComponent(value)}`,
    url: `urls/${Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`,
  }

  try {
    const data = await safeFetchJson<{ data: { attributes: Record<string, unknown> } }>(
      `https://www.virustotal.com/api/v3/${pathMap[type]}`,
      { headers: { "x-apikey": apiKey, "User-Agent": "IntelForge/1.0" } },
    )
    const attrs = data?.data?.attributes
    const lastAnalysis = attrs?.last_analysis_stats as Record<string, number> | undefined
    const malicious = lastAnalysis?.malicious || 0
    const total = Object.values(lastAnalysis || {}).reduce((a, b) => a + b, 0)
    const verdict = malicious > 5 ? "malicious" : malicious > 0 ? "suspicious" : total > 0 ? "clean" : "unknown"

    return {
      source: "virustotal",
      label: "VirusTotal",
      verdict,
      data: {
        malicious,
        suspicious: lastAnalysis?.suspicious || 0,
        harmless: lastAnalysis?.harmless || 0,
        undetected: lastAnalysis?.undetected || 0,
        total,
        country: attrs?.country,
        asOwner: attrs?.as_owner,
        reputation: attrs?.reputation,
      },
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "virustotal", label: "VirusTotal", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: MalwareBazaar (hash lookup) ----
async function queryMalwareBazaar(hash: string): Promise<IOCSourceResult> {
  try {
    const data = await safeFetchJson<{ query_status: string; data: Record<string, unknown>[] }>(
      "https://mb-api.abuse.ch/api/v1/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "IntelForge/1.0" },
        body: `query=get_info&hash=${encodeURIComponent(hash)}`,
      },
    )
    if (data?.query_status === "ok" && data.data?.length) {
      const entry = data.data[0]
      return {
        source: "malwarebazaar",
        label: "MalwareBazaar",
        verdict: "malicious",
        data: {
          malware_family: entry.signature,
          file_type: entry.file_type,
          file_size: entry.file_size,
          tags: entry.tags,
          first_seen: entry.first_seen,
          reporter: entry.reporter,
        },
        queriedAt: new Date().toISOString(),
      }
    }
    return { source: "malwarebazaar", label: "MalwareBazaar", verdict: "unknown", data: { status: data?.query_status }, queriedAt: new Date().toISOString() }
  } catch {
    return { source: "malwarebazaar", label: "MalwareBazaar", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: URLhaus (URL/domain) ----
async function queryURLhaus(value: string, type: "url" | "domain"): Promise<IOCSourceResult> {
  try {
    const body = type === "url"
      ? `url=${encodeURIComponent(value)}`
      : `host=${encodeURIComponent(value)}`

    const endpoint = type === "url"
      ? "https://urlhaus-api.abuse.ch/v1/url/"
      : "https://urlhaus-api.abuse.ch/v1/host/"

    const data = await safeFetchJson<Record<string, unknown>>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "IntelForge/1.0" },
      body,
    })

    const found = data?.query_status === "is_listed"
    return {
      source: "urlhaus",
      label: "URLhaus",
      verdict: found ? "malicious" : "clean",
      data: {
        status: data?.query_status,
        threat: data?.threat,
        tags: data?.tags,
        urlcount: data?.urlcount,
      },
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "urlhaus", label: "URLhaus", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Source: ThreatFox ----
async function queryThreatFox(value: string): Promise<IOCSourceResult> {
  try {
    const data = await safeFetchJson<{ query_status: string; data: Record<string, unknown>[] }>(
      "https://threatfox-api.abuse.ch/api/v1/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "IntelForge/1.0" },
        body: JSON.stringify({ query: "search_ioc", search_term: value }),
      },
    )
    const found = data?.query_status === "ok" && Array.isArray(data.data) && data.data.length > 0
    const entry = found ? data.data[0] : null
    return {
      source: "threatfox",
      label: "ThreatFox",
      verdict: found ? "malicious" : "unknown",
      data: entry ? {
        malware: entry.malware,
        malware_printable: entry.malware_printable,
        confidence_level: entry.confidence_level,
        threat_type: entry.threat_type,
        tags: entry.tags,
        first_seen: entry.first_seen,
        last_seen: entry.last_seen,
      } : { status: data?.query_status },
      queriedAt: new Date().toISOString(),
    }
  } catch {
    return { source: "threatfox", label: "ThreatFox", error: "Query failed", data: {}, queriedAt: new Date().toISOString() }
  }
}

// ---- Compute aggregate verdict ----
function aggregateVerdict(sources: IOCSourceResult[]): {
  verdict: IOCLookupResult["verdict"]
  confidenceScore: number
  tags: string[]
} {
  const verdicts = sources.filter((s) => !s.error && s.verdict).map((s) => s.verdict!)
  const malicious = verdicts.filter((v) => v === "malicious").length
  const suspicious = verdicts.filter((v) => v === "suspicious").length
  const clean = verdicts.filter((v) => v === "clean").length
  const total = verdicts.length

  let verdict: IOCLookupResult["verdict"] = "unknown"
  let score = 0

  if (malicious > 0) {
    verdict = "malicious"
    score = Math.min(100, (malicious / Math.max(total, 1)) * 100 + 20)
  } else if (suspicious > 0) {
    verdict = "suspicious"
    score = Math.min(70, (suspicious / Math.max(total, 1)) * 60 + 10)
  } else if (clean > 0) {
    verdict = "clean"
    score = 0
  }

  const tags: string[] = []
  for (const s of sources) {
    if (s.source === "greynoise" && (s.data as Record<string, unknown>)?.noise) tags.push("mass-scanner")
    if (s.source === "shodan" && Array.isArray((s.data as Record<string, unknown>)?.tags)) {
      tags.push(...((s.data as Record<string, unknown>).tags as string[]))
    }
    if (s.source === "threatfox" && (s.data as Record<string, unknown>)?.malware_printable) {
      tags.push(String((s.data as Record<string, unknown>).malware_printable))
    }
  }

  return { verdict, confidenceScore: Math.round(score), tags: [...new Set(tags)] }
}

// ---- Main lookup dispatcher ----
export async function lookupIOC(value: string, type?: IOCType): Promise<IOCLookupResult> {
  const iocType = type || detectIOCType(value)
  const cacheKey = `intel:ioc:${iocType}:${value}`
  const cached = memGet<IOCLookupResult>(cacheKey)
  if (cached) return cached

  const sources: IOCSourceResult[] = []

  if (iocType === "ip") {
    const results = await Promise.allSettled([
      queryShodanInternetDB(value),
      queryAbuseIPDB(value),
      queryGreyNoise(value),
      queryVirusTotal("ip", value),
      queryThreatFox(value),
    ])
    results.forEach((r) => { if (r.status === "fulfilled") sources.push(r.value) })
  } else if (iocType === "domain") {
    const results = await Promise.allSettled([
      queryVirusTotal("domain", value),
      queryURLhaus(value, "domain"),
      queryThreatFox(value),
    ])
    results.forEach((r) => { if (r.status === "fulfilled") sources.push(r.value) })
  } else if (iocType === "hash") {
    const results = await Promise.allSettled([
      queryMalwareBazaar(value),
      queryVirusTotal("hash", value),
      queryThreatFox(value),
    ])
    results.forEach((r) => { if (r.status === "fulfilled") sources.push(r.value) })
  } else if (iocType === "url") {
    const results = await Promise.allSettled([
      queryVirusTotal("url", value),
      queryURLhaus(value, "url"),
      queryThreatFox(value),
    ])
    results.forEach((r) => { if (r.status === "fulfilled") sources.push(r.value) })
  }

  const { verdict, confidenceScore, tags } = aggregateVerdict(sources)

  const result: IOCLookupResult = {
    iocType,
    iocValue: value,
    verdict,
    confidenceScore,
    sources,
    tags,
    lookupTimestamp: new Date().toISOString(),
  }

  memSet(cacheKey, result, TTL.IOC_RESULT)
  return result
}
