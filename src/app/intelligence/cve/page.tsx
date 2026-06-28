import Link from "next/link"
import { ShieldAlert, AlertTriangle, ExternalLink, Bomb, CalendarClock, ChevronDown, ChevronUp } from "lucide-react"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

const SEVERITIES = ["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"]

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/25",
  HIGH:     "bg-orange-500/15 text-orange-400 border-orange-500/25",
  MEDIUM:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  LOW:      "bg-green-500/15 text-green-400 border-green-500/25",
}

const SCORE_COLOR = (s: number) =>
  s >= 9 ? "text-red-400" : s >= 7 ? "text-orange-400" : s >= 4 ? "text-yellow-400" : "text-green-400"

async function getCves(severity?: string, kevOnly = false) {
  const conditions: string[] = []
  const params: (string | number | boolean)[] = [60]

  if (severity && severity !== "all") {
    params.push(severity)
    conditions.push(`cvss_v3_severity = $${params.length}`)
  }
  if (kevOnly) conditions.push(`is_kev = true`)

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const r = await query(
    `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, epss_percentile,
            is_kev, kev_added_date, kev_due_date, kev_required_action, vendor, product, published_at
     FROM intel_cve_cache
     ${where}
     ORDER BY ${kevOnly ? "kev_added_date" : "published_at"} DESC NULLS LAST
     LIMIT $1`,
    params,
  )
  return r.data || []
}

async function getCveCounts() {
  const r = await query(
    `SELECT cvss_v3_severity, COUNT(*) cnt FROM intel_cve_cache
     WHERE cvss_v3_severity IS NOT NULL
     GROUP BY cvss_v3_severity`,
    [],
  )
  const counts: Record<string, number> = {}
  ;(r.data || []).forEach((row: Record<string, unknown>) => {
    counts[String(row.cvss_v3_severity)] = Number(row.cnt)
  })
  return counts
}

// Cross-reference: fetch related exploits for CVEs on this page
async function getRelatedExploits(cveIds: string[]) {
  if (cveIds.length === 0) return {}
  const upper = cveIds.map((c) => c.toUpperCase())
  const r = await query(
    `SELECT exploit_id, cve_id, title, exploit_type, poc_url, published_at
     FROM intel_exploit_cache WHERE UPPER(cve_id) = ANY($1)
     ORDER BY published_at DESC LIMIT 100`,
    [upper],
  )
  const map: Record<string, Record<string, unknown>[]> = {}
  for (const row of (r.data || [])) {
    const key = String(row.cve_id).toUpperCase()
    if (!map[key]) map[key] = []
    map[key].push(row)
  }
  return map
}

// Cross-reference: fetch related APT campaigns for CVEs on this page
async function getRelatedAptCampaigns(cveIds: string[]) {
  if (cveIds.length === 0) return {}
  const r = await query(
    `SELECT campaign_id, campaign_name, threat_actor, description, confidence, cves, is_active
     FROM intel_apt_campaigns`,
    [],
  )
  const map: Record<string, Record<string, unknown>[]> = {}
  for (const row of (r.data || [])) {
    const cves: string[] = Array.isArray(row.cves) ? row.cves : []
    for (const cveId of cveIds) {
      if (cves.some((c: string) => c.toUpperCase() === cveId.toUpperCase())) {
        const key = cveId.toUpperCase()
        if (!map[key]) map[key] = []
        map[key].push(row)
      }
    }
  }
  return map
}

function epssBar(score: number) {
  const pct = Math.round(score * 100)
  const color = pct >= 50 ? "bg-red-500" : pct >= 10 ? "bg-orange-500" : "bg-green-500"
  return { pct, color }
}

