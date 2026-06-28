import Link from "next/link"
import { getCoverageAnalysis } from "@/lib/intel/coverage"
import { Shield, ShieldAlert, ShieldX, FileCode, Terminal, Users } from "lucide-react"

export const dynamic = "force-dynamic"

const COVERAGE_STYLE: Record<string, string> = {
  COVERED: "bg-green-500/10 text-green-400 border-green-500/20",
  PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  GAP: "bg-red-500/10 text-red-400 border-red-500/20",
}

export default async function DetectionCoveragePage() {
  const { stats, gaps } = await getCoverageAnalysis()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Detection Coverage Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          MITRE ATT&CK technique coverage mapped against Sigma detection rules and YARA signatures — find detection gaps
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Techniques</p>
          <p className="text-2xl font-bold">{stats.totalTechniques}</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-xs text-muted-foreground">Covered</p>
          <p className="text-2xl font-bold text-green-400">{stats.coveredCount}</p>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-xs text-muted-foreground">Partial</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.partialCount}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Gaps</p>
          <p className="text-2xl font-bold text-red-400">{stats.gapCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Coverage</p>
          <p className="text-2xl font-bold text-primary">{stats.coveragePercent}%</p>
        </div>
      </div>

      {/* Tactic breakdown */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coverage by Tactic</h2>
        <div className="space-y-2">
          {stats.byTactic.map((t) => (
            <div key={t.tactic} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">{t.tactic}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500/50" style={{ width: `${(t.covered / Math.max(t.total, 1)) * 100}%` }} />
                <div className="h-full bg-red-500/30" style={{ width: `${(t.gap / Math.max(t.total, 1)) * 100}%` }} />
                <div className="h-full bg-yellow-500/30" style={{ flex: 1 }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-24 text-right">
                {t.covered}/{t.total} · {t.gap} gap{t.gap !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Critical gaps (used by actors, no detection) */}
      {stats.criticalGaps.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Critical Detection Gaps (Used by Threat Actors)
          </h2>
          <div className="space-y-1">
            {stats.criticalGaps.map((g) => (
              <div key={g.techniqueId} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-2 text-xs">
                <span className="font-mono text-[10px] text-red-400 w-16">{g.techniqueId}</span>
                <span className="text-zinc-300 flex-1">{g.name}</span>
                <span className="text-[9px] text-zinc-500">{g.tactic}</span>
                <span className="flex items-center gap-0.5 text-[9px] text-purple-400"><Users className="h-2.5 w-2.5" /> {g.actorCount}</span>
                <Link href={`/intelligence/sigma?q=${g.techniqueId}`} className="text-[9px] text-blue-400 hover:underline flex items-center gap-0.5">
                  <FileCode className="h-2.5 w-2.5" /> Create Rule
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All techniques */}
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">
          All {gaps.length} Techniques
        </summary>
        <div className="mt-3 space-y-0.5 max-h-96 overflow-y-auto">
          {gaps.map((g) => (
            <div key={g.techniqueId} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/20 text-xs">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                g.coverage === "COVERED" ? "bg-green-500" : g.coverage === "PARTIAL" ? "bg-yellow-500" : "bg-red-500"
              }`} />
              <span className="font-mono text-[10px] w-16 text-muted-foreground">{g.techniqueId}</span>
              <span className="text-zinc-300 flex-1">{g.name}</span>
              <span className="text-[9px] text-zinc-500">{g.tactic}</span>
              {g.hasSigma && <span className="text-[9px] text-blue-400"><FileCode className="h-2.5 w-2.5 inline" /> {g.sigmaRuleCount}</span>}
              {g.hasYara && <span className="text-[9px] text-amber-400"><Terminal className="h-2.5 w-2.5 inline" /> {g.yaraRuleCount}</span>}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
