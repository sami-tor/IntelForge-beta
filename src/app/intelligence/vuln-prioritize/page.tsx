import Link from "next/link"
import { getPrioritizedVulns, getPrioritizationStats } from "@/lib/intel/prioritize"
import { ShieldAlert, Bomb, AlertTriangle, ArrowUp, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

const VERDICT_STYLE: Record<string, string> = {
  PATCH_NOW: "bg-red-500/15 text-red-400 border-red-500/25",
  PATCH_SOON: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  MONITOR: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  LOW_PRIORITY: "bg-green-500/15 text-green-400 border-green-500/25",
}

export default async function VulnPrioritizePage() {
  const [vulns, stats] = await Promise.all([
    getPrioritizedVulns(60),
    getPrioritizationStats(),
  ])

  const patchNow = vulns.filter((v) => v.verdict === "PATCH_NOW")

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vulnerability Prioritization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Composite risk scoring: CVSS (40%) + EPSS exploit probability (30%) + KEV known exploitation (20%) + Public PoC (10%)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Patch Now</p>
          <p className="text-2xl font-bold text-red-400">{patchNow.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">KEV Listed</p>
          <p className="text-2xl font-bold text-orange-400">{stats.kevCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Critical CVEs</p>
          <p className="text-2xl font-bold">{stats.criticalCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">High EPSS (≥50%)</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.highEpssCount}</p>
        </div>
      </div>

      {/* Priority list */}
      <div className="space-y-2">
        {vulns.map((v) => (
          <div key={v.cveId}
            className={`rounded-lg border p-4 ${
              v.verdict === "PATCH_NOW" ? "border-red-500/20 bg-red-500/3" :
              v.verdict === "PATCH_SOON" ? "border-orange-500/20 bg-orange-500/3" :
              "border-border bg-card"
            }`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] rounded px-1.5 py-0.5 border font-semibold ${VERDICT_STYLE[v.verdict]}`}>
                  {v.verdict.replace("_", " ")}
                </span>
                <a href={`https://nvd.nist.gov/vuln/detail/${v.cveId}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs font-bold text-primary hover:underline">{v.cveId}</a>
                {v.isKev && <span className="text-[9px] rounded px-1.5 py-0.5 bg-red-600/15 text-red-400 border border-red-500/25">KEV</span>}
                {v.hasExploit && <span className="flex items-center gap-0.5 text-[9px] text-orange-400"><Bomb className="h-2.5 w-2.5" /> Public PoC</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{v.compositeScore}</p>
                  <p className="text-[9px] text-muted-foreground">priority score</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{v.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span>CVSS: <span className={v.cvssScore >= 9 ? "text-red-400 font-semibold" : v.cvssScore >= 7 ? "text-orange-400" : ""}>{v.cvssScore.toFixed(1)}</span></span>
              <span>EPSS: <span className={v.epssScore >= 0.5 ? "text-red-400 font-semibold" : ""}>{Math.round(v.epssScore * 100)}%</span></span>
              {v.factors.length > 0 && (
                <span className="text-zinc-600">{v.factors.join(" · ")}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {vulns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No vulnerability data cached yet.</p>
        </div>
      )}
    </div>
  )
}
