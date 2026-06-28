// ================================================
// Intel Hub - APT Campaign Timeline & Clustering
// Source: MITRE ATT&CK data + public threat reports
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { AptCampaign } from "@/lib/intel/types"

// ---- Campaign data derived from MITRE groups + public threat intel ----
// These are well-documented APT campaigns from open sources
interface CampaignTemplate {
  campaignId: string
  campaignName: string
  threatActor: string
  actorAliases: string[]
  targetSectors: string[]
  targetCountries: string[]
  startDate: string
  endDate?: string
  description: string
  techniques: string[]
  malwareFamilies: string[]
  cves: string[]
  confidence: string
  source: string
}

const KNOWN_CAMPAIGNS: CampaignTemplate[] = [
  {
    campaignId: "solarwinds-2020",
    campaignName: "SolarWinds Supply Chain Compromise",
    threatActor: "APT29",
    actorAliases: ["Cozy Bear", "Nobelium", "Midnight Blizzard"],
    targetSectors: ["government", "technology", "defense", "telecommunications"],
    targetCountries: ["US", "UK", "CA", "EU"],
    startDate: "2020-03-01",
    description: "Supply chain attack via trojanized SolarWinds Orion updates, compromising ~18,000 organizations including US federal agencies.",
    techniques: ["T1195", "T1071", "T1587", "T1588", "T1078", "T1027"],
    malwareFamilies: ["Sunburst", "Teardrop", "Raindrop", "GoldMax", "Sibot"],
    cves: ["CVE-2020-10148", "CVE-2021-35211"],
    confidence: "confirmed",
    source: "CISA, NSA, FBI joint advisory",
  },
  {
    campaignId: "colonial-pipeline-2021",
    campaignName: "Colonial Pipeline Ransomware Attack",
    threatActor: "DarkSide",
    actorAliases: ["BlackMatter"],
    targetSectors: ["energy", "critical-infrastructure"],
    targetCountries: ["US"],
    startDate: "2021-05-06",
    endDate: "2021-05-13",
    description: "Ransomware attack on Colonial Pipeline causing fuel shortages across US East Coast. ~$4.4M ransom paid (partial recovery).",
    techniques: ["T1486", "T1562", "T1041", "T1071", "T1082"],
    malwareFamilies: ["DarkSide Ransomware"],
    cves: [],
    confidence: "confirmed",
    source: "FBI, CISA advisory",
  },
  {
    campaignId: "log4shell-2021",
    campaignName: "Log4Shell Exploitation Campaign",
    threatActor: "Multiple",
    actorAliases: ["APT41", "Hafnium", "Phosphorus"],
    targetSectors: ["technology", "finance", "government", "healthcare"],
    targetCountries: ["Global"],
    startDate: "2021-12-01",
    description: "Widespread exploitation of CVE-2021-44228 (Log4Shell) across multiple sectors. Multiple APT groups and ransomware actors exploited vulnerable systems.",
    techniques: ["T1190", "T1059", "T1505", "T1071", "T1486"],
    malwareFamilies: ["Kinsing", "Muhstik", "B1txor20", "Conti"],
    cves: ["CVE-2021-44228", "CVE-2021-45046", "CVE-2021-45105"],
    confidence: "confirmed",
    source: "CISA, NCSC, ANSSI advisories",
  },
  {
    campaignId: "hafnium-exchange-2021",
    campaignName: "HAFNIUM Exchange Server Exploitation",
    threatActor: "HAFNIUM",
    actorAliases: [],
    targetSectors: ["government", "education", "healthcare", "legal"],
    targetCountries: ["US", "UK", "EU"],
    startDate: "2021-01-01",
    description: "Chinese state-sponsored group exploiting Microsoft Exchange Server zero-days (ProxyLogon) for espionage. ~30,000+ organizations affected.",
    techniques: ["T1190", "T1505", "T1078", "T1041", "T1003"],
    malwareFamilies: ["China Chopper", "DeerShell", "WebShell variants"],
    cves: ["CVE-2021-26855", "CVE-2021-26857", "CVE-2021-26858", "CVE-2021-27065"],
    confidence: "confirmed",
    source: "Microsoft Threat Intelligence Center, CISA",
  },
  {
    campaignId: "kaseya-vsa-2021",
    campaignName: "Kaseya VSA Supply Chain Ransomware Attack",
    threatActor: "REvil",
    actorAliases: ["Sodinokibi"],
    targetSectors: ["technology", "managed-service-providers"],
    targetCountries: ["US", "EU", "Global"],
    startDate: "2021-07-02",
    description: "REvil exploited Kaseya VSA zero-day to deploy ransomware across ~1,500 downstream businesses. $70M ransom demand.",
    techniques: ["T1195", "T1486", "T1562", "T1041"],
    malwareFamilies: ["REvil/Sodinokibi"],
    cves: ["CVE-2021-30116"],
    confidence: "confirmed",
    source: "CISA, FBI advisory",
  },
  {
    campaignId: "microsoft-solarwinds-2020b",
    campaignName: "Microsoft 365 Golden SAML Attack",
    threatActor: "APT29",
    actorAliases: ["Cozy Bear"],
    targetSectors: ["government", "technology"],
    targetCountries: ["US"],
    startDate: "2020-06-01",
    endDate: "2021-01-01",
    description: "APT29 used stolen SAML signing keys to forge authentication tokens for Microsoft 365 environments following SolarWinds access.",
    techniques: ["T1606", "T1078", "T1550", "T1530"],
    malwareFamilies: ["Golden SAML"],
    cves: [],
    confidence: "confirmed",
    source: "Microsoft, CISA, NSA",
  },
  {
    campaignId: "notpetya-2017",
    campaignName: "NotPetya Wiper Attack",
    threatActor: "Sandworm",
    actorAliases: ["Voodoo Bear", "Unit 74455"],
    targetSectors: ["finance", "energy", "transportation", "government", "healthcare"],
    targetCountries: ["UA", "Global"],
    startDate: "2017-06-27",
    description: "Russian military intelligence deployed destructive malware disguised as ransomware via compromised Ukrainian accounting software M.E.Doc. $10B+ global damages.",
    techniques: ["T1195", "T1485", "T1569", "T1053"],
    malwareFamilies: ["NotPetya", "EternalBlue", "EternalRomance", "Mimikatz"],
    cves: ["CVE-2017-0144", "CVE-2017-0145"],
    confidence: "confirmed",
    source: "US DOJ indictment, UK NCSC, multiple CERT advisories",
  },
  {
    campaignId: "wannacry-2017",
    campaignName: "WannaCry Ransomware Outbreak",
    threatActor: "Lazarus Group",
    actorAliases: ["APT38", "Hidden Cobra"],
    targetSectors: ["healthcare", "government", "education", "manufacturing"],
    targetCountries: ["Global"],
    startDate: "2017-05-12",
    description: "North Korean APT deployed WannaCry ransomware using EternalBlue exploit, affecting 200,000+ systems across 150 countries. NHS severely impacted.",
    techniques: ["T1210", "T1486", "T1041"],
    malwareFamilies: ["WannaCry", "EternalBlue", "DoublePulsar"],
    cves: ["CVE-2017-0143", "CVE-2017-0144", "CVE-2017-0145", "CVE-2017-0146"],
    confidence: "confirmed",
    source: "US DOJ indictment, Europol, multiple CERT advisories",
  },
  {
    campaignId: "stuxnet-2010",
    campaignName: "Stuxnet / Operation Olympic Games",
    threatActor: "Equation Group",
    actorAliases: ["Olympic Destroyer"],
    targetSectors: ["energy", "nuclear", "industrial-control-systems"],
    targetCountries: ["IR"],
    startDate: "2009-06-01",
    endDate: "2010-09-01",
    description: "US-Israeli joint operation using Stuxnet worm to sabotage Iranian uranium enrichment centrifuges. First known cyber-physical weapon.",
    techniques: ["T0883", "T0884", "T0889", "T1027"],
    malwareFamilies: ["Stuxnet", "Flame", "Duqu"],
    cves: ["CVE-2010-2568", "CVE-2010-2772", "CVE-2010-2743"],
    confidence: "confirmed",
    source: "New York Times investigation, multiple security research reports",
  },
  {
    campaignId: "3cx-supply-chain-2023",
    campaignName: "3CX Desktop App Supply Chain Attack",
    threatActor: "Lazarus Group",
    actorAliases: ["APT38", "Hidden Cobra"],
    targetSectors: ["technology", "finance", "cryptocurrency"],
    targetCountries: ["Global"],
    startDate: "2023-03-01",
    description: "North Korean APT trojanized 3CX Desktop App (VoIP software) to target cryptocurrency and financial organizations globally.",
    techniques: ["T1195", "T1574", "T1059", "T1071"],
    malwareFamilies: ["TaxHaul", "Colibri Loader", "Gopuram"],
    cves: [],
    confidence: "confirmed",
    source: "CrowdStrike, SentinelOne, CISA advisory",
  },
]

