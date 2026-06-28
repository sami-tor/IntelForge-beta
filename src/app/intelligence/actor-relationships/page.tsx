import Link from "next/link"
import { getActorRelationships } from "@/lib/intel/actor-relationships"
import { Users, Link2, Target, Bug, Building } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ActorRelationshipsPage() {
  const { actors, relationships } = await getActorRelationships()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Threat Actor Relationships</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover overlaps between threat actors — shared techniques, malware families, and targeted sectors
        </p>
      </div>

      {/* Actor grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {actors.map((a) => (
          <Link key={a.name} href={`/intelligence/actor-report?q=${encodeURIComponent(a.name)}`}
            className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors">
            <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-muted-foreground">
              <span className="text-purple-400">{a.techniqueCount} techniques</span>
              {a.campaignCount > 0 && <span>· {a.campaignCount} campaigns</span>}
            </div>
          </Link>
        ))}
      </div>

      {/* Relationships */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Shared Capabilities ({relationships.length} overlaps found)
        </h2>
        <div className="space-y-2">
          {relationships.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/intelligence/actor-report?q=${encodeURIComponent(r.actorA)}`}
                  className="text-sm font-medium text-purple-400 hover:underline">{r.actorA}</Link>
                <Link2 className="h-3 w-3 text-muted-foreground" />
                <Link href={`/intelligence/actor-report?q=${encodeURIComponent(r.actorB)}`}
                  className="text-sm font-medium text-purple-400 hover:underline">{r.actorB}</Link>
                <span className="text-[9px] rounded px-1.5 py-0.5 bg-primary/10 text-primary ml-auto">
                  Score: {r.overlapScore}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[9px]">
                {r.sharedTechniques.length > 0 && (
                  <span className="flex items-center gap-0.5 text-blue-400">
                    <Target className="h-2.5 w-2.5" /> {r.sharedTechniques.length} shared techniques
                    <span className="text-zinc-600 ml-1">{r.sharedTechniques.slice(0, 5).join(", ")}{r.sharedTechniques.length > 5 ? "…" : ""}</span>
                  </span>
                )}
                {r.sharedMalware.length > 0 && (
                  <span className="flex items-center gap-0.5 text-red-400">
                    <Bug className="h-2.5 w-2.5" /> {r.sharedMalware.length} shared malware
                    <span className="text-zinc-600 ml-1">{r.sharedMalware.join(", ")}</span>
                  </span>
                )}
                {r.sharedSectors.length > 0 && (
                  <span className="flex items-center gap-0.5 text-yellow-400">
                    <Building className="h-2.5 w-2.5" /> {r.sharedSectors.length} shared sectors
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {actors.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No actor data cached yet. Run a feed sync to populate MITRE groups and APT campaigns.</p>
        </div>
      )}
    </div>
  )
}
