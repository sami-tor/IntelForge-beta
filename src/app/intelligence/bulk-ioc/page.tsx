"use client"

import { useState } from "react"
import { Search, ShieldAlert, Bug, Globe, Fish, Bomb, FileText, AlertTriangle, ExternalLink, Skull, Eye, CalendarClock, Package, Key, Users, FileCode } from "lucide-react"
import Link from "next/link"

export default function BulkIocPage() {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")

  const handleScan = async () => {
    const iocs = input.split("\n").map((s) => s.trim()).filter(Boolean)
    if (iocs.length === 0 || iocs.length > 100) {
      setError("Enter 1-100 IOCs (one per line)")
      return
    }
    setLoading(true)
    setError("")
    setResults(null)
    try {
      const res = await fetch("/api/intel/bulk-ioc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iocs }),
      })
      const json = await res.json()
      if (json.success) setResults(json.data)
      else setError(json.error || "Scan failed")
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const resultsData = (results?.results || []) as Array<Record<string, unknown>>
  const emptyIocs = (results?.empty || []) as string[]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bulk IOC Processing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste up to 100 IPs, hashes, domains, or URLs — each is correlated across all intelligence tables
        </p>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"Paste IOCs, one per line:\n192.168.1.1\nexample-phish.com\nCVE-2024-1234\nd44f78c2b7..."}
          rows={8}
          className="w-full rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono resize-y"
        />
        <button onClick={handleScan} disabled={loading}
          className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors self-start">
          {loading ? "Processing..." : "Scan All IOCs"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Summary */}
      {results && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total IOCs</p>
            <p className="text-2xl font-bold">{String(results.total)}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <p className="text-xs text-muted-foreground">With Hits</p>
            <p className="text-2xl font-bold text-green-400">{String(results.withHits)}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">Total Hits</p>
            <p className="text-2xl font-bold text-primary">{String(results.totalHits)}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs text-muted-foreground">No Results</p>
            <p className="text-2xl font-bold text-red-400">{emptyIocs.length}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {resultsData.length > 0 && (
        <div className="space-y-3">
          {resultsData.filter((r) => Number(r.hits) > 0).map((r, i) => {
            const data = r.data as Record<string, unknown[]>
            return (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm font-bold text-primary">{String(r.value)}</span>
                  <span className="text-[9px] rounded px-1.5 py-0.5 bg-primary/10 text-primary">{String(r.type)}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{String(r.hits)} hits</span>
                </div>

                <div className="space-y-1.5">
                  {(data.cve as any[])?.map((c: Record<string, unknown>, j: number) => (
                    <div key={`cve-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <ShieldAlert className="h-3 w-3 text-orange-400" />
                      <span className="font-mono text-orange-400">{String(c.cve_id)}</span>
                      <span className="text-zinc-400 truncate">{String(c.description || "").slice(0, 60)}</span>
                    </div>
                  ))}
                  {(data.exploits as any[])?.map((e: Record<string, unknown>, j: number) => (
                    <div key={`exp-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Bomb className="h-3 w-3 text-red-400" />
                      <span className="font-mono text-red-400">{String(e.exploit_id)}</span>
                      <span className="text-zinc-400 truncate">{String(e.title)}</span>
                    </div>
                  ))}
                  {(data.malware as any[])?.map((m: Record<string, unknown>, j: number) => (
                    <div key={`mal-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Bug className="h-3 w-3 text-yellow-400" />
                      <span className="font-mono text-yellow-400">{String(m.sha256 || "").slice(0, 12)}…</span>
                      <span className="text-zinc-400">{String(m.malware_family || m.file_name || "")}</span>
                    </div>
                  ))}
                  {(data.phishing as any[])?.map((p: Record<string, unknown>, j: number) => (
                    <div key={`ph-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Fish className="h-3 w-3 text-red-400" />
                      <span className="text-zinc-300 truncate">{String(p.url || "").slice(0, 50)}</span>
                      {p.target_brand ? <span className="text-orange-400">{String(p.target_brand)}</span> : null}
                    </div>
                  ))}
                  {(data.certs as any[])?.map((c: Record<string, unknown>, j: number) => (
                    <div key={`cert-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Globe className="h-3 w-3 text-blue-400" />
                      <span className="text-blue-300">{String(c.domain)}</span>
                      {c.revoked ? <span className="text-red-400">Revoked</span> : <span className="text-green-400">Valid</span>}
                    </div>
                  ))}
                  {(data.typosquats as any[])?.map((t: Record<string, unknown>, j: number) => (
                    <div key={`typ-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <AlertTriangle className="h-3 w-3 text-orange-400" />
                      <span className="font-mono text-orange-300">{String(t.variant_domain)}</span>
                      <span className="text-orange-400">Risk: {String(t.risk_score)}</span>
                    </div>
                  ))}
                  {(data.ransomware as any[])?.map((g: Record<string, unknown>, j: number) => (
                    <div key={`rw-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Skull className="h-3 w-3 text-red-400" />
                      <span className="text-red-300 font-medium">{String(g.name)}</span>
                      {g.active ? <span className="text-green-400 text-[9px]">Active</span> : null}
                      <span className="text-zinc-400">{String(g.victim_count || 0)} victims</span>
                    </div>
                  ))}
                  {(data.darknet as any[])?.map((p: Record<string, unknown>, j: number) => (
                    <div key={`dn-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Eye className="h-3 w-3 text-purple-400" />
                      <span className="text-purple-300 truncate">{String(p.threat_actor || p.title || "").slice(0, 40)}</span>
                      {p.severity ? <span className={`text-[9px] ${String(p.severity) === "critical" ? "text-red-400" : "text-yellow-400"}`}>{String(p.severity)}</span> : null}
                    </div>
                  ))}
                  {(data.apt as any[])?.map((c: Record<string, unknown>, j: number) => (
                    <div key={`apt-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <CalendarClock className="h-3 w-3 text-indigo-400" />
                      <span className="text-indigo-300 font-medium">{String(c.campaign_name)}</span>
                      <span className="text-zinc-400">by {String(c.threat_actor)}</span>
                    </div>
                  ))}
                  {(data.supplyChain as any[])?.map((s: Record<string, unknown>, j: number) => (
                    <div key={`sc-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Package className="h-3 w-3 text-cyan-400" />
                      <span className="font-mono text-cyan-400">{String(s.osv_id)}</span>
                      <span className="text-zinc-300">{String(s.package_name)}</span>
                      {s.severity ? <span className="text-[9px] text-orange-400">{String(s.severity)}</span> : null}
                    </div>
                  ))}
                  {(data.secrets as any[])?.map((s: Record<string, unknown>, j: number) => (
                    <div key={`sec-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Key className="h-3 w-3 text-pink-400" />
                      <span className="text-pink-400 font-mono">{String(s.repo_name)}</span>
                      <span className="text-zinc-400 truncate">{String(s.file_path)}</span>
                    </div>
                  ))}
                  {(data.actors as any[])?.map((a: Record<string, unknown>, j: number) => (
                    <div key={`act-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <Users className="h-3 w-3 text-green-400" />
                      <span className="text-green-300 font-medium">{String(a.name)}</span>
                      {a.group_id ? <span className="font-mono text-[9px] text-green-400">{String(a.group_id)}</span> : null}
                    </div>
                  ))}
                  {(data.yara as any[])?.map((y: Record<string, unknown>, j: number) => (
                    <div key={`yr-${j}`} className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1">
                      <FileCode className="h-3 w-3 text-amber-400" />
                      <span className="text-amber-300">{String(y.rule_name)}</span>
                      <span className="text-zinc-400">{String(y.target_family || "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {emptyIocs.length > 0 && resultsData.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {emptyIocs.length} IOCs with no results
          </summary>
          <div className="flex flex-wrap gap-1 mt-2">
            {emptyIocs.map((ioc, i) => (
              <span key={i} className="text-[10px] rounded px-2 py-1 bg-muted/20 text-muted-foreground font-mono">{ioc}</span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
