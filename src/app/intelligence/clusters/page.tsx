"use client"

// ================================================
// /intelligence/clusters
// Deep correlation explorer. Filter by anchor type
// (cve · actor · ransomware) and drill into the
// bundled signals with confidence scores.
// ================================================
import { useEffect, useState } from "react"
import {
  Loader2,
  GitBranch,
  Cpu,
  ShieldAlert,
  Skull,
  Users,
  Layers,
  Filter,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"

interface DeepCluster {
  clusterKey: string
  clusterType: "cve" | "actor" | "ransomware" | "malware"
  title: string
  summary: string
  riskScore: number
  confidence: number
  severity: string
  signalCount: number
  signals: {
    cve?: { cveId: string; score?: number; severity?: string; isKev?: boolean; vendor?: string; product?: string }
    actor?: { name: string; aliases?: string[]; description?: string }
    ransomware?: { name: string; aliases?: string[]; victimCount?: number }
    signals: Array<{
      type: string
      ref?: string
      title?: string
      detail?: string
      severity?: string
      confidence: number
      publishedAt?: string
    }>
    actors?: string[]
    relatedCves?: string[]
  }
  tags: string[]
  relatedCves: string[]
  anchorActor: string | null
  anchorRansomware: string | null
  firstSeen: string
  lastSeen: string
}


const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

const SIGNAL_LABEL: Record<string, string> = {
  kev: "KEV",
  exploit: "Exploit",
  news: "News",
  paste: "Paste",
  stealer_log: "Stealer",
  compromised_host: "Host",
  combolist: "Combolist",
  ransomware_victim: "Victim",
  darknet_post: "Dark-web",
  actor_link: "Actor",
  related_cve: "Related",
}

const TYPE_ICON = {
  cve: ShieldAlert,
  actor: Users,
  ransomware: Skull,
  malware: Layers,
} as const

function timeAgo(iso?: string) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ClustersPage() {
  const [items, setItems] = useState<DeepCluster[]>([])
  const [filter, setFilter] = useState<"" | "cve" | "actor" | "ransomware">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (filter) params.set("type", filter)
      const res = await fetch(`/api/intel/automation/clusters?${params}`, {
        credentials: "include",
      })
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const toggle = (key: string) =>
    setExpanded((p) => {
      const n = new Set(p)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const counts = {
    cve: items.filter((i) => i.clusterType === "cve").length,
    actor: items.filter((i) => i.clusterType === "actor").length,
    ransomware: items.filter((i) => i.clusterType === "ransomware").length,
  }


  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Cpu className="h-3.5 w-3.5" />
            Automation Layer
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mt-1">Correlation Clusters</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Multi-anchor correlation across CVEs, threat actors, ransomware groups, paste posts,
            stealer logs, dark-web mentions, and victim records. Each signal carries an explicit
            confidence score; cluster scores are weighted, not flat counts.
          </p>
        </div>
        <Link
          href="/intelligence/command-center"
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors w-fit"
        >
          ← Command Center
        </Link>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
          <Filter className="h-3.5 w-3.5" />
          Anchor:
        </div>
        {(
          [
            { v: "", label: `All (${items.length})` },
            { v: "cve", label: `CVE (${counts.cve})` },
            { v: "ransomware", label: `Ransomware (${counts.ransomware})` },
            { v: "actor", label: `Actor (${counts.actor})` },
          ] as const
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v as any)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              filter === f.v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
            aria-pressed={filter === f.v}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="p-6 border-destructive">
          <p className="text-destructive flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No clusters yet. Run the pipeline.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const Icon = TYPE_ICON[c.clusterType] || GitBranch
            const isOpen = expanded.has(c.clusterKey)
            return (
              <Card key={c.clusterKey} className="p-0 overflow-hidden">
                <button
                  onClick={() => toggle(c.clusterKey)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                              SEVERITY_BADGE[c.severity] || SEVERITY_BADGE.medium
                            }`}
                          >
                            {c.severity}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                            {c.clusterType}
                          </span>
                          {c.tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-semibold text-sm mt-1.5 leading-snug">{c.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {c.summary}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <span>{c.signalCount} signals</span>
                          <span>conf {c.confidence}%</span>
                          <span>{timeAgo(c.lastSeen)}</span>
                          {c.relatedCves.length > 0 && (
                            <span>{c.relatedCves.length} related CVE(s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold leading-none">{c.riskScore}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                        risk
                      </p>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border bg-background/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                          Anchor
                        </p>
                        {c.signals.cve && (
                          <div className="text-xs space-y-1">
                            <p><span className="font-medium">{c.signals.cve.cveId}</span> {c.signals.cve.severity ? `· ${c.signals.cve.severity}` : ""}</p>
                            {c.signals.cve.vendor && (
                              <p className="text-muted-foreground">{c.signals.cve.vendor} · {c.signals.cve.product}</p>
                            )}
                          </div>
                        )}
                        {c.signals.actor && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium">{c.signals.actor.name}</p>
                            {c.signals.actor.aliases?.length ? (
                              <p className="text-muted-foreground">aliases: {c.signals.actor.aliases.join(", ")}</p>
                            ) : null}
                            {c.signals.actor.description && (
                              <p className="text-muted-foreground line-clamp-3">{c.signals.actor.description}</p>
                            )}
                          </div>
                        )}
                        {c.signals.ransomware && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium">{c.signals.ransomware.name}</p>
                            <p className="text-muted-foreground">{c.signals.ransomware.victimCount ?? "?"} historical victim(s)</p>
                            {c.signals.ransomware.aliases?.length ? (
                              <p className="text-muted-foreground">aliases: {c.signals.ransomware.aliases.join(", ")}</p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                          Linked actors / CVEs
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.signals.actors?.map((a) => (
                            <span key={a} className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {a}
                            </span>
                          ))}
                          {c.relatedCves.map((id) => (
                            <span key={id} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                        Signals · {c.signals.signals.length}
                      </p>
                      <div className="space-y-1">
                        {c.signals.signals.map((s, i) => (
                          <div
                            key={i}
                            className="text-[12px] flex items-start gap-2 border-l-2 border-primary/40 pl-2 py-1"
                          >
                            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold w-16 shrink-0">
                              {SIGNAL_LABEL[s.type] || s.type}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{s.title || s.ref}</span>
                              {s.detail && <span className="text-muted-foreground block truncate">{s.detail}</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              conf {s.confidence}{s.publishedAt ? ` · ${timeAgo(s.publishedAt)}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
