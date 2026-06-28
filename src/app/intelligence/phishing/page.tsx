import Link from "next/link"
import { getPhishing, getPhishingStats } from "@/lib/intel/fetchers/phishing"
import { query } from "@/lib/db"
import { Fish, ExternalLink, ShieldAlert, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return u.hostname.toLowerCase()
  } catch { return "" }
}

async function getPhishingDomains(): Promise<Set<string>> {
  const r = await query(
    `SELECT DISTINCT url FROM intel_phishing_cache WHERE url IS NOT NULL LIMIT 500`,
    [],
  )
  const domains = new Set<string>()
  for (const row of (r.data || [])) {
    const d = extractDomain(String(row.url))
    if (d) domains.add(d)
  }
  return domains
}

async function getTyposquatMatches(domains: string[]): Promise<Record<string, number>> {
  if (domains.length === 0) return {}
  const r = await query(
    `SELECT original_domain, COUNT(*) as cnt FROM intel_typosquat_cache
     WHERE original_domain = ANY($1) AND dns_resolves = true
     GROUP BY original_domain`,
    [domains],
  )
  const map: Record<string, number> = {}
  for (const row of (r.data || [])) {
    map[String(row.original_domain)] = Number(row.cnt)
  }
  return map
}

export default async function PhishingIntelPage() {
  const [phishing, stats] = await Promise.all([
    getPhishing(100, undefined, true),
    getPhishingStats(),
  ])

  const allDomains = Array.from(await getPhishingDomains())
  const typosquatCounts = await getTyposquatMatches(allDomains)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Phishing Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Active phishing campaigns from OpenPhish & PhishTank — track credential harvesting targeting major brands
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Phishing Sites</p>
          <p className="text-2xl font-bold text-red-400">{stats.totalActive}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Last 24 Hours</p>
          <p className="text-2xl font-bold text-orange-400">{stats.recent24h}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 col-span-2">
          <p className="text-xs text-muted-foreground mb-2">Top Targeted Brands</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.topBrands.map((b) => (
              <span key={b.brand} className="text-[10px] rounded-full px-2 py-0.5 bg-red-500/10 text-red-400 font-medium">
                {b.brand} ({b.count})
              </span>
            ))}
            {stats.topBrands.length === 0 && (
              <span className="text-xs text-muted-foreground">No brand data yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Phishing list */}
      <div className="space-y-2">
        {phishing.map((p) => {
          const domain = extractDomain(p.url)
          const typosquatCount = typosquatCounts[domain] || 0
          const brandDomain = p.targetBrand ? `${p.targetBrand.toLowerCase().replace(/\s+/g, "")}.com` : ""

          return (
          <div key={p.phishId} className="rounded-lg border border-border bg-card p-3 hover:border-red-500/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-foreground truncate">{p.url}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {p.targetBrand && (
                    <Link href={`/intelligence/typosquatting?q=${encodeURIComponent(brandDomain)}`}
                      className="text-[9px] rounded px-1.5 py-0.5 bg-orange-500/20 text-orange-400 font-medium hover:bg-orange-500/30 transition-colors">
                      {p.targetBrand}
                    </Link>
                  )}
                  <span className={`text-[9px] rounded px-1.5 py-0.5 ${p.active ? "bg-green-500/20 text-green-400" : "bg-muted/30 text-muted-foreground"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-[9px] rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-400">{p.source}</span>
                </div>
                {/* Cross-reference: Typosquat matches */}
                {typosquatCount > 0 && (
                  <Link href={`/intelligence/typosquatting?q=${encodeURIComponent(domain)}`}
                    className="inline-flex items-center gap-1 mt-1.5 text-[9px] text-orange-400 hover:text-orange-300 hover:underline">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {typosquatCount} typosquat variant{typosquatCount !== 1 ? "s" : ""} found for {domain} →
                  </Link>
                )}
              </div>
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )})}
      </div>

      {phishing.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Fish className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No phishing data cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
