"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldAlert, Globe, Users, Search, Hash, Trash2, Plus, AlertTriangle, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"

const TYPE_ICON: Record<string, React.ElementType> = {
  cve: ShieldAlert,
  domain: Globe,
  actor: Users,
  hash: Hash,
  ip: Search,
  keyword: Search,
}

const TYPE_LINK: Record<string, (v: string) => string> = {
  cve: (v) => `/intelligence/cve?q=${v}`,
  domain: (v) => `/intelligence/cert-domain?q=${v}`,
  actor: (v) => `/intelligence/actor-report?q=${v}`,
  hash: (v) => `/intelligence/malware?q=${v}`,
  ip: (v) => `/intelligence/ioc-search?q=${v}`,
  keyword: (v) => `/intelligence/search?q=${v}`,
}

export default function WatchlistPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ entity_type: "cve", entity_value: "", label: "", notes: "" })
  const [error, setError] = useState("")
  const [checkingId, setCheckingId] = useState<number | null>(null)

  const fetchWatchlist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/intel/watchlists", { credentials: "include" })
      const json = await res.json()
      if (json.success) setItems(json.data)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  const handleAdd = async () => {
    if (!form.entity_value.trim()) { setError("Value required"); return }
    setError("")
    setAdding(true)
    try {
      const res = await fetch("/api/intel/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setForm({ entity_type: "cve", entity_value: "", label: "", notes: "" })
        fetchWatchlist()
      } else {
        setError(json.error || "Failed")
      }
    } catch {
      setError("Network error")
    }
    setAdding(false)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/intel/watchlists?id=${id}`, { method: "DELETE", credentials: "include" })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleCheck = async (item: Record<string, unknown>) => {
    setCheckingId(item.id as number)
    try {
      const res = await fetch(`/api/intel/correlate?q=${encodeURIComponent(String(item.entity_value))}`)
      const json = await res.json()
      // Update item with check result
      if (json.success) {
        setItems((prev) => prev.map((i) =>
          i.id === item.id
            ? { ...i, last_checked_at: new Date().toISOString(), last_result: json }
            : i,
        ))
      }
    } catch { /* silent */ }
    setCheckingId(null)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Custom Watchlists</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track CVEs, domains, threat actors, and IOCs — get notified when new intelligence appears
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Add to Watchlist</p>
        <div className="flex flex-wrap gap-2">
          <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}
            className="h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm text-foreground">
            <option value="cve">CVE</option>
            <option value="domain">Domain</option>
            <option value="actor">Threat Actor</option>
            <option value="hash">Hash</option>
            <option value="ip">IP Address</option>
            <option value="keyword">Keyword</option>
          </select>
          <input type="text" value={form.entity_value} onChange={(e) => setForm({ ...form, entity_value: e.target.value })}
            placeholder={form.entity_type === "cve" ? "CVE-2024-1234" : form.entity_type === "domain" ? "example.com" : "Value"}
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground min-w-[200px]"
          />
          <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Label (optional)"
            className="w-32 h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleAdd} disabled={adding}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Watchlist items */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading watchlist...</p>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = TYPE_ICON[String(item.entity_type)] || Search
            const linkFn = TYPE_LINK[String(item.entity_type)]
            return (
              <div key={String(item.id)}
                className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-[9px] rounded px-1.5 py-0.5 bg-primary/10 text-primary uppercase">{String(item.entity_type)}</span>
                    {linkFn && (
                      <Link href={linkFn(String(item.entity_value))} className="font-mono text-sm text-foreground hover:text-primary hover:underline truncate">
                        {String(item.entity_value)}
                      </Link>
                    )}
                    {!linkFn && <span className="font-mono text-sm text-foreground truncate">{String(item.entity_value)}</span>}
                    {Boolean(item.label) && <span className="text-xs text-muted-foreground">{String(item.label)}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleCheck(item)}
                      disabled={checkingId === item.id}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50 transition-colors">
                      {checkingId === item.id ? "Checking..." : "Check Now"}
                    </button>
                    <button onClick={() => handleDelete(item.id as number)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {Boolean(item.last_checked_at) && (
                  <p className="text-[9px] text-muted-foreground mt-1">
                    Last checked: {new Date(String(item.last_checked_at)).toLocaleString()}
                    {Number(item.change_count) > 0 && (
                      <span className="text-green-400 ml-2">{String(item.change_count)} changes detected</span>
                    )}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No items on your watchlist yet. Add CVEs, domains, or actors to monitor.</p>
        </div>
      )}
    </div>
  )
}
