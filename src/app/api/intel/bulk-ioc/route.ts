import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

function detectType(v: string): string {
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return "cve"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return "hash"
  if (/^https?:\/\//i.test(v)) return "url"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) && !v.includes(" ")) return "domain"
  return "keyword"
}

async function lookupOne(value: string, type: string) {
  const result: { value: string; type: string; hits: number; data: Record<string, unknown[]> } = { value, type, hits: 0, data: {} }

  try {
    switch (type) {
      case "cve": {
        const [cve, exploits] = await Promise.all([
          query(`SELECT cve_id, description, cvss_v3_severity, cvss_v3_score, is_kev FROM intel_cve_cache WHERE UPPER(cve_id)=UPPER($1) LIMIT 1`, [value]),
          query(`SELECT exploit_id, title, poc_url FROM intel_exploit_cache WHERE UPPER(cve_id)=UPPER($1) LIMIT 5`, [value]),
        ])
        result.data.cve = cve.data || []
        result.data.exploits = exploits.data || []
        result.hits = (cve.data?.length || 0) + (exploits.data?.length || 0)
        break
      }
      case "ip": {
        const [malware, phishing, ioc] = await Promise.all([
          query(`SELECT sha256, malware_family, tags FROM intel_malware_cache WHERE iocs::text ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT url, target_brand, active FROM intel_phishing_cache WHERE ip_address=$1 LIMIT 5`, [value]),
          query(`SELECT result->>'verdict' as verdict, result->>'confidenceScore' as confidence FROM intel_ioc_lookups WHERE ioc_value=$1 LIMIT 3`, [value]),
        ])
        result.data.malware = malware.data || []
        result.data.phishing = phishing.data || []
        result.data.iocLookups = ioc.data || []
        result.hits = (malware.data?.length || 0) + (phishing.data?.length || 0) + (ioc.data?.length || 0)
        break
      }
      case "hash": {
        const [sample, yara] = await Promise.all([
          query(`SELECT sha256, file_name, malware_family, tags FROM intel_malware_cache WHERE LOWER(sha256)=LOWER($1) OR LOWER(sha1)=LOWER($1) OR LOWER(md5)=LOWER($1) LIMIT 1`, [value]),
          query(`SELECT rule_name, severity, target_family FROM intel_yara_rules WHERE target_family::text ILIKE $1 LIMIT 5`, [`%${value}%`]),
        ])
        result.data.sample = sample.data || []
        result.data.yaraRules = yara.data || []
        result.hits = (sample.data?.length || 0) + (yara.data?.length || 0)
        break
      }
      case "domain": {
        const [phish, certs, typos] = await Promise.all([
          query(`SELECT url, target_brand, active FROM intel_phishing_cache WHERE url ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT domain, issuer, revoked FROM intel_cert_cache WHERE domain=$1 LIMIT 5`, [value]),
          query(`SELECT variant_domain, risk_score, dns_resolves FROM intel_typosquat_cache WHERE original_domain=$1 AND dns_resolves=true ORDER BY risk_score DESC LIMIT 10`, [value]),
        ])
        result.data.phishing = phish.data || []
        result.data.certs = certs.data || []
        result.data.typosquats = typos.data || []
        result.hits = (phish.data?.length || 0) + (certs.data?.length || 0) + (typos.data?.length || 0)
        break
      }
      default: {
        const [cves, exploits, malware, news, ransomware, darknet, apt, supply, secrets, mitre, yara, phishing] = await Promise.all([
          query(`SELECT cve_id, cvss_v3_severity, description FROM intel_cve_cache WHERE description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 LIMIT 8`, [`%${value}%`]),
          query(`SELECT exploit_id, title, cve_id FROM intel_exploit_cache WHERE title ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT sha256, malware_family, file_name FROM intel_malware_cache WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR file_name ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT title, url, category FROM intel_news_cache WHERE title ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT name, active, victim_count FROM intel_ransomware_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT title, threat_actor, source, severity FROM intel_darknet_posts WHERE content ILIKE $1 OR title ILIKE $1 OR threat_actor ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT campaign_name, threat_actor, description FROM intel_apt_campaigns WHERE threat_actor ILIKE $1 OR description ILIKE $1 OR campaign_name ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT osv_id, package_name, severity, summary FROM intel_supply_chain_cache WHERE package_name ILIKE $1 OR summary ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT repo_name, file_path, secret_type, risk_level FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT name, group_id, description FROM intel_mitre_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT rule_name, severity, target_family FROM intel_yara_rules WHERE rule_name ILIKE $1 OR target_family ILIKE $1 LIMIT 5`, [`%${value}%`]),
          query(`SELECT url, target_brand, active FROM intel_phishing_cache WHERE url ILIKE $1 OR target_brand ILIKE $1 LIMIT 5`, [`%${value}%`]),
        ])
        result.data.cves = cves.data || []
        result.data.exploits = exploits.data || []
        result.data.malware = malware.data || []
        result.data.news = news.data || []
        result.data.ransomware = ransomware.data || []
        result.data.darknet = darknet.data || []
        result.data.apt = apt.data || []
        result.data.supplyChain = supply.data || []
        result.data.secrets = secrets.data || []
        result.data.actors = mitre.data || []
        result.data.yara = yara.data || []
        result.data.phishing = phishing.data || []
        result.hits = (cves.data?.length || 0) + (exploits.data?.length || 0) + (malware.data?.length || 0) + (news.data?.length || 0)
          + (ransomware.data?.length || 0) + (darknet.data?.length || 0) + (apt.data?.length || 0)
          + (supply.data?.length || 0) + (secrets.data?.length || 0) + (mitre.data?.length || 0)
          + (yara.data?.length || 0) + (phishing.data?.length || 0)
      }
    }
  } catch { /* skip individual failures */ }

  return result
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ iocs: [] }))
  const iocs: string[] = body.iocs || []

  if (!Array.isArray(iocs) || iocs.length === 0 || iocs.length > 100) {
    return NextResponse.json({ success: false, error: "Provide 1-100 IOCs" }, { status: 400 })
  }

  const results = await Promise.all(
    iocs.map((ioc) => lookupOne(ioc.trim(), detectType(ioc.trim()))),
  )

  const withHits = results.filter((r) => r.hits > 0)
  const totalHits = withHits.reduce((s, r) => s + r.hits, 0)

  return NextResponse.json({
    success: true,
    data: {
      total: results.length,
      withHits: withHits.length,
      totalHits,
      results,
      empty: results.filter((r) => r.hits === 0).map((r) => r.value),
    },
  })
}
