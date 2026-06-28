// ================================================
// GET /api/intel/deep-search?q=acmecorp
// Single endpoint that returns EVERYTHING for a query:
//   • Breach records (from Quickwit)
//   • CVEs (matched by vendor/product/description)
//   • Exploits
//   • News articles
//   • Threat actors
//   • Ransomware groups + victims
//   • Dark-web posts
//   • Phishing URLs
//   • Malware samples
//   • Paste posts
//   • Stealer logs
//   • Compromised hosts
//   • Combolist drops
//   • Correlation clusters
//   • Sigma rules
//   • GitHub secrets
//   • Intel entities + findings
//   • Risk score + severity
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { authenticateRequest } from "@/lib/jwt"

export const dynamic = "force-dynamic"
export const revalidate = 0

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"

async function searchQuickwit(q: string, limit = 20) {
  try {
    const res = await fetch(`${QUICKWIT_URL}/api/v1/osint-data/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, max_hits: limit }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { hits: [], total: 0 }
    const data = await res.json()
    return { hits: data.hits || [], total: data.num_hits || 0 }
  } catch {
    return { hits: [], total: 0 }
  }
}

async function safeQuery(sql: string, params: unknown[]) {
  const r = await query(sql, params)
  return r.success ? (r.data || []) : []
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || ""
  if (q.length < 2) {
    return NextResponse.json({ success: false, error: "Query too short" }, { status: 400 })
  }

  const like = `%${q}%`
  const limit = 20

  const [
    quickwit,
    cves,
    exploits,
    news,
    actors,
    ransomwareGroups,
    ransomwareVictims,
    darknet,
    phishing,
    malware,
    pastes,
    stealerLogs,
    hosts,
    combolists,
    clusters,
    sigma,
    github,
    entities,
    findings,
    actorCveLinks,
    actorBreachLinks,
  ] = await Promise.all([
    searchQuickwit(q, limit),
    safeQuery(`SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, is_kev, vendor, product, published_at FROM intel_cve_cache WHERE cve_id ILIKE $1 OR description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 ORDER BY cvss_v3_score DESC NULLS LAST LIMIT $2`, [like, limit]),
    safeQuery(`SELECT exploit_id, cve_id, title, exploit_type, platform, published_at, verified FROM intel_exploit_cache WHERE title ILIKE $1 OR cve_id ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT guid, title, description, url, category, published_at FROM intel_news_cache WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT name, group_id, aliases, description, sectors, countries FROM intel_mitre_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT slug, name, description, victim_count, active, sectors, aliases FROM intel_ransomware_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT victim_name, group_name, country, sector, discovered_at, description FROM intel_ransomware_victims WHERE victim_name ILIKE $1 OR group_name ILIKE $1 OR description ILIKE $1 ORDER BY discovered_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at FROM intel_darknet_posts WHERE title ILIKE $1 OR content ILIKE $1 OR threat_actor ILIKE $1 OR victim_name ILIKE $1 ORDER BY discovered_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT phish_id, url, target_brand, phish_type, ip_address, country, active, reported_at FROM intel_phishing_cache WHERE url ILIKE $1 OR target_brand ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT sha256, file_name, malware_family, tags, source, iocs, first_seen FROM intel_malware_cache WHERE file_name ILIKE $1 OR malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR iocs::text ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT post_uid, source, title, excerpt, matched_brands, matched_cves, threat_actor, severity, discovered_at FROM intel_paste_posts WHERE title ILIKE $1 OR excerpt ILIKE $1 OR matched_brands::text ILIKE $1 OR threat_actor ILIKE $1 ORDER BY discovered_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, captured_at FROM intel_stealer_logs WHERE domain ILIKE $1 OR captured_url ILIKE $1 OR login_user ILIKE $1 ORDER BY captured_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT host_uid, hostname, country, os, stealer_family, credential_count, cookie_count, matched_domains, first_seen, last_seen, severity FROM intel_compromised_hosts WHERE hostname ILIKE $1 OR matched_domains::text ILIKE $1 OR host_uid ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT drop_uid, name, source, line_count, unique_domains, sample_domains, matched_brands, threat_actor, severity, posted_at FROM intel_combolist_drops WHERE name ILIKE $1 OR matched_brands::text ILIKE $1 OR sample_domains::text ILIKE $1 OR threat_actor ILIKE $1 ORDER BY posted_at DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT cluster_key, cluster_type, title, summary, risk_score, confidence, severity, signal_count, tags, related_cves, anchor_actor, anchor_ransomware, last_seen FROM intel_correlation_clusters WHERE title ILIKE $1 OR summary ILIKE $1 OR signals::text ILIKE $1 OR tags::text ILIKE $1 OR cluster_key ILIKE $1 ORDER BY risk_score DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT rule_id, title, description, level, logsource_product, technique_id, tags FROM intel_sigma_rules WHERE title ILIKE $1 OR description ILIKE $1 OR tags::text ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT finding_id, repo_name, file_path, secret_type, risk_level, still_exposed, discovered_at FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT id, entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen FROM intel_entities WHERE value ILIKE $1 OR normalized_value ILIKE $1 LIMIT $2`, [like, limit]),
    safeQuery(`SELECT id, finding_type, severity, risk_score, confidence, title, description, source_name, first_seen, last_seen FROM intel_findings WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY risk_score DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT actor_name, cve_id, relationship, confidence, first_seen, last_seen FROM intel_actor_cve_links WHERE actor_name ILIKE $1 OR cve_id ILIKE $1 ORDER BY confidence DESC LIMIT $2`, [like, limit]),
    safeQuery(`SELECT actor_name, victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity FROM intel_actor_breach_links WHERE actor_name ILIKE $1 OR victim_name ILIKE $1 ORDER BY breach_date DESC LIMIT $2`, [like, limit]),
  ])

  // Compute summary stats
  const totalSources = [
    quickwit.hits, cves, exploits, news, actors, ransomwareGroups, ransomwareVictims,
    darknet, phishing, malware, pastes, stealerLogs, hosts, combolists,
    clusters, sigma, github, entities, findings, actorCveLinks, actorBreachLinks,
  ].filter(arr => (Array.isArray(arr) ? arr.length : 0) > 0).length

  const maxRisk = Math.max(
    0,
    ...((cves as any[]).map(c => Number(c.cvss_v3_score) || 0)),
    ...((clusters as any[]).map(c => Number(c.risk_score) || 0)),
    ...((entities as any[]).map(e => Number(e.risk_score) || 0)),
    ...((findings as any[]).map(f => Number(f.risk_score) || 0)),
  )

  const severity = maxRisk >= 90 ? "critical" : maxRisk >= 70 ? "high" : maxRisk >= 45 ? "medium" : maxRisk >= 20 ? "low" : "info"

  return NextResponse.json({
    success: true,
    query: q,
    summary: {
      totalSources,
      totalHits: quickwit.total + (cves as any[]).length + (exploits as any[]).length + (news as any[]).length + (darknet as any[]).length + (clusters as any[]).length,
      riskScore: maxRisk,
      severity,
      breachRecords: quickwit.total,
    },
    breach: { hits: quickwit.hits, total: quickwit.total },
    cves,
    exploits,
    news,
    actors,
    ransomwareGroups,
    ransomwareVictims,
    darknet,
    phishing,
    malware,
    pastes,
    stealerLogs,
    hosts,
    combolists,
    clusters,
    sigma,
    github,
    entities,
    findings,
    actorCveLinks,
    actorBreachLinks,
  })
}
