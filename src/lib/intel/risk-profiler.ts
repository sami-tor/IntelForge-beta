// ================================================
// Organization Risk Profiler
// Given a tech stack, finds relevant CVEs, supply chain vulns, exploits
// ================================================
import { query } from "@/lib/db"

export interface TechStackItem {
  product: string
  version?: string
}

export interface RiskProfileResult {
  product: string
  version?: string
  cveMatches: { cveId: string; severity: string; score: number; description: string; isKev: boolean }[]
  supplyChainMatches: { osvId: string; packageName: string; severity: string; score: number; summary: string; fixedVersion?: string }[]
  exploitMatches: { exploitId: string; title: string; cveId?: string; pocUrl?: string }[]
  totalRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  riskScore: number
}

export async function profileTechStack(
  items: TechStackItem[],
): Promise<{ results: RiskProfileResult[]; overallRisk: string; totalCves: number }> {
  const results: RiskProfileResult[] = []

  for (const item of items) {
    const pattern = `%${item.product}%`
    const versionPattern = item.version ? `%${item.version}%` : null

    const [cves, supply, exploits] = await Promise.all([
      query(
        `SELECT cve_id, cvss_v3_severity, cvss_v3_score, description, is_kev
         FROM intel_cve_cache
         WHERE (vendor ILIKE $1 OR product ILIKE $1 OR description ILIKE $1)
         ORDER BY cvss_v3_score DESC NULLS LAST
         LIMIT 15`,
        [pattern],
      ),
      query(
        `SELECT osv_id, package_name, severity, cvss_v3_score, summary, fixed_version
         FROM intel_supply_chain_cache
         WHERE package_name ILIKE $1 OR summary ILIKE $1
         ORDER BY cvss_v3_score DESC NULLS LAST
         LIMIT 10`,
        [pattern],
      ),
      query(
        `SELECT exploit_id, title, cve_id, poc_url
         FROM intel_exploit_cache
         WHERE title ILIKE $1 OR description ILIKE $1
         ORDER BY published_at DESC
         LIMIT 10`,
        [pattern],
      ),
    ])

    const cveMatches = (cves.data || []).map((r: Record<string, unknown>) => ({
      cveId: String(r.cve_id),
      severity: String(r.cvss_v3_severity || "UNKNOWN"),
      score: Number(r.cvss_v3_score || 0),
      description: String(r.description || "").slice(0, 120),
      isKev: Boolean(r.is_kev),
    }))

    const supplyMatches = (supply.data || []).map((r: Record<string, unknown>) => ({
      osvId: String(r.osv_id),
      packageName: String(r.package_name),
      severity: String(r.severity || "UNKNOWN"),
      score: Number(r.cvss_v3_score || 0),
      summary: String(r.summary || "").slice(0, 120),
      fixedVersion: r.fixed_version ? String(r.fixed_version) : undefined,
    }))

    const exploitMatches = (exploits.data || []).map((r: Record<string, unknown>) => ({
      exploitId: String(r.exploit_id),
      title: String(r.title),
      cveId: r.cve_id ? String(r.cve_id) : undefined,
      pocUrl: r.poc_url ? String(r.poc_url) : undefined,
    }))

    // Calculate risk score for this product
    const criticalCves = cveMatches.filter((c) => c.severity === "CRITICAL" || c.isKev).length
    const highCves = cveMatches.filter((c) => c.severity === "HIGH").length
    const hasExploit = exploitMatches.length > 0

    const riskScore = Math.min(
      100,
      criticalCves * 25 + highCves * 10 + (hasExploit ? 20 : 0) + supplyMatches.length * 5,
    )

    let totalRisk: RiskProfileResult["totalRisk"] = "LOW"
    if (riskScore >= 60) totalRisk = "CRITICAL"
    else if (riskScore >= 30) totalRisk = "HIGH"
    else if (riskScore >= 10) totalRisk = "MEDIUM"

    results.push({
      product: item.product,
      version: item.version,
      cveMatches,
      supplyChainMatches: supplyMatches,
      exploitMatches,
      totalRisk,
      riskScore,
    })
  }

  // Overall risk = max of all products
  const maxRisk = Math.max(...results.map((r) => r.riskScore), 0)
  let overallRisk = "LOW"
  if (maxRisk >= 60) overallRisk = "CRITICAL"
  else if (maxRisk >= 30) overallRisk = "HIGH"
  else if (maxRisk >= 10) overallRisk = "MEDIUM"

  return {
    results: results.sort((a, b) => b.riskScore - a.riskScore),
    overallRisk,
    totalCves: results.reduce((s, r) => s + r.cveMatches.length, 0),
  }
}

// Popular tech stack suggestions
export const TECH_SUGGESTIONS = [
  { product: "nginx", label: "Nginx" },
  { product: "apache", label: "Apache HTTP Server" },
  { product: "postgresql", label: "PostgreSQL" },
  { product: "mysql", label: "MySQL" },
  { product: "redis", label: "Redis" },
  { product: "node.js", label: "Node.js" },
  { product: "react", label: "React" },
  { product: "next", label: "Next.js" },
  { product: "django", label: "Django" },
  { product: "spring", label: "Spring Framework" },
  { product: "kubernetes", label: "Kubernetes" },
  { product: "docker", label: "Docker" },
  { product: " mongodb", label: "MongoDB" },
  { product: "elasticsearch", label: "Elasticsearch" },
  { product: "jenkins", label: "Jenkins" },
]
