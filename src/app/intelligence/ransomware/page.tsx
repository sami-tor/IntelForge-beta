import Link from "next/link"
import { Skull, Users, Globe, Building2, TrendingUp, AlertTriangle, Eye, ShieldAlert } from "lucide-react"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function getGroups() {
  const r = await query(
    `SELECT slug, name, description, first_seen, victim_count, active, locations, sectors, aliases
     FROM intel_ransomware_groups
     ORDER BY active DESC, victim_count DESC, name ASC
     LIMIT 100`,
    [],
  )
  return r.data || []
}

async function getVictims() {
  const r = await query(
    `SELECT victim_name, url, group_name, discovered_at, country, sector
     FROM intel_ransomware_victims
     WHERE discovered_at > NOW() - INTERVAL '30 days' OR discovered_at IS NULL
     ORDER BY discovered_at DESC NULLS LAST
     LIMIT 100`,
    [],
  )
  return r.data || []
}

async function getStats() {
  const [g, v30, v7, sectors, countries, topGroups] = await Promise.all([
    query(`SELECT COUNT(*) total, SUM(CASE WHEN active THEN 1 ELSE 0 END) active FROM intel_ransomware_groups`, []),
    query(`SELECT COUNT(*) c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '30 days'`, []),
    query(`SELECT COUNT(*) c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '7 days'`, []),
    query(`SELECT sector, COUNT(*) cnt FROM intel_ransomware_victims WHERE sector IS NOT NULL AND discovered_at > NOW() - INTERVAL '90 days' GROUP BY sector ORDER BY cnt DESC LIMIT 6`, []),
    query(`SELECT country, COUNT(*) cnt FROM intel_ransomware_victims WHERE country IS NOT NULL AND discovered_at > NOW() - INTERVAL '90 days' GROUP BY country ORDER BY cnt DESC LIMIT 6`, []),
    query(`SELECT group_name name, COUNT(*) cnt FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '30 days' GROUP BY group_name ORDER BY cnt DESC LIMIT 8`, []),
  ])
  return {
    totalGroups:  Number(g.data?.[0]?.total) || 0,
    activeGroups: Number(g.data?.[0]?.active) || 0,
    victims30d:   Number(v30.data?.[0]?.c) || 0,
    victims7d:    Number(v7.data?.[0]?.c) || 0,
    sectors:      (sectors.data || []) as { sector: string; cnt: number }[],
    countries:    (countries.data || []) as { country: string; cnt: number }[],
    topGroups:    (topGroups.data || []) as { name: string; cnt: number }[],
  }
}

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function RansomwarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const view = sp.view || "groups"

  const [groups, victims, stats] = await Promise.all([getGroups(), getVictims(), getStats()])

  const TABS = [
    { value: "groups",  label: `Groups (${stats.activeGroups} active)` },
    { value: "victims", label: `Recent Victims (${stats.victims30d})` },
    { value: "sectors", label: "Sector Analysis" },
  ]

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Skull className="h-5 w-5 text-red-500" />
        <div>
          <h1 className="text-xl font-bold">Ransomware Tracker</h1>
          <p className="text-xs text-muted-foreground">Active groups, recent victims and attack patterns</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Groups",  value: stats.activeGroups, icon: Skull,        color: "text-red-400" },
          { label: "Victims (30d)",  value: stats.victims30d,   icon: TrendingUp,   color: "text-orange-400" },
          { label: "Victims (7d)",   value: stats.victims7d,    icon: AlertTriangle,color: "text-red-400" },
          { label: "Total Tracked",  value: stats.totalGroups,  icon: Users,        color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs via URL params */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/intelligence/ransomware?view=${t.value}`}
            className={`text-sm px-4 py-2 border-b-2 transition-colors ${
              view === t.value
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Groups */}
      {view === "groups" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.length > 0 ? groups.map((g: Record<string, unknown>) => (
            <div key={String(g.slug)}
              className="rounded-xl border border-border bg-card p-4 hover:border-red-500/20 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    <Link href={`/intelligence/darknet?q=${encodeURIComponent(String(g.name))}`}
                      className="hover:text-primary hover:underline transition-colors">
                      {String(g.name)}
                    </Link>
                  </p>
                  {!!g.first_seen && (
                    <p className="text-[10px] text-muted-foreground">
                      Since {String(g.first_seen).split("T")[0]}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                  g.active
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}>
                  {g.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="flex items-center gap-1 mb-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {Number(g.victim_count) || 0} victims tracked
                </span>
              </div>
              {!!g.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {String(g.description)}
                </p>
              )}
              {Array.isArray(g.sectors) && g.sectors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(g.sectors as string[]).slice(0, 3).map((s) => (
                    <span key={s}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-muted/30">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <div className="col-span-3 rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No group data cached yet
            </div>
          )}
        </div>
      )}

      {/* Victims table */}
      {view === "victims" && (
        <div className="rounded-xl border border-border overflow-hidden">
          {victims.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Group</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Sector</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {victims.map((v: Record<string, unknown>, i: number) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/10">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{String(v.victim_name)}</p>
                        {!!v.url && (
                          <a href={String(v.url)} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-primary hover:underline truncate max-w-[180px] block">
                            {String(v.url).replace(/^https?:\/\//, "").slice(0, 40)}
                          </a>
                        )}
                      </td>
                      <td className="p-3">
                        <Link href={`/intelligence/darknet?q=${encodeURIComponent(String(v.group_name))}`}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                          {String(v.group_name)}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {v.sector ? <span className="flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{String(v.sector)}</span> : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {v.country ? <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{String(v.country)}</span> : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(v.discovered_at as Date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No victim data in the last 30 days
            </div>
          )}
        </div>
      )}

      {/* Sector analysis */}
      {view === "sectors" && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-400" /> Top Targeted Sectors
            </h3>
            {stats.sectors.length > 0 ? stats.sectors.map((s) => {
              const max = Number(stats.sectors[0]?.cnt) || 1
              return (
                <div key={s.sector} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{s.sector}</span>
                    <span className="text-muted-foreground">{s.cnt}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${(Number(s.cnt) / max) * 100}%` }} />
                  </div>
                </div>
              )
            }) : (
              <p className="text-xs text-muted-foreground">No sector data available</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-400" /> Top Targeted Countries
            </h3>
            {stats.countries.length > 0 ? stats.countries.map((c) => {
              const max = Number(stats.countries[0]?.cnt) || 1
              return (
                <div key={c.country} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{c.country}</span>
                    <span className="text-muted-foreground">{c.cnt}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(Number(c.cnt) / max) * 100}%` }} />
                  </div>
                </div>
              )
            }) : (
              <p className="text-xs text-muted-foreground">No country data available</p>
            )}
          </div>
        </div>
      )}

      {/* Cross-reference links */}
      {(groups.length > 0 || victims.length > 0) && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/intelligence/darknet"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Dark Web Monitor
            </Link>
            <Link href="/intelligence/threat-actors"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Threat Actors
            </Link>
            <Link href="/intelligence/actor-report"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Actor Report
            </Link>
            <Link href="/intelligence/apt-campaigns"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              APT Campaigns
            </Link>
            <Link href="/intelligence/phishing"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Phishing Intel
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
