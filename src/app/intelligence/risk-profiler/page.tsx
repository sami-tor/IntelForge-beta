"use client"

import { useState } from "react"
import { Shield, ShieldAlert, Search, Plus, X, Bomb, Package, Bug, AlertTriangle } from "lucide-react"
import Link from "next/link"

const TECH_SUGGESTIONS = [
  "nginx", "apache", "postgresql", "mysql", "redis", "node.js",
  "react", "next.js", "django", "spring", "kubernetes", "docker", "jenkins",
]

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/5",
  HIGH: "border-orange-500/30 bg-orange-500/5",
  MEDIUM: "border-yellow-500/30 bg-yellow-500/5",
  LOW: "border-green-500/30 bg-green-500/5",
}

export default function RiskProfilerPage() {
  const [products, setProducts] = useState<{ product: string; version: string }[]>([{ product: "", version: "" }])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")

  const addProduct = () => setProducts([...products, { product: "", version: "" }])
  const removeProduct = (i: number) => setProducts(products.filter((_, idx) => idx !== i))
  const updateProduct = (i: number, field: "product" | "version", value: string) => {
    const updated = [...products]
    updated[i][field] = value
    setProducts(updated)
  }

  const handleScan = async () => {
    const stack = products.filter((p) => p.product.trim())
    if (stack.length === 0) { setError("Add at least one product"); return }
    setLoading(true)
    setError("")
    setResults(null)
    try {
      const res = await fetch("/api/intel/risk-profiler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stack }),
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

  const resultData = results?.results as Array<Record<string, unknown>> | undefined

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organization Risk Profiler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your tech stack to discover relevant vulnerabilities, supply chain risks, and available exploits
        </p>
      </div>

      {/* Product input */}
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" value={p.product} onChange={(e) => updateProduct(i, "product", e.target.value)}
              placeholder="Product (e.g., nginx, postgresql, react)"
              className="flex-1 h-10 px-4 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input type="text" value={p.version} onChange={(e) => updateProduct(i, "version", e.target.value)}
              placeholder="Version (optional)"
              className="w-32 h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {products.length > 1 && (
              <button onClick={() => removeProduct(i)} className="p-2 text-muted-foreground hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <button onClick={addProduct} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3 w-3" /> Add product
          </button>
          <button onClick={handleScan} disabled={loading}
            className="ml-auto h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? "Analyzing..." : "Profile Risk"}
          </button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1">
          {TECH_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => {
              const empty = products.findIndex((p) => !p.product.trim())
              if (empty >= 0) updateProduct(empty, "product", s)
              else { setProducts([...products, { product: s, version: "" }]) }
            }}
              className="text-[9px] rounded-full px-2 py-0.5 bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Overall risk */}
      {results && (
        <div className={`rounded-xl border p-4 ${RISK_COLOR[String(results.overallRisk)] || ""}`}>
          <div className="flex items-center gap-2">
            {String(results.overallRisk) === "CRITICAL" ? <ShieldAlert className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            <span className="font-bold">Overall Risk: {String(results.overallRisk)}</span>
            <span className="text-sm text-muted-foreground ml-auto">{String(results.totalCves)} vulnerabilities found</span>
          </div>
        </div>
      )}

      {/* Per-product results */}
      {resultData?.map((r, i) => (
        <div key={i} className={`rounded-xl border p-4 ${RISK_COLOR[String(r.totalRisk)] || ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold text-foreground">{String(r.product)}</span>
            {r.version?.toString() && <span className="text-sm text-muted-foreground">v{String(r.version)}</span>}
            <span className="text-[9px] rounded px-1.5 py-0.5 bg-primary/10 text-primary ml-auto">Risk: {String(r.totalRisk)}</span>
          </div>

          <div className="space-y-2">
            {/* CVEs */}
            {((r.cveMatches as any[]) || []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-orange-500/60 mb-1 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> CVEs ({(r.cveMatches as any[]).length})
                </p>
                <div className="space-y-0.5">
                  {(r.cveMatches as any[]).slice(0, 5).map((cve: any, j: number) => (
                    <Link key={j} href={`/intelligence/cve?q=${cve.cveId}`}
                      className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1 hover:bg-muted/30 transition-colors">
                      <span className="font-mono text-orange-400">{cve.cveId}</span>
                      {cve.isKev && <span className="text-[8px] px-1 rounded bg-red-500/15 text-red-400">KEV</span>}
                      <span className="text-zinc-400 truncate">{cve.description?.slice(0, 80)}</span>
                      <span className="ml-auto font-bold text-orange-400">{cve.score?.toFixed(1)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Supply Chain */}
            {((r.supplyChainMatches as any[]) || []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-cyan-500/60 mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Supply Chain ({(r.supplyChainMatches as any[]).length})
                </p>
                <div className="space-y-0.5">
                  {(r.supplyChainMatches as any[]).slice(0, 5).map((s: any, j: number) => (
                    <Link key={j} href="/intelligence/supply-chain"
                      className="flex items-center gap-2 text-[10px] rounded bg-muted/20 px-2 py-1 hover:bg-muted/30 transition-colors">
                      <span className="font-mono text-cyan-400">{s.osvId}</span>
                      <span className="text-zinc-300">{s.packageName}</span>
                      {s.fixedVersion && <span className="text-green-400">Fixed: {s.fixedVersion}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Exploits */}
            {((r.exploitMatches as any[]) || []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-red-500/60 mb-1 flex items-center gap-1">
                  <Bomb className="h-3 w-3" /> Public Exploits ({(r.exploitMatches as any[]).length})
                </p>
                <div className="space-y-0.5">
                  {(r.exploitMatches as any[]).map((e: any, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-[10px] rounded bg-red-500/5 px-2 py-1">
                      <span className="font-mono text-red-400">{e.exploitId}</span>
                      <span className="text-zinc-400 truncate">{e.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
