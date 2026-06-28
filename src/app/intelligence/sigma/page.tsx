import { getSigmaRules } from "@/lib/intel/fetchers/sigma"
import { FileCode, ChevronDown } from "lucide-react"

export const dynamic = "force-dynamic"

const LEVEL_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-green-400 bg-green-500/10",
}

export default async function SigmaRulesPage() {
  const rules = await getSigmaRules(100)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sigma Detection Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Curated Sigma rules from SigmaHQ — generate SIEM detections for known adversary techniques
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <details key={rule.ruleId} className="group rounded-xl border border-border bg-card overflow-hidden">
            <summary className="cursor-pointer list-none p-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{rule.title}</span>
                    {rule.level && (
                      <span className={`text-[9px] rounded px-1.5 py-0.5 ${LEVEL_COLOR[rule.level] || ""}`}>
                        {rule.level.toUpperCase()}
                      </span>
                    )}
                    {rule.status && (
                      <span className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">{rule.status}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{rule.description || "No description"}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {rule.logsourceProduct && (
                      <span className="text-[9px] rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-400">{rule.logsourceProduct}</span>
                    )}
                    {rule.techniqueId?.map((t) => (
                      <a key={t} href={`/intelligence/attack-patterns?search=${t}`}
                        className="text-[9px] rounded px-1.5 py-0.5 bg-purple-500/10 text-purple-400 font-mono hover:underline">
                        {t}
                      </a>
                    ))}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-open:rotate-180 transition-transform" />
              </div>
            </summary>
            <div className="px-4 pb-4 border-t border-border pt-3">
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-y-auto bg-muted/20 rounded-lg p-3">
                {rule.rawRuleYaml.length > 2000 ? rule.rawRuleYaml.slice(0, 2000) + "\n\n... (truncated)" : rule.rawRuleYaml}
              </pre>
              {rule.tags && rule.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {rule.tags.map((t) => (
                    <span key={t} className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileCode className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No Sigma rules cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
