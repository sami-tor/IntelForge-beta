import Link from "next/link"
import { Grid3x3, ExternalLink, Monitor } from "lucide-react"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

const TACTICS = [
  { value: "all", label: "All" },
  { value: "reconnaissance",     label: "Recon" },
  { value: "resource-development",label:"Resources" },
  { value: "initial-access",     label: "Initial Access" },
  { value: "execution",          label: "Execution" },
  { value: "persistence",        label: "Persistence" },
  { value: "privilege-escalation",label:"Priv Esc" },
  { value: "defense-evasion",    label: "Evasion" },
  { value: "credential-access",  label: "Credentials" },
  { value: "discovery",          label: "Discovery" },
  { value: "lateral-movement",   label: "Lateral Move" },
  { value: "collection",         label: "Collection" },
  { value: "command-and-control",label: "C2" },
  { value: "exfiltration",       label: "Exfil" },
  { value: "impact",             label: "Impact" },
]

const PLATFORM_ICON: Record<string, string> = {
  Windows: "🪟", Linux: "🐧", macOS: "🍎",
  Cloud: "☁", Containers: "📦", Network: "🌐", SaaS: "☁",
}

async function getTechniques(tactic?: string, search?: string) {
  const conditions = ["is_subtechnique = false"]
  const params: (string | number)[] = [200]

  if (tactic && tactic !== "all") {
    params.push(tactic)
    conditions.push(`$${params.length} = ANY(tactic)`)
  }
  if (search && search.length > 1) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR technique_id ILIKE $${params.length})`)
  }

  const r = await query(
    `SELECT stix_id, technique_id, name, description, tactic, platforms, detection, url
     FROM intel_mitre_techniques
     WHERE ${conditions.join(" AND ")}
     ORDER BY technique_id ASC
     LIMIT $1`,
    params,
  )
  return r.data || []
}

async function getTotalCount() {
  const r = await query(
    `SELECT COUNT(*) c FROM intel_mitre_techniques WHERE is_subtechnique=false`,
    [],
  )
  return Number(r.data?.[0]?.c) || 0
}

/** Stable, encoded query string for this page (avoids trailing ?/& and broken q= values). */
function attackPatternsHref(opts: {
  tactic?: string
  q?: string
  expand?: string | null
}) {
  const usp = new URLSearchParams()
  if (opts.tactic && opts.tactic !== "all") usp.set("tactic", opts.tactic)
  const q = opts.q?.trim()
  if (q) usp.set("q", q)
  if (opts.expand) usp.set("expand", opts.expand)
  const qs = usp.toString()
  return qs ? `/intelligence/attack-patterns?${qs}` : "/intelligence/attack-patterns"
}

export default async function AttackPatternsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const tactic = sp.tactic || "all"
  const search = sp.q || ""
  const expand = sp.expand || ""

  const [techniques, total] = await Promise.all([
    getTechniques(tactic, search),
    getTotalCount(),
  ])

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Attack Patterns</h1>
            <p className="text-xs text-muted-foreground">
              {techniques.length} of {total} techniques · enterprise attack knowledge base
            </p>
          </div>
        </div>
        <a
          href="https://attack.mitre.org/matrices/enterprise/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> Reference matrix
        </a>
      </div>

      {/* Search + tactic filters */}
      <div className="space-y-2">
        <form action="/intelligence/attack-patterns" method="GET">
          {tactic !== "all" && <input type="hidden" name="tactic" value={tactic} />}
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by technique ID (T1059) or name…"
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
        <div className="flex gap-1 flex-wrap">
          {TACTICS.map((t) => (
            <Link
              key={t.value}
              href={attackPatternsHref({
                tactic: t.value === "all" ? undefined : t.value,
                q: search || undefined,
              })}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap ${
                tactic === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Techniques list */}
      {techniques.length > 0 ? (
        <div className="space-y-1.5">
          {techniques.map((t: Record<string, unknown>) => {
            const tid = String(t.technique_id)
            const isExpanded = expand === tid
            const tactics = Array.isArray(t.tactic) ? (t.tactic as string[]) : []
            const platforms = Array.isArray(t.platforms) ? (t.platforms as string[]) : []

            return (
              <div key={String(t.stix_id)}
                className="rounded-lg border border-border bg-card hover:border-primary/25 transition-colors">
                <div className="flex items-stretch">
                  <Link
                    href={attackPatternsHref({
                      tactic: tactic !== "all" ? tactic : undefined,
                      q: search || undefined,
                      expand: isExpanded ? null : tid,
                    })}
                    className="flex flex-1 min-w-0 items-start gap-3 p-3"
                  >
                    <span className="font-mono text-xs font-bold text-primary shrink-0 w-16 mt-0.5">{tid}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{String(t.name)}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {tactics.map((tac) => (
                          <span key={tac}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground capitalize">
                            {tac.replace(/-/g, " ")}
                          </span>
                        ))}
                        {platforms.slice(0, 3).map((p) => (
                          <span key={p} className="text-[9px] text-muted-foreground">
                            {PLATFORM_ICON[p] || "💻"} {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0 self-start pt-0.5">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </Link>
                  {!!t.url && (
                    <a
                      href={String(t.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center px-3 border-l border-border/60 hover:bg-muted/40 transition-colors"
                      aria-label="Open technique reference"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </a>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2.5">
                    {!!t.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {String(t.description)}
                      </p>
                    )}
                    {!!t.detection && (
                      <div className="rounded bg-green-500/5 border border-green-500/15 p-2.5">
                        <p className="text-[10px] font-medium text-green-400 mb-1 flex items-center gap-1">
                          <Monitor className="h-3 w-3" /> Detection Guidance
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {String(t.detection)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Grid3x3 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search || tactic !== "all" ? "No techniques match your filter" : "No ATT&CK data cached yet"}
          </p>
        </div>
      )}
    </div>
  )
}