// ---- Store to DB ----
async function storeCampaigns(campaigns: AptCampaign[]): Promise<number> {
  let stored = 0
  for (const c of campaigns) {
    const result = await query(
      `INSERT INTO intel_apt_campaigns
         (campaign_id, campaign_name, threat_actor, actor_aliases,
          target_sectors, target_countries, start_date, end_date, is_active,
          description, techniques, malware_families, iocs, cves,
          references_urls, confidence, source, first_reported, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (campaign_id) DO UPDATE SET
         description=EXCLUDED.description, techniques=EXCLUDED.techniques,
         last_updated=EXCLUDED.last_updated, fetched_at=NOW()`,
      [
        c.campaignId, c.campaignName, c.threatActor,
        c.actorAliases || null, c.targetSectors || null,
        c.targetCountries || null, c.startDate || null,
        c.endDate || null, c.isActive,
        c.description || null, c.techniques || null,
        c.malwareFamilies || null, c.iocs || null, c.cves || null,
        c.referencesUrls || null, c.confidence || null,
        c.source || null, c.firstReported || null,
        c.lastUpdated || new Date().toISOString(),
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getCampaignsFromDb(
  limit = 50,
  threatActor?: string,
  isActive?: boolean,
  targetCountry?: string,
): Promise<AptCampaign[]> {
  const conditions: string[] = []
  const params: (string | number | boolean)[] = [limit]

  if (threatActor) {
    params.push(`%${threatActor}%`)
    conditions.push(`(threat_actor ILIKE $${params.length} OR $${params.length} = ANY(actor_aliases))`)
  }
  if (isActive !== undefined) {
    params.push(isActive)
    conditions.push(`is_active = $${params.length}`)
  }
  if (targetCountry) {
    params.push(targetCountry)
    conditions.push(`$${params.length} = ANY(target_countries)`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await query(
    `SELECT campaign_id, campaign_name, threat_actor, actor_aliases,
            target_sectors, target_countries, start_date, end_date, is_active,
            description, techniques, malware_families, iocs, cves,
            references_urls, confidence, source, first_reported, last_updated
     FROM intel_apt_campaigns
     ${where}
     ORDER BY start_date DESC NULLS LAST
     LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    campaignId: row.campaign_id as string,
    campaignName: row.campaign_name as string,
    threatActor: row.threat_actor as string,
    actorAliases: row.actor_aliases as string[] | undefined,
    targetSectors: row.target_sectors as string[] | undefined,
    targetCountries: row.target_countries as string[] | undefined,
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    isActive: Boolean(row.is_active),
    description: row.description as string | undefined,
    techniques: row.techniques as string[] | undefined,
    malwareFamilies: row.malware_families as string[] | undefined,
    iocs: row.iocs as string[] | undefined,
    cves: row.cves as string[] | undefined,
    referencesUrls: row.references_urls as string[] | undefined,
    confidence: row.confidence as string | undefined,
    source: row.source as string | undefined,
    firstReported: row.first_reported ? String(row.first_reported) : undefined,
    lastUpdated: row.last_updated ? String(row.last_updated) : undefined,
  }))
}

// ---- Campaign Timeline ----
export async function getCampaignTimeline(): Promise<{
  campaigns: AptCampaign[]
  timeline: { year: string; count: number; actors: string[] }[]
}> {
  const campaigns = await getCampaignsFromDb(100)

  const yearMap = new Map<string, { count: number; actors: Set<string> }>()
  for (const c of campaigns) {
    const year = c.startDate?.slice(0, 4) || "Unknown"
    if (!yearMap.has(year)) yearMap.set(year, { count: 0, actors: new Set() })
    const entry = yearMap.get(year)!
    entry.count++
    entry.actors.add(c.threatActor)
  }

  const timeline = Array.from(yearMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, data]) => ({
      year,
      count: data.count,
      actors: Array.from(data.actors),
    }))

  return { campaigns, timeline }
}

// ---- Main sync ----
export async function fetchAndSyncCampaigns(): Promise<{ fetched: number; stored: number }> {
  const campaigns: AptCampaign[] = KNOWN_CAMPAIGNS.map((c) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    threatActor: c.threatActor,
    actorAliases: c.actorAliases,
    targetSectors: c.targetSectors,
    targetCountries: c.targetCountries,
    startDate: c.startDate,
    endDate: c.endDate,
    isActive: !c.endDate || new Date(c.endDate) > new Date(),
    description: c.description,
    techniques: c.techniques,
    malwareFamilies: c.malwareFamilies,
    cves: c.cves.length > 0 ? c.cves : undefined,
    confidence: c.confidence,
    source: c.source,
    firstReported: c.startDate,
    lastUpdated: new Date().toISOString(),
  }))

  const stored = await storeCampaigns(campaigns)

  const fresh = await getCampaignsFromDb(100)
  memSet("intel:apt:all", fresh, TTL.MITRE)

  return { fetched: campaigns.length, stored }
}

// ---- Public API ----
export async function getCampaigns(
  limit = 50,
  threatActor?: string,
  isActive?: boolean,
): Promise<AptCampaign[]> {
  const cacheKey = `intel:apt:${threatActor || "all"}:${isActive !== undefined ? isActive : "all"}:${limit}`
  const cached = memGet<AptCampaign[]>(cacheKey)
  if (cached) return cached

  let campaigns = await getCampaignsFromDb(limit, threatActor, isActive)
  if (campaigns.length === 0) {
    await fetchAndSyncCampaigns()
    campaigns = await getCampaignsFromDb(limit, threatActor, isActive)
  }

  memSet(cacheKey, campaigns, TTL.MITRE)
  return campaigns
}
