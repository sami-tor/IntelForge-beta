// ================================================
// Intel Hub - Shared TypeScript Types
// ================================================

// ---- News ----
export interface NewsItem {
  id: string
  guid: string
  title: string
  description: string
  url: string
  source: string
  sourceLabel: string
  category: NewsCategory
  publishedAt: string
  imageUrl?: string
  author?: string
}

export type NewsCategory =
  | "ransomware"
  | "apt"
  | "vulnerability"
  | "breach"
  | "malware"
  | "nation-state"
  | "general"

// ---- Ransomware ----
export interface RansomwareGroup {
  slug: string
  name: string
  description?: string
  firstSeen?: string
  victimCount: number
  active: boolean
  locations?: string[]
  sectors?: string[]
  aliases?: string[]
}

export interface RansomwareVictim {
  victimName: string
  url?: string
  groupName: string
  discoveredAt?: string
  country?: string
  sector?: string
  description?: string
  screenshot?: string
  published?: boolean
}

export interface RansomwareStats {
  totalGroups: number
  activeGroups: number
  victimsLast30Days: number
  victimsLast7Days: number
  topSectors: { sector: string; count: number }[]
  topCountries: { country: string; count: number }[]
  topGroups: { name: string; count: number }[]
}

// ---- CVE / Vulnerability ----
export type CvssV3Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE"

export interface CveItem {
  cveId: string
  description: string
  cvssV3Score?: number
  cvssV3Severity?: CvssV3Severity
  cvssV2Score?: number
  epssScore?: number
  epssPercentile?: number
  cwe?: string[]
  vendor?: string
  product?: string
  publishedAt: string
  lastModified: string
  isKev: boolean
  kevAddedDate?: string
  kevDueDate?: string
  kevRequiredAction?: string
  refUrls?: string[]
}

// ---- IOC Lookup ----
export type IOCType = "ip" | "domain" | "hash" | "url"

export interface IOCLookupResult {
  iocType: IOCType
  iocValue: string
  verdict: "malicious" | "suspicious" | "clean" | "unknown"
  confidenceScore: number               // 0-100
  sources: IOCSourceResult[]
  tags: string[]
  asn?: string
  country?: string
  firstSeen?: string
  lastSeen?: string
  lookupTimestamp: string
}

export interface IOCSourceResult {
  source: string                        // 'shodan' | 'abuseipdb' | 'greynoise' | 'virustotal' etc.
  label: string
  verdict?: "malicious" | "suspicious" | "clean" | "unknown"
  data: Record<string, unknown>
  error?: string
  queriedAt: string
}

// ---- Malware ----
export interface MalwareSample {
  sha256?: string
  sha1?: string
  md5?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  malwareFamily?: string[]
  tags?: string[]
  iocs?: string[]
  source: "malwarebazaar" | "urlhaus" | "threatfox" | "feodotracker"
  rawUrl?: string
  urlStatus?: string
  reporter?: string
  firstSeen?: string
  lastSeen?: string
}

// ---- MITRE ATT&CK ----
export interface MitreGroup {
  stixId: string
  name: string
  groupId?: string
  aliases?: string[]
  description?: string
  url?: string
  techniques?: string[]
  software?: string[]
  sectors?: string[]
  countries?: string[]
}

export interface MitreTechnique {
  stixId: string
  techniqueId: string
  name: string
  description?: string
  tactic?: string[]
  platforms?: string[]
  detection?: string
  mitigation?: string
  url?: string
  isSubtechnique: boolean
  parentTechniqueId?: string
}

export interface MitreTactic {
  id: string
  name: string
  description?: string
  techniques: MitreTechnique[]
}

// ---- Intelligence Stats Dashboard ----
export interface IntelStats {
  newsToday: number
  newVulns24h: number
  criticalCves: number
  kevTotal: number
  activeRansomwareGroups: number
  ransomwareVictims30d: number
  malwareSamples24h: number
  threatActors: number
  lastUpdated: string
}

