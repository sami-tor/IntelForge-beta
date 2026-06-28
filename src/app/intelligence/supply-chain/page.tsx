import Link from "next/link"
import { getSupplyChain } from "@/lib/intel/fetchers/supply-chain"
import { Package, ExternalLink, Bomb } from "lucide-react"

export const dynamic = "force-dynamic"

const ECOSYSTEM_COLOR: Record<string, string> = {
  npm: "text-red-400 bg-red-500/10", PyPI: "text-blue-400 bg-blue-500/10",
  Maven: "text-orange-400 bg-orange-500/10", Go: "text-cyan-400 bg-cyan-500/10",
  "crates.io": "text-yellow-400 bg-yellow-500/10", NuGet: "text-purple-400 bg-purple-500/10",
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400", HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400", LOW: "text-green-400",
}

export default async function SupplyChainPage() {
  const vulns = await getSupplyChain(100)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Supply Chain Vulnerability Intel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dependency vulnerability data from OSV.dev — track vulnerable packages across NPM, PyPI, Maven, Go, and more
        </p>
      </div>

      <div className="space-y-2">
        {vulns.map((v) => (
          <div key={v.osvId} className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] text-primary font-semibold">{v.osvId}</span>
                {v.packageEcosystem && (
                  <span className={`text-[9px] rounded px-1.5 py-0.5 ${ECOSYSTEM_COLOR[v.packageEcosystem] || "text-muted-foreground bg-muted/30"}`}>
                    {v.packageEcosystem}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {v.severity && (
                  <span className={`text-[10px] font-bold ${SEVERITY_COLOR[v.severity] || ""}`}>
                    {v.cvssV3Score?.toFixed(1) || v.severity}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm font-medium text-foreground">{v.packageName}</p>
            {v.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.summary}</p>}

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {v.fixedVersion && (
                <span className="text-[9px] rounded px-1.5 py-0.5 bg-green-500/10 text-green-400">
                  Fixed in {v.fixedVersion}
                </span>
              )}
              {v.aliases?.map((a) => (
                a.startsWith("CVE-") ? (
                  <Link key={a} href={`/intelligence/cve?q=${a}`}
                    className="text-[9px] rounded px-1.5 py-0.5 bg-red-500/10 text-red-400 font-mono hover:bg-red-500/20 transition-colors">{a}</Link>
                ) : (
                  <span key={a} className="text-[9px] rounded px-1.5 py-0.5 bg-red-500/10 text-red-400 font-mono">{a}</span>
                )
              ))}
              {v.referencesUrls?.slice(0, 3).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  <ExternalLink className="h-2 w-2" /> Ref
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cross-reference links */}
      {vulns.length > 0 && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/intelligence/cve"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              CVE Intelligence
            </Link>
            <Link href="/intelligence/exploits"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Exploit Intel
            </Link>
            <Link href="/intelligence/malware"
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors">
              Malware Intel
            </Link>
          </div>
        </div>
      )}

      {vulns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No supply chain data cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
