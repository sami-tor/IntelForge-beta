import Link from "next/link"
import { getCampaigns, getCampaignTimeline } from "@/lib/intel/fetchers/apt-campaigns"
import { CalendarClock, Users, Building, Globe, Shield, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AptCampaignsPage() {
  const [{ campaigns, timeline }] = await Promise.all([
    getCampaignTimeline(),
  ])

  const activeCampaigns = campaigns.filter((c) => c.isActive)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">APT Campaign Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Well-documented APT campaigns — track threat actor activity, targeted sectors, and exploited CVEs over time
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Campaigns</p>
          <p className="text-2xl font-bold">{campaigns.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-400">{activeCampaigns.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Unique Actors</p>
          <p className="text-2xl font-bold text-purple-400">
            {new Set(campaigns.map((c) => c.threatActor)).size}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Years Covered</p>
          <p className="text-2xl font-bold text-blue-400">{timeline.length}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Campaign Timeline</h2>
        <div className="flex flex-wrap gap-2">
          {timeline.map((t) => (
            <div key={t.year} className="rounded-lg border border-border bg-muted/10 p-3 min-w-[120px]">
              <p className="text-lg font-bold text-foreground">{t.year}</p>
              <p className="text-xs text-muted-foreground">{t.count} campaign{t.count !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {t.actors.slice(0, 3).map((a) => (
                  <span key={a} className="text-[8px] rounded px-1 py-0.5 bg-primary/10 text-primary">{a}</span>
                ))}
                {t.actors.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">+{t.actors.length - 3} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <div key={c.campaignId}
            className={`rounded-xl border p-4 ${
              c.isActive ? "border-green-500/20 bg-card" : "border-border bg-card opacity-80"
            }`}>
            <div className="flex items-start justify-between mb-2">
              <span className={`w-2 h-2 rounded-full mt-1.5 ${c.isActive ? "bg-green-500" : "bg-muted"}`} />
              <div className="flex-1 ml-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] rounded px-1.5 py-0.5 font-medium ${
                    c.confidence === "confirmed" ? "bg-green-500/10 text-green-400"
                    : c.confidence === "probable" ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-muted/30 text-muted-foreground"
                  }`}>
                    {c.confidence?.toUpperCase() || "POSSIBLE"}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground mt-1">{c.campaignName}</h3>
              </div>
            </div>

            <div className="ml-5">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <Link href={`/intelligence/threat-actors?q=${encodeURIComponent(c.threatActor)}`}
                  className="flex items-center gap-0.5 text-[9px] text-purple-400 hover:text-purple-300 hover:underline transition-colors">
                  <Users className="h-2.5 w-2.5" /> {c.threatActor}
                </Link>
                {c.targetCountries && c.targetCountries.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-blue-400">
                    <Globe className="h-2.5 w-2.5" /> {c.targetCountries.slice(0, 3).join(", ")}
                    {c.targetCountries.length > 3 && ` +${c.targetCountries.length - 3}`}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>

              <div className="flex flex-wrap gap-1">
                {c.techniques?.slice(0, 5).map((t) => (
                  <Link key={t} href={`/intelligence/attack-patterns?q=${t}`}
                    className="text-[8px] rounded px-1 py-0.5 bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors">{t}</Link>
                ))}
                {c.cves?.slice(0, 3).map((cve) => (
                  <Link key={cve} href={`/intelligence/cve?q=${cve}`}
                    className="text-[8px] rounded px-1 py-0.5 bg-red-500/10 text-red-400 font-mono hover:bg-red-500/20 transition-colors">{cve}</Link>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground">
                <span>{c.startDate ? new Date(c.startDate).getFullYear() : "?"}</span>
                {c.endDate && <span>→ {new Date(c.endDate).getFullYear()}</span>}
                {c.isActive && !c.endDate && <span className="text-green-400">→ Ongoing</span>}
                {c.source && <span className="ml-auto truncate">Source: {c.source}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No campaign data cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