// ---- Deep Threat Actor Report ----
export interface ThreatActorRelationship {
  id: string
  source: string
  target: string
  relation: string
  confidence: number
  evidenceCount: number
  /** Omitted in public API responses */
  sources?: string[]
}

export interface ThreatActorReport {
  query: string
  generatedAt: string
  actorMatches: MitreGroup[]
  aliases: string[]
  relatedTechniques: string[]
  relatedMalwareFamilies: string[]
  relatedCves: CveItem[]
  relatedIocs: string[]
  relatedNews: NewsItem[]
  relatedRansomwareGroups: string[]
  relatedVictims: string[]
  otxPulses: Array<{
    id: string
    name: string
    modified: string
    tags: string[]
    references: string[]
    indicatorsCount: number
  }>
  relationships: ThreatActorRelationship[]
  confidenceSummary: {
    high: number
    medium: number
    low: number
  }
}

// ---- Exploit Intelligence ----
export interface ExploitItem {
  exploitId: string
  cveId?: string
  title: string
  description?: string
  exploitType?: string          // remote | local | webapp | dos | privesc
  platform?: string
  author?: string
  rawCode?: string               // truncated source
  pocUrl?: string
  publishedAt: string
  verified: boolean
  hasPoc: boolean
  tags?: string[]
}

// ---- Certificate Transparency ----
export interface CertItem {
  domain: string
  issuer?: string
  serialNumber?: string
  fingerprintSha256?: string
  notBefore?: string
  notAfter?: string
  subjectAltNames?: string[]
  wildcard: boolean
  revoked: boolean
  crtShId?: number
  loggedAt: string
}

// ---- Phishing Intelligence ----
export interface PhishingItem {
  phishId: string
  url: string
  targetBrand?: string
  phishType?: string             // credential_harvesting | smishing | vishing | malware_delivery
  ipAddress?: string
  asn?: string
  country?: string
  screenshotUrl?: string
  verified: boolean
  active: boolean
  reportedAt: string
  tags?: string[]
  source: "openphish" | "phishtank"
}

// ---- Supply Chain / Dependency Vuln ----
export interface SupplyChainItem {
  osvId: string
  packageName: string
  packageEcosystem?: string      // npm | pypi | maven | go | crates | nuget
  summary?: string
  details?: string
  severity?: CvssV3Severity
  cvssV3Score?: number
  cvssV3Vector?: string
  aliases?: string[]              // CVE-xxxx, GHSA-xxxx
  fixedVersion?: string
  affectedVersions?: string[]
  referencesUrls?: string[]
  publishedAt: string
  modifiedAt?: string
}

// ---- Sigma Detection Rule ----
export interface SigmaRule {
  ruleId: string
  title: string
  description?: string
  status?: string                 // stable | experimental | deprecated
  author?: string
  level?: string                  // low | medium | high | critical
  logsourceProduct?: string
  logsourceService?: string
  logsourceCategory?: string
  tactic?: string[]
  techniqueId?: string[]
  rawRuleYaml: string
  tags?: string[]
  referencesUrls?: string[]
  filePath?: string
  publishedAt?: string
}

// ---- Dark Web / Leak Site ----
export interface DarknetPost {
  postUid: string
  source: string
  sourceType?: string             // ransomware_blog | forum | market | telegram
  title?: string
  content?: string
  url?: string
  author?: string
  threatActor?: string
  victimName?: string
  victimSector?: string
  victimCountry?: string
  leakType?: string               // data_leak | ransom_note | auction | general
  severity?: string               // critical | high | medium | low
  tags?: string[]
  discoveredAt: string
}

// ---- APT Campaign ----
export interface AptCampaign {
  campaignId: string
  campaignName: string
  threatActor: string
  actorAliases?: string[]
  targetSectors?: string[]
  targetCountries?: string[]
  startDate?: string
  endDate?: string
  isActive: boolean
  description?: string
  techniques?: string[]
  malwareFamilies?: string[]
  iocs?: string[]
  cves?: string[]
  referencesUrls?: string[]
  confidence?: string             // confirmed | probable | possible
  source?: string
  firstReported?: string
  lastUpdated?: string
}

