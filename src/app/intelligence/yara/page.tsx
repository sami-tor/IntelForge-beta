import Link from "next/link"
import { getYaraRules } from "@/lib/intel/fetchers/yara-rules"
import { Terminal, ChevronDown } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORY_COLOR: Record<string, string> = {
  ransomware: "text-red-400 bg-red-500/10",
  apt: "text-blue-400 bg-blue-500/10",
  rat: "text-purple-400 bg-purple-500/10",
  stealer: "text-orange-400 bg-orange-500/10",
  exploit: "text-yellow-400 bg-yellow-500/10",
  generic: "text-muted-foreground bg-muted/30",
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400", high: "text-orange-400",
  medium: "text-yellow-400", low: "text-green-400",
}

export default async function YaraRulesPage() {
  const rules = await getYaraRules(200)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">YARA Rule Repository</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Curated YARA rules for malware detection — search by family, category, or severity. Includes rules from community repositories.
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <details key={rule.ruleName} className="group rounded-xl border border-border bg-card overflow-hidden">
            <summary className="cursor-pointer list-none p-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-semibold text-primary">{rule.ruleName}</span>
                    {rule.severity && (
                      <span className={`text-[9px] font-bold ${SEVERITY_COLOR[rule.severity] || ""}`}>
                        {rule.severity.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{rule.description || "No description"}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {rule.category && (
                      <span className={`text-[9px] rounded px-1.5 py-0.5 ${CATEGORY_COLOR[rule.category] || ""}`}>
                        {rule.category}
                      </span>
                    )}
                    {rule.targetFamily?.map((f) => (
                      <Link key={f} href={`/intelligence/malware?q=${encodeURIComponent(f)}`}
                        className="text-[9px] rounded px-1.5 py-0.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">{f}</Link>
                    ))}
                    {rule.mitreTechniques?.map((t) => (
                      <Link key={t} href={`/intelligence/attack-patterns?q=${t}`}
                        className="text-[9px] rounded px-1.5 py-0.5 bg-purple-500/10 text-purple-400 font-mono hover:bg-purple-500/20 transition-colors">{t}</Link>
                    ))}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-open:rotate-180 transition-transform" />
              </div>
            </summary>
            <div className="px-4 pb-4 border-t border-border pt-3">
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-80 overflow-y-auto bg-muted/20 rounded-lg p-3 leading-relaxed">
                {rule.rawRule.length > 3000 ? rule.rawRule.slice(0, 3000) + "\n\n// ... (truncated)" : rule.rawRule}
              </pre>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {rule.author && <span className="text-[9px] text-muted-foreground">by {rule.author}</span>}
                {rule.sourceRepo && (
                  <span className="text-[9px] text-muted-foreground">Source: {rule.sourceRepo}</span>
                )}
                {rule.tags && rule.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-auto">
                    {rule.tags.map((t) => (
                      <span key={t} className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Terminal className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No YARA rules cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
