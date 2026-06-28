"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import DashboardNavbar from "@/components/dashboard-navbar"
import {
  FolderOpen, FolderPlus, Search, ShieldAlert, Skull, Users,
  Bug, Newspaper, ExternalLink, Trash2, ChevronDown, ChevronUp,
  Tag, Clock, CheckCircle2, Circle, AlertCircle, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Investigation {
  id: number
  title: string
  description?: string
  query: string
  status: "open" | "in_progress" | "closed"
  search_results_count: number
  linked_cves?: string[]
  linked_groups?: string[]
  linked_victims?: string[]
  linked_actors?: string[]
  linked_iocs?: string[]
  linked_news_urls?: string[]
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

const STATUS_STYLE = {
  open:        { icon: Circle,        color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",  label: "Open" },
  in_progress: { icon: AlertCircle,   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "In Progress" },
  closed:      { icon: CheckCircle2,  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20", label: "Closed" },
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h > 48) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60000)}m ago`
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<string>("all")

  const fetchInvestigations = async () => {
    setLoading(true)
    const url = filter !== "all" ? `/api/intel/investigations?status=${filter}` : "/api/intel/investigations"
    try {
      const res = await fetch(url, { credentials: "include" })
      if (res.ok) { const d = await res.json(); setInvestigations(d.data || []) }
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchInvestigations() }, [filter])

  const updateStatus = async (id: number, status: string) => {
    await fetch("/api/intel/investigations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    })
    fetchInvestigations()
  }

  const deleteInvestigation = async (id: number) => {
    if (!confirm("Delete this investigation?")) return
    await fetch(`/api/intel/investigations?id=${id}`, { method: "DELETE", credentials: "include" })
    fetchInvestigations()
  }

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const counts = investigations.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <div className="pt-16 pb-16 container mx-auto px-4 lg:px-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mt-8 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" /> Investigations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Saved search + intelligence correlations — your case management workspace
            </p>
          </div>
          <Link href="/search">
            <Button size="sm" className="gap-2">
              <Search className="h-4 w-4" /> New Search
            </Button>
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-0">
          {[
            { value: "all",         label: `All (${investigations.length})` },
            { value: "open",        label: `Open (${counts.open || 0})` },
            { value: "in_progress", label: `In Progress (${counts.in_progress || 0})` },
            { value: "closed",      label: `Closed (${counts.closed || 0})` },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`text-sm px-4 py-2 border-b-2 transition-colors ${
                filter === t.value
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : investigations.length > 0 ? (
          <div className="space-y-3">
            {investigations.map((inv) => {
              const statusInfo = STATUS_STYLE[inv.status]
              const StatusIcon = statusInfo.icon
              const isExpanded = expanded.has(inv.id)
              const totalLinks = (inv.linked_cves?.length || 0) + (inv.linked_groups?.length || 0) +
                                 (inv.linked_victims?.length || 0) + (inv.linked_actors?.length || 0) +
                                 (inv.linked_iocs?.length || 0)

              return (
                <div key={inv.id} className="rounded-xl border border-border bg-card">
                  {/* Card header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-foreground">{inv.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                            <StatusIcon className={`inline h-2.5 w-2.5 mr-1 ${statusInfo.color}`} />
                            {statusInfo.label}
                          </span>
                          {totalLinks > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {totalLinks} intel links
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            <code className="font-mono text-foreground/70">{inv.query}</code>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeAgo(inv.created_at)}
                          </span>
                          {inv.tags && inv.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {inv.tags.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={inv.status}
                          onChange={(e) => updateStatus(inv.id, e.target.value)}
                          className="text-[10px] rounded border border-border bg-background text-foreground px-1.5 py-1 cursor-pointer"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                        <Link
                          href={`/search?q=${encodeURIComponent(inv.query)}`}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Re-run search"
                        >
                          <Search className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => deleteInvestigation(inv.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => toggle(inv.id)} className="p-1.5 rounded hover:bg-muted">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">
                      {/* Linked intel */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        {inv.linked_cves && inv.linked_cves.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-orange-500/70 mb-1.5 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Linked CVEs ({inv.linked_cves.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inv.linked_cves.map((c) => (
                                <a key={c} href={`https://nvd.nist.gov/vuln/detail/${c}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-orange-500/25 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10">
                                  {c}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {inv.linked_groups && inv.linked_groups.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-red-500/70 mb-1.5 flex items-center gap-1">
                              <Skull className="h-3 w-3" /> Ransomware Groups
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inv.linked_groups.map((g) => (
                                <Link key={g} href="/intelligence/ransomware"
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/25 text-red-400 bg-red-500/5 hover:bg-red-500/10">
                                  {g}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {inv.linked_actors && inv.linked_actors.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-green-500/70 mb-1.5 flex items-center gap-1">
                              <Users className="h-3 w-3" /> Threat Actors
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inv.linked_actors.map((a) => (
                                <Link key={a} href={`/intelligence/threat-actors?q=${encodeURIComponent(a)}`}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-green-500/25 text-green-400 bg-green-500/5 hover:bg-green-500/10">
                                  {a}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {inv.linked_iocs && inv.linked_iocs.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-yellow-500/70 mb-1.5 flex items-center gap-1">
                              <Bug className="h-3 w-3" /> IOCs / Hashes
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inv.linked_iocs.map((ioc) => (
                                <Link key={ioc} href={`/intelligence/ioc-search?v=${encodeURIComponent(ioc)}`}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-yellow-500/25 text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10 truncate max-w-[200px]">
                                  {ioc.slice(0, 24)}…
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {inv.linked_victims && inv.linked_victims.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-red-400/70 mb-1.5">Victims Mentioned</p>
                            <div className="flex flex-wrap gap-1">
                              {inv.linked_victims.slice(0, 6).map((v) => (
                                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {inv.linked_news_urls && inv.linked_news_urls.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-blue-500/70 mb-1.5 flex items-center gap-1">
                              <Newspaper className="h-3 w-3" /> Related Articles ({inv.linked_news_urls.length})
                            </p>
                            <div className="space-y-0.5">
                              {inv.linked_news_urls.slice(0, 3).map((url) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline truncate">
                                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                  {url.replace(/^https?:\/\//, "").slice(0, 60)}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {inv.notes && (
                        <div className="rounded-lg bg-muted/30 border border-border p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                          <p className="text-xs text-foreground">{inv.notes}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <Link href={`/search?q=${encodeURIComponent(inv.query)}`}
                          className="text-xs flex items-center gap-1 text-primary hover:underline">
                          <Search className="h-3 w-3" /> Re-run search
                        </Link>
                        <span className="text-border">·</span>
                        <Link href="/intelligence"
                          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          View intel hub
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-16 text-center space-y-4">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium text-foreground">No investigations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run a search and click <strong>Save Investigation</strong> on the Intelligence Context panel
                to start building your case files.
              </p>
            </div>
            <Link href="/search">
              <Button className="gap-2">
                <Search className="h-4 w-4" /> Start a Search
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
