// ================================================
// External Attack Surface Report
// Given a domain: certs + subdomains + typosquats + github secrets + phishing
// ================================================
import { query } from "@/lib/db"
import { lookupCertTransparency, discoverSubdomainsFromCerts } from "@/lib/intel/fetchers/cert-transparency"
import { generateTyposquats } from "@/lib/intel/fetchers/typosquatting"

export interface AttackSurfaceReport {
  domain: string
  generatedAt: string
  certs: { total: number; wildcards: number; revoked: number; issuers: string[]; newest: string | null }
  subdomains: string[]
  typosquats: { total: number; highRisk: number; resolving: number; topRisks: { domain: string; type: string; riskScore: number }[] }
  githubSecrets: { total: number; critical: number; repos: string[] }
  phishingMentions: { total: number; active: number; brands: string[] }
  overallRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
}

export async function generateAttackSurfaceReport(domain: string): Promise<AttackSurfaceReport> {
  const d = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*/, "")

  const [
    certResult,
    certSubdomains,
    typosquats,
    githubSecrets,
    phishing,
  ] = await Promise.all([
    lookupCertTransparency(d).catch(() => ({ certs: [], subdomains: [] })),
    discoverSubdomainsFromCerts(d).catch(() => []),
    query(
      `SELECT variant_domain, variant_type, risk_score, dns_resolves, resolved_ip
       FROM intel_typosquat_cache
       WHERE original_domain = $1
       ORDER BY risk_score DESC LIMIT 50`,
      [d],
    ),
    query(
      `SELECT finding_id, repo_name, file_path, secret_type, risk_level, still_exposed
       FROM intel_github_secrets
       WHERE repo_name ILIKE $1 OR file_path ILIKE $1
       LIMIT 20`,
      [`%${d}%`],
    ),
    query(
      `SELECT phish_id, url, target_brand, active
       FROM intel_phishing_cache
       WHERE url ILIKE $1
       LIMIT 20`,
      [`%${d}%`],
    ),
  ])

  // Cert analysis
  const certs = certResult.certs || []
  const wildcards = certs.filter((c: any) => c.wildcard).length
  const revoked = certs.filter((c: any) => c.revoked).length
  const issuers = [...new Set(certs.map((c: any) => String(c.issuer || "")).filter(Boolean))] as string[]
  const newest = certs.length > 0
    ? certs.reduce((a: any, b: any) =>
        new Date(a.notAfter as string) > new Date(b.notAfter as string) ? a : b
      )
    : null

  // Typosquat analysis
  const typoRows = typosquats.data || []
  const highRisk = typoRows.filter((r: Record<string, unknown>) => Number(r.risk_score) >= 50).length
  const resolving = typoRows.filter((r: Record<string, unknown>) => r.dns_resolves).length

  // GitHub secrets
  const secretRows = githubSecrets.data || []
  const criticalSecrets = secretRows.filter((r: Record<string, unknown>) =>
    String(r.risk_level).toLowerCase() === "critical" && r.still_exposed
  ).length

  // Phishing
  const phishingRows = phishing.data || []
  const activePhish = phishingRows.filter((r: Record<string, unknown>) => r.active).length

  // Overall risk calculation
  const riskScore =
    (criticalSecrets > 0 ? 40 : 0) +
    (highRisk > 5 ? 25 : highRisk > 0 ? 15 : 0) +
    (activePhish > 0 ? 20 : 0) +
    (revoked > 0 ? 10 : 0) +
    (wildcards > 3 ? 5 : 0)

  let overallRisk: AttackSurfaceReport["overallRisk"] = "LOW"
  if (riskScore >= 60) overallRisk = "CRITICAL"
  else if (riskScore >= 35) overallRisk = "HIGH"
  else if (riskScore >= 15) overallRisk = "MEDIUM"

  return {
    domain: d,
    generatedAt: new Date().toISOString(),
    certs: {
      total: certs.length,
      wildcards,
      revoked,
      issuers: issuers.slice(0, 5),
      newest: newest ? String(newest.notAfter) : null,
    },
    subdomains: (certSubdomains || []).slice(0, 100),
    typosquats: {
      total: typoRows.length,
      highRisk,
      resolving,
      topRisks: typoRows
        .filter((r: Record<string, unknown>) => Number(r.risk_score) >= 40)
        .slice(0, 10)
        .map((r: Record<string, unknown>) => ({
          domain: String(r.variant_domain),
          type: String(r.variant_type),
          riskScore: Number(r.risk_score),
        })),
    },
    githubSecrets: {
      total: secretRows.length,
      critical: criticalSecrets,
      repos: [...new Set(secretRows.map((r: Record<string, unknown>) => String(r.repo_name)))].slice(0, 5) as string[],
    },
    phishingMentions: {
      total: phishingRows.length,
      active: activePhish,
      brands: [...new Set(phishingRows.map((r: Record<string, unknown>) => String(r.target_brand || "")).filter(Boolean))] as string[],
    },
    overallRisk,
  }
}