export default async function CVEPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const severity = sp.severity || "all"
  const kevOnly = sp.kev === "1"
  const view = sp.view || "recent"

  const [cves, counts] = await Promise.all([
    getCves(view === "kev" || kevOnly ? undefined : severity, view === "kev"),
    getCveCounts(),
  ])

  const cveIds = cves.map((c: Record<string, unknown>) => String(c.cve_id))
  const [relatedExploits, relatedApt] = await Promise.all([
    getRelatedExploits(cveIds),
    getRelatedAptCampaigns(cveIds),
  ])

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold">CVE Intelligence</h1>
          <p className="text-xs text-muted-foreground">
            {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()} vulnerabilities cached · updated every 6 hours
          </p>
        </div>
      </div>

      {/* Tab + Severity filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <Link
            href="/intelligence/cve"
            className={`text-sm px-4 py-2 border-b-2 transition-colors ${
              view !== "kev"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Recent CVEs
          </Link>
          <Link
            href="/intelligence/cve?view=kev"
            className={`flex items-center gap-1.5 text-sm px-4 py-2 border-b-2 transition-colors ${
              view === "kev"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Known Exploited
          </Link>
        </div>

        {/* Severity filter (only for recent view) */}
        {view !== "kev" && (
          <div className="flex gap-1 flex-wrap">
            {SEVERITIES.map((s) => (
              <Link
                key={s}
                href={s === "all" ? "/intelligence/cve" : `/intelligence/cve?severity=${s}`}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  severity === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s === "all" ? "All" : s}
                {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KEV banner */}
      {view === "kev" && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <strong>Known Exploited Vulnerabilities (KEV):</strong> These have confirmed active exploitation.
          Federal agencies are mandated to patch by the listed due date.
        </div>
      )}

      {/* CVE list */}
      {cves.length > 0 ? (
        <div className="space-y-2">
          {cves.map((cve: Record<string, unknown>) => {
            const score = Number(cve.cvss_v3_score)
            const epss = Number(cve.epss_score)
            const { pct, color } = epss > 0 ? epssBar(epss) : { pct: 0, color: "" }
            const cveId = String(cve.cve_id)
            const exploits = relatedExploits[cveId.toUpperCase()] || []
            const aptCampaigns = relatedApt[cveId.toUpperCase()] || []
            const hasRelated = exploits.length > 0 || aptCampaigns.length > 0

            return (
              <div key={cveId}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/25 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      {cveId}
                    </a>
                    {!!cve.cvss_v3_severity && (
                      <span className={`text-[10px] rounded border px-1.5 py-0.5 ${SEVERITY_STYLE[String(cve.cvss_v3_severity)] || ""}`}>
                        {String(cve.cvss_v3_severity)}
                      </span>
                    )}
                    {!!cve.is_kev && (
                      <span className="text-[10px] rounded border px-1.5 py-0.5 bg-red-600/15 text-red-400 border-red-600/25 font-semibold">
                        KEV
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {score > 0 && (
                      <span className={`text-sm font-bold ${SCORE_COLOR(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    )}
                    <a href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                      target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                    </a>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                  {String(cve.description)}
                </p>

                <div className="flex items-center gap-4 flex-wrap text-[10px]">
                  {epss > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Exploit risk:</span>
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                  )}
                  {!!cve.vendor && (
                    <span className="text-muted-foreground">
                      {String(cve.vendor)}{cve.product ? ` · ${String(cve.product)}` : ""}
                    </span>
                  )}
                  {hasRelated && (
                    <span className="text-muted-foreground ml-auto flex items-center gap-1">
                      <Bomb className="h-2.5 w-2.5 text-red-400" /> {exploits.length} exploit{exploits.length !== 1 ? "s" : ""}
                      {aptCampaigns.length > 0 && <> · <CalendarClock className="h-2.5 w-2.5 text-purple-400" /> {aptCampaigns.length} campaign{aptCampaigns.length !== 1 ? "s" : ""}</>}
                    </span>
                  )}
                </div>

                {!!cve.is_kev && !!cve.kev_due_date && (
                  <div className="mt-2 rounded bg-red-500/8 border border-red-500/15 px-2.5 py-1.5">
                    <p className="text-[10px] text-red-400">
                      ⚠ Patch deadline: {String(cve.kev_due_date)} — {String(cve.kev_required_action || "Required action not specified")}
                    </p>
                  </div>
                )}

                {/* Cross-referenced Intel */}
                {hasRelated && (
                  <details className="mt-3 group">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1 list-none">
                      <span className="group-open:hidden">▸</span>
                      <span className="hidden group-open:inline">▾</span> Related Intelligence
                    </summary>
                    <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-border">
                      {exploits.map((e: Record<string, unknown>) => (
                        <div key={String(e.exploit_id)} className="flex items-center gap-2 text-[10px] py-0.5">
                          <Bomb className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="font-mono text-red-400">{String(e.exploit_id)}</span>
                          <span className="text-zinc-400 truncate">{String(e.title)}</span>
                          {Boolean(e.poc_url) && (
                            <a href={String(e.poc_url)} target="_blank" rel="noopener noreferrer" className="text-[9px] text-red-400 hover:underline shrink-0">PoC →</a>
                          )}
                        </div>
                      ))}
                      {aptCampaigns.map((c: Record<string, unknown>) => (
                        <Link key={String(c.campaign_id)} href="/intelligence/apt-campaigns"
                          className="flex items-center gap-2 text-[10px] py-0.5 hover:text-purple-400 transition-colors">
                          <CalendarClock className="h-3 w-3 text-purple-400 shrink-0" />
                          <span className="text-purple-300 font-medium">{String(c.campaign_name)}</span>
                          <span className="text-zinc-500">by {String(c.threat_actor)}</span>
                          {!!c.is_active && <span className="text-[9px] text-green-400">Active</span>}
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No CVE data cached yet
        </div>
      )}
    </div>
  )
}
