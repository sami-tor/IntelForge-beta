"use client"

// ================================================
// /intelligence/hunt — threat-hunting query builder
// Builds a constrained query against the automation
// tables (no raw SQL exposed). Results table is
// rendered inline with CSV export.
// ================================================
import { useState } from "react"
import {
  Loader2,
  Search,
  Filter,
  Database,
  Download,
  Play,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"


const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const
const CATEGORIES = ["patch", "hunt", "block", "review", "drill"] as const
const SCOPES = ["clusters", "actions", "anomalies", "briefings", "geo"] as const

export default function HuntPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("clusters")
  const [severityIn, setSeverityIn] = useState<string[]>(["critical", "high"])
  const [category, setCategory] = useState<string>("")
  const [search, setSearch] = useState("")
  const [riskScoreMin, setRiskScoreMin] = useState<string>("")
  const [publishedSince, setPublishedSince] = useState<string>("")
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSeverity = (sev: string) =>
    setSeverityIn((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    )

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/intel/automation/hunt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          severityIn: severityIn.length ? severityIn : undefined,
          category: category || undefined,
          search: search || undefined,
          riskScoreMin: riskScoreMin ? Number(riskScoreMin) : undefined,
          publishedSince: publishedSince || undefined,
          limit: 100,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setItems(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (items.length === 0) return
    const headers = Object.keys(items[0])
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }
    const rows = [headers.join(",")]
    for (const r of items) rows.push(headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","))
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `hunt-${scope}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }


  const headers = items.length > 0 ? Object.keys(items[0]) : []

  return (
    <div className="space-y-6 max-w-7xl mx-auto" role="main" aria-labelledby="hunt-title">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Threat Hunting
        </div>
        <h1 id="hunt-title" className="text-2xl font-bold mt-1">Query Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compose constrained queries against clusters, actions, anomalies, briefings or geo data.
          No raw SQL exposed; every filter is parameterised.
        </p>
      </header>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="hunt-scope">
              Scope
            </label>
            <select
              id="hunt-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as (typeof SCOPES)[number])}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="hunt-search">
              Free text search
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                id="hunt-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="title or summary contains…"
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
            <Filter className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />
            Severity
          </legend>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <label key={s} className="cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={severityIn.includes(s)}
                  onChange={() => toggleSeverity(s)}
                />
                <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-background peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus:ring-2 peer-focus:ring-primary/40">
                  {s}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scope === "actions" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="hunt-category">
                Category
              </label>
              <select
                id="hunt-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">any</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {scope === "clusters" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="hunt-rsmin">
                Min risk score
              </label>
              <input
                id="hunt-rsmin"
                type="number"
                min={0}
                max={100}
                value={riskScoreMin}
                onChange={(e) => setRiskScoreMin(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="hunt-since">
              Published since
            </label>
            <input
              id="hunt-since"
              type="date"
              value={publishedSince}
              onChange={(e) => setPublishedSince(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run query
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {error && (
          <div role="alert" className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Results
          </h2>
          <span className="text-xs text-muted-foreground">{items.length} rows</span>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center">
            {loading ? "Running…" : "Set your filters and run a query."}
          </p>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Query results table">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground sticky top-0">
                <tr>
                  {headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                    {headers.map((h) => {
                      const v = (row as Record<string, unknown>)[h]
                      const display =
                        v === null || v === undefined
                          ? "—"
                          : typeof v === "object"
                            ? JSON.stringify(v).slice(0, 120)
                            : String(v).slice(0, 200)
                      return (
                        <td key={h} className="px-3 py-1.5 align-top">
                          <span className="block max-w-[260px] truncate" title={String(display)}>
                            {display}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
