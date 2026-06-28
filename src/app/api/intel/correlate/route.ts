// ================================================
// Intel Deep Correlate API
// Given any search query, searches ALL 19 intel tables
// Returns cross-linked results showing relationships
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

function detectQueryType(q: string): string {
  const v = q.trim()
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return "cve"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return "hash"
  if (/^https?:\/\//i.test(v)) return "url"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) && !v.includes(" ")) return "domain"
  return "keyword"
}

// ---- Specific correlators (exact match) ----
async function correlateCVE(cveId: string) {
  const upper = cveId.toUpperCase()
  const [cve, exploits, aptCampaigns, sigmaRules] = await Promise.all([
    query(
      `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, epss_percentile,
              is_kev, kev_due_date, kev_required_action, vendor, product, cwe, published_at, ref_urls
       FROM intel_cve_cache WHERE UPPER(cve_id) = UPPER($1) LIMIT 1`,
      [upper],
    ),
    query(
      `SELECT exploit_id, title, exploit_type, platform, poc_url, published_at
       FROM intel_exploit_cache WHERE UPPER(cve_id) = UPPER($1)
       ORDER BY published_at DESC LIMIT 5`,
      [upper],
    ),
    query(
      `SELECT campaign_id, campaign_name, threat_actor, description, confidence
       FROM intel_apt_campaigns WHERE cves::text ILIKE $1
       LIMIT 3`,
      [`%${upper}%`],
    ),
    query(
      `SELECT rule_id, title, level, logsource_product, technique_id
       FROM intel_sigma_rules WHERE references_urls::text ILIKE $1
       LIMIT 5`,
      [`%${upper}%`],
    ),
  ])
  return {
    cve: cve.data?.[0] || null,
    exploits: exploits.data || [],
    aptCampaigns: aptCampaigns.data || [],
    sigmaRules: sigmaRules.data || [],
  }
}

async function correlateHash(hash: string) {
  const l = hash.toLowerCase()
  const [sample, yaraMatches] = await Promise.all([
    query(
      `SELECT sha256, sha1, md5, file_name, file_type, malware_family, tags, source, iocs, first_seen, last_seen
       FROM intel_malware_cache
       WHERE LOWER(sha256)=$1 OR LOWER(sha1)=$1 OR LOWER(md5)=$1 LIMIT 1`,
      [l],
    ),
    query(
      `SELECT rule_name, description, category, severity, target_family
       FROM intel_yara_rules WHERE target_family::text ILIKE $1 LIMIT 5`,
      [`%${l}%`],
    ),
  ])
  return {
    sample: sample.data?.[0] || null,
    yaraRules: yaraMatches.data || [],
  }
}

async function correlateIp(ip: string) {
  const [malware, phishing, iocLookups] = await Promise.all([
    query(
      `SELECT sha256, file_name, malware_family, tags, source, raw_url, iocs, first_seen
       FROM intel_malware_cache WHERE iocs::text ILIKE $1 OR raw_url ILIKE $1 LIMIT 5`,
      [`%${ip}%`],
    ),
    query(
      `SELECT phish_id, url, target_brand, phish_type, active, reported_at
       FROM intel_phishing_cache WHERE ip_address = $1 LIMIT 5`,
      [ip],
    ),
    query(
      `SELECT ioc_value, ioc_type, result->>'verdict' as verdict, result->>'confidenceScore' as confidence, queried_at
       FROM intel_ioc_lookups WHERE ioc_value = $1 ORDER BY queried_at DESC LIMIT 3`,
      [ip],
    ),
  ])
  return {
    malwareIocs: malware.data || [],
    phishing: phishing.data || [],
    iocLookups: iocLookups.data || [],
  }
}

async function correlateDomain(domain: string) {
  const d = domain.toLowerCase()
  const [malware, phishing, certs, typos] = await Promise.all([
    query(
      `SELECT sha256, file_name, malware_family, tags, source, raw_url, iocs, first_seen
       FROM intel_malware_cache WHERE iocs::text ILIKE $1 OR raw_url ILIKE $1 LIMIT 3`,
      [`%${d}%`],
    ),
    query(
      `SELECT phish_id, url, target_brand, phish_type, active, reported_at
       FROM intel_phishing_cache WHERE url ILIKE $1 LIMIT 5`,
      [`%${d}%`],
    ),
    query(
      `SELECT domain, issuer, not_before, not_after, wildcard, revoked, crt_sh_id, logged_at
       FROM intel_cert_cache WHERE domain = $1 OR $1 = ANY(subject_alt_names)
       ORDER BY logged_at DESC LIMIT 5`,
      [d],
    ),
    query(
      `SELECT variant_domain, variant_type, levenshtein_distance, dns_resolves, resolved_ip, is_malicious, risk_score
       FROM intel_typosquat_cache WHERE original_domain = $1 AND dns_resolves = true
       ORDER BY risk_score DESC LIMIT 10`,
      [d],
    ),
  ])
  return {
    malwareIocs: malware.data || [],
    phishing: phishing.data || [],
    certs: certs.data || [],
    typosquats: typos.data || [],
  }
}

async function correlateUrl(url: string) {
  const [phishing, malware] = await Promise.all([
    query(
      `SELECT phish_id, url, target_brand, phish_type, active, reported_at
       FROM intel_phishing_cache WHERE url = $1 LIMIT 3`,
      [url],
    ),
    query(
      `SELECT sha256, raw_url, malware_family, tags, source, first_seen
       FROM intel_malware_cache WHERE raw_url ILIKE $1 LIMIT 5`,
      [`%${url}%`],
    ),
  ])
  return {
    phishing: phishing.data || [],
    malwareUrls: malware.data || [],
  }
}

// ---- Keyword search (ALL tables) ----
async function correlateKeyword(q: string) {
  const like = `%${q}%`

  const [
    news, cves, groups, victims, malware, actors, techniques,
    exploits, phishing, supplyChain, sigma, darknet,
    aptCampaigns, githubSecrets, yaraRules,
  ] = await Promise.all([
    query(`SELECT title, url, category, published_at FROM intel_news_cache WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 5`, [like]),
    query(`SELECT cve_id, description, cvss_v3_severity, cvss_v3_score, is_kev, vendor, product FROM intel_cve_cache WHERE description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 OR cve_id ILIKE $1 ORDER BY published_at DESC LIMIT 5`, [like]),
    query(`SELECT slug, name, description, active, victim_count, sectors, aliases FROM intel_ransomware_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT victim_name, group_name, country, sector, discovered_at FROM intel_ransomware_victims WHERE victim_name ILIKE $1 OR group_name ILIKE $1 OR country ILIKE $1 ORDER BY discovered_at DESC LIMIT 3`, [like]),
    query(`SELECT sha256, file_name, malware_family, tags, source, first_seen FROM intel_malware_cache WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR file_name ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT name, group_id, aliases, description, techniques, sectors FROM intel_mitre_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT technique_id, name, tactic, platforms, description FROM intel_mitre_techniques WHERE technique_id ILIKE $1 OR name ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    // NEW tables
    query(`SELECT exploit_id, title, cve_id, exploit_type, platform, poc_url, published_at FROM intel_exploit_cache WHERE title ILIKE $1 OR cve_id ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 3`, [like]),
    query(`SELECT phish_id, url, target_brand, phish_type, active, reported_at FROM intel_phishing_cache WHERE url ILIKE $1 OR target_brand ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT osv_id, package_name, package_ecosystem, summary, severity, cvss_v3_score, fixed_version, aliases FROM intel_supply_chain_cache WHERE package_name ILIKE $1 OR summary ILIKE $1 OR aliases::text ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT rule_id, title, level, status, logsource_product, technique_id, description FROM intel_sigma_rules WHERE title ILIKE $1 OR description ILIKE $1 OR tags::text ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT post_uid, source, title, threat_actor, victim_name, victim_sector, severity, leak_type, discovered_at FROM intel_darknet_posts WHERE title ILIKE $1 OR threat_actor ILIKE $1 OR victim_name ILIKE $1 OR content ILIKE $1 ORDER BY discovered_at DESC LIMIT 5`, [like]),
    query(`SELECT campaign_id, campaign_name, threat_actor, target_sectors, target_countries, is_active, confidence, description FROM intel_apt_campaigns WHERE campaign_name ILIKE $1 OR threat_actor ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT finding_id, repo_name, file_path, secret_type, risk_level, still_exposed, discovered_at FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 LIMIT 3`, [like]),
    query(`SELECT rule_name, description, category, severity, target_family, mitre_techniques FROM intel_yara_rules WHERE rule_name ILIKE $1 OR description ILIKE $1 OR target_family::text ILIKE $1 LIMIT 3`, [like]),
  ])

  return {
    news:            news.data || [],
    cves:            cves.data || [],
    groups:          groups.data || [],
    victims:         victims.data || [],
    malware:         malware.data || [],
    actors:          actors.data || [],
    techniques:      techniques.data || [],
    exploits:        exploits.data || [],
    phishing:        phishing.data || [],
    supplyChain:     supplyChain.data || [],
    sigma:           sigma.data || [],
    darknet:         darknet.data || [],
    aptCampaigns:    aptCampaigns.data || [],
    githubSecrets:   githubSecrets.data || [],
    yaraRules:       yaraRules.data || [],
  }
}

async function getRelatedNews(q: string) {
  const r = await query(
    `SELECT title, url, category, published_at FROM intel_news_cache
     WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 4`,
    [`%${q}%`],
  )
  return r.data || []
}

// ---- Main handler ----
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || ""
  if (q.length < 2) {
    return NextResponse.json({ success: true, type: "none", data: {} })
  }

  const type = detectQueryType(q)
  const news = await getRelatedNews(q)

  try {
    switch (type) {
      case "cve": {
        const result = await correlateCVE(q)
        return NextResponse.json({ success: true, type: "cve", data: { ...result, news }, query: q })
      }
      case "hash": {
        const result = await correlateHash(q)
        return NextResponse.json({ success: true, type: "hash", data: { ...result, news }, query: q })
      }
      case "ip": {
        const result = await correlateIp(q)
        return NextResponse.json({ success: true, type: "ip", data: { ...result, news }, query: q })
      }
      case "domain": {
        const result = await correlateDomain(q)
        return NextResponse.json({ success: true, type: "domain", data: { ...result, news }, query: q })
      }
      case "url": {
        const result = await correlateUrl(q)
        return NextResponse.json({ success: true, type: "url", data: { ...result, news }, query: q })
      }
      default: {
        const kw = await correlateKeyword(q)
        return NextResponse.json({ success: true, type: "keyword", data: { ...kw, news }, query: q })
      }
    }
  } catch (err) {
    return NextResponse.json({ success: false, type: "none", data: {}, error: String(err) })
  }
}