// ---- Domain Typosquatting ----
export interface TyposquatResult {
  originalDomain: string
  variantDomain: string
  variantType: string             // homoglyph | omission | addition | substitution | tld_swap | prefix | suffix
  levenshteinDistance: number
  dnsResolves: boolean
  resolvedIp?: string
  hasMx: boolean
  hasSsl: boolean
  isMalicious: boolean
  riskScore: number               // 0-100
  discoveredAt: string
}

// ---- GitHub Secret Exposure ----
export interface GithubSecretExposure {
  findingId: string
  repoName: string
  repoOwner?: string
  filePath: string
  lineNumber?: number
  secretType: string               // api_key | aws_key | private_key | token | password | db_connection | jwt_secret
  snippetHash?: string
  redactedSnippet?: string
  isPublic: boolean
  discoveredAt: string
  lastSeenAt?: string
  stillExposed: boolean
  riskLevel: string                // critical | high | medium | low
}

// ---- YARA Rule ----
export interface YaraRule {
  ruleName: string
  description?: string
  author?: string
  category?: string                // malware | ransomware | apt | rat | stealer | exploit | generic
  severity?: string                // low | medium | high | critical
  targetFamily?: string[]
  mitreTechniques?: string[]
  rawRule: string
  referencesUrls?: string[]
  tags?: string[]
  sourceRepo?: string
  filePath?: string
  publishedAt?: string
  updatedAt?: string
}

// ---- Subscription Gates ----
export type IntelFeature =
  | "news"
  | "ransomware"
  | "cve"
  | "ioc_lookup"
  | "malware"
  | "threat_actors"
  | "attack_patterns"
  | "breach_monitor"
  | "api_access"
  | "exploit_intel"
  | "cert_transparency"
  | "phishing_intel"
  | "supply_chain"
  | "sigma_rules"
  | "darknet_monitor"
  | "apt_campaigns"
  | "typosquatting"
  | "github_secrets"
  | "yara_rules"

export interface IntelLimit {
  feature: IntelFeature
  limit: number           // -1 = unlimited
  windowHours?: number    // time window for rate limits
}

