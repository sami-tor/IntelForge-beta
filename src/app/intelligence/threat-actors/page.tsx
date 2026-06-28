import Link from "next/link"
import { Users, ExternalLink, Skull, CalendarClock, Bug } from "lucide-react"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function getGroups(search?: string) {
  const params: (string | number)[] = [150]
  let where = ""

  if (search && search.length > 1) {
    params.push(`%${search}%`)
    where = `WHERE (name ILIKE $2 OR aliases::text ILIKE $2 OR group_id ILIKE $2)`
  }

  const r = await query(
    `SELECT stix_id, name, group_id, aliases, description, url, techniques
     FROM intel_mitre_groups
     ${where}
     ORDER BY name ASC
     LIMIT $1`,
    params,
  )
  return r.data || []
}

export default async function ThreatActorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const search = sp.q || ""

  const groups = await getGroups(search)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-green-400" />
        <div>
          <h1 className="text-xl font-bold">Threat Actors</h1>
          <p className="text-xs text-muted-foreground">
            {groups.length} APT groups and advanced persistent threat actors
          </p>
        </div>
      </div>

      {/* Search — submits as URL param for SSR */}
      <form action="/intelligence/threat-actors" method="GET">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name, alias or group ID (e.g. APT28, G0007)…"
          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </form>

      {search && (
        <p className="text-xs text-muted-foreground">
          {groups.length} result{groups.length !== 1 ? "s" : ""} for &quot;{search}&quot; ·{" "}
          <Link href="/intelligence/threat-actors" className="text-primary hover:underline">Clear</Link>
        </p>
      )}

      {/* Grid */}
      {groups.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map((g: Record<string, unknown>) => {
            const techniques = Array.isArray(g.techniques) ? (g.techniques as string[]) : []
            const aliases = Array.isArray(g.aliases) ? (g.aliases as string[]) : []

            return (
              <div key={String(g.stix_id)}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/intelligence/actor-report?q=${encodeURIComponent(String(g.name))}`}
                        className="font-semibold text-sm text-foreground hover:text-primary hover:underline transition-colors">
                        {String(g.name)}
                      </Link>
                      {!!g.group_id && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-green-400/25 text-green-400 bg-green-400/5">
                          {String(g.group_id)}
                        </span>
                      )}
                    </div>
                    {aliases.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {aliases.slice(0, 4).join(", ")}
                        {aliases.length > 4 ? ` +${aliases.length - 4}` : ""}
                      </p>
                    )}
                  </div>
                  {!!g.url && (
                    <a href={String(g.url)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                    </a>
                  )}
                </div>

                {!!g.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-3 mb-2">
                    {String(g.description)}
                  </p>
                )}

                {techniques.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wide">
                      Techniques ({techniques.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {techniques.slice(0, 12).map((t) => (
                        <Link
                          key={t}
                          href={`/intelligence/attack-patterns?q=${encodeURIComponent(t)}`}
                          className="text-[9px] px-1.5 py-0.5 rounded font-mono border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10"
                        >
                          {t}
                        </Link>
                      ))}
                      {techniques.length > 12 && (
                        <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground">
                          +{techniques.length - 12}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? `No results for "${search}"` : "No threat actor data cached yet"}
          </p>
        </div>
      )}

      {/* Cross-reference links */}
      {groups.length > 0 && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/intelligence/apt-campaigns"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              APT Campaigns
            </Link>
            <Link href="/intelligence/malware"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Malware Intel
            </Link>
            <Link href="/intelligence/ransomware"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Ransomware Tracker
            </Link>
            <Link href="/intelligence/darknet"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Dark Web Monitor
            </Link>
            <Link href="/intelligence/attack-patterns"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Attack Patterns
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