export const INTEL_LIMITS: Record<string, IntelLimit[]> = {
  free: [
    { feature: "news",            limit: 10 },
    { feature: "cve",             limit: 20 },
    { feature: "ioc_lookup",      limit: 5,   windowHours: 24 },
    { feature: "ransomware",      limit: 5 },
    { feature: "malware",         limit: 0 },
    { feature: "threat_actors",   limit: 10 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: 1,   windowHours: 24 },
    { feature: "api_access",      limit: 0 },
    { feature: "exploit_intel",   limit: 5 },
    { feature: "cert_transparency", limit: 3,  windowHours: 24 },
    { feature: "phishing_intel",  limit: 10 },
    { feature: "supply_chain",    limit: 10 },
    { feature: "sigma_rules",     limit: 20 },
    { feature: "darknet_monitor", limit: 3 },
    { feature: "apt_campaigns",   limit: 5 },
    { feature: "typosquatting",   limit: 3,   windowHours: 24 },
    { feature: "github_secrets",  limit: 5 },
    { feature: "yara_rules",      limit: 10 },
  ],
  starter: [
    { feature: "news",            limit: -1 },
    { feature: "cve",             limit: 100 },
    { feature: "ioc_lookup",      limit: 50,  windowHours: 24 },
    { feature: "ransomware",      limit: -1 },
    { feature: "malware",         limit: 20 },
    { feature: "threat_actors",   limit: -1 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: 5,   windowHours: 24 },
    { feature: "api_access",      limit: 0 },
    { feature: "exploit_intel",   limit: 30 },
    { feature: "cert_transparency", limit: 20, windowHours: 24 },
    { feature: "phishing_intel",  limit: 50 },
    { feature: "supply_chain",    limit: 50 },
    { feature: "sigma_rules",     limit: -1 },
    { feature: "darknet_monitor", limit: 15 },
    { feature: "apt_campaigns",   limit: -1 },
    { feature: "typosquatting",   limit: 20,  windowHours: 24 },
    { feature: "github_secrets",  limit: 20 },
    { feature: "yara_rules",      limit: -1 },
  ],
  professional: [
    { feature: "news",            limit: -1 },
    { feature: "cve",             limit: -1 },
    { feature: "ioc_lookup",      limit: 500, windowHours: 24 },
    { feature: "ransomware",      limit: -1 },
    { feature: "malware",         limit: -1 },
    { feature: "threat_actors",   limit: -1 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: 20,  windowHours: 24 },
    { feature: "api_access",      limit: -1 },
    { feature: "exploit_intel",   limit: -1 },
    { feature: "cert_transparency", limit: -1 },
    { feature: "phishing_intel",  limit: -1 },
    { feature: "supply_chain",    limit: -1 },
    { feature: "sigma_rules",     limit: -1 },
    { feature: "darknet_monitor", limit: -1 },
    { feature: "apt_campaigns",   limit: -1 },
    { feature: "typosquatting",   limit: 100, windowHours: 24 },
    { feature: "github_secrets",  limit: -1 },
    { feature: "yara_rules",      limit: -1 },
  ],
  enterprise: [
    { feature: "news",            limit: -1 },
    { feature: "cve",             limit: -1 },
    { feature: "ioc_lookup",      limit: -1 },
    { feature: "ransomware",      limit: -1 },
    { feature: "malware",         limit: -1 },
    { feature: "threat_actors",   limit: -1 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: -1 },
    { feature: "api_access",      limit: -1 },
    { feature: "exploit_intel",   limit: -1 },
    { feature: "cert_transparency", limit: -1 },
    { feature: "phishing_intel",  limit: -1 },
    { feature: "supply_chain",    limit: -1 },
    { feature: "sigma_rules",     limit: -1 },
    { feature: "darknet_monitor", limit: -1 },
    { feature: "apt_campaigns",   limit: -1 },
    { feature: "typosquatting",   limit: -1 },
    { feature: "github_secrets",  limit: -1 },
    { feature: "yara_rules",      limit: -1 },
  ],
  api_access: [
    { feature: "news",            limit: -1 },
    { feature: "cve",             limit: -1 },
    { feature: "ioc_lookup",      limit: -1 },
    { feature: "ransomware",      limit: -1 },
    { feature: "malware",         limit: -1 },
    { feature: "threat_actors",   limit: -1 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: -1 },
    { feature: "api_access",      limit: -1 },
    { feature: "exploit_intel",   limit: -1 },
    { feature: "cert_transparency", limit: -1 },
    { feature: "phishing_intel",  limit: -1 },
    { feature: "supply_chain",    limit: -1 },
    { feature: "sigma_rules",     limit: -1 },
    { feature: "darknet_monitor", limit: -1 },
    { feature: "apt_campaigns",   limit: -1 },
    { feature: "typosquatting",   limit: -1 },
    { feature: "github_secrets",  limit: -1 },
    { feature: "yara_rules",      limit: -1 },
  ],
  admin: [
    { feature: "news",            limit: -1 },
    { feature: "cve",             limit: -1 },
    { feature: "ioc_lookup",      limit: -1 },
    { feature: "ransomware",      limit: -1 },
    { feature: "malware",         limit: -1 },
    { feature: "threat_actors",   limit: -1 },
    { feature: "attack_patterns", limit: -1 },
    { feature: "breach_monitor",  limit: -1 },
    { feature: "api_access",      limit: -1 },
    { feature: "exploit_intel",   limit: -1 },
    { feature: "cert_transparency", limit: -1 },
    { feature: "phishing_intel",  limit: -1 },
    { feature: "supply_chain",    limit: -1 },
    { feature: "sigma_rules",     limit: -1 },
    { feature: "darknet_monitor", limit: -1 },
    { feature: "apt_campaigns",   limit: -1 },
    { feature: "typosquatting",   limit: -1 },
    { feature: "github_secrets",  limit: -1 },
    { feature: "yara_rules",      limit: -1 },
  ],
}
