"use client"

import { useState } from "react"
import { Globe, Search, AlertTriangle, Shield, ExternalLink, Fish, Radar } from "lucide-react"
import Link from "next/link"

export default function TyposquattingPage() {
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")

  const handleSearch = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch(`/api/intel/typosquatting?domain=${encodeURIComponent(domain.trim())}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || "Lookup failed")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const results = (data?.results || []) as Array<Record<string, unknown>>
  const highRisk = results.filter((r) => Number(r.riskScore) >= 50)
  const resolving = results.filter((r) => r.dnsResolves)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Domain Typosquatting Detection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate and check typo-domain variants — identify homoglyph attacks, typosquatting, and brand impersonation domains
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter domain to scan (e.g., google.com)"
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={handleSearch} disabled={loading || !domain.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Scanning..." : "Scan Domain"}
        </button>
      </div>

      {/* Cross-reference links */}
      {data && (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub for {domain}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/intelligence/cert-domain?q=${encodeURIComponent(domain)}`}
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
              <Globe className="h-2.5 w-2.5" /> Domain Intel
            </Link>
            <Link href={`/intelligence/phishing?q=${encodeURIComponent(domain)}`}
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
              <Fish className="h-2.5 w-2.5" /> Phishing Intel
            </Link>
            <Link href={`/intelligence/attack-surface?q=${encodeURIComponent(domain)}`}
              className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
              <Radar className="h-2.5 w-2.5" /> Attack Surface
            </Link>
          </div>
        </div>
      )}

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Variants Generated</p>
            <p className="text-2xl font-bold">{String(data.totalVariants)}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs text-muted-foreground">High Risk</p>
            <p className="text-2xl font-bold text-red-400">{String(data.highRisk)}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-xs text-muted-foreground">DNS Resolving</p>
            <p className="text-2xl font-bold text-yellow-400">{String(data.resolving)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Original Domain</p>
            <p className="text-sm font-mono font-bold text-foreground truncate">{String(data.originalDomain)}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detected Variants</h2>

          {/* High risk first */}
          {highRisk.map((r, i) => (
            <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span className="font-mono text-sm text-red-400">{String(r.variantDomain)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] rounded px-1.5 py-0.5 bg-red-500/10 text-red-400">{String(r.variantType)}</span>
                  <span className="text-[10px] font-bold text-red-400">Risk: {String(r.riskScore)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-5 text-[10px] text-muted-foreground">
                <span>Distance: {String(r.levenshteinDistance)}</span>
                {Boolean(r.dnsResolves) && <span className="text-yellow-400">DNS resolves to {String(r.resolvedIp || "")}</span>}
              </div>
            </div>
          ))}

          {/* Resolving but lower risk */}
          {resolving.filter((r) => Number(r.riskScore) < 50).slice(0, 20).map((r, i) => (
            <div key={`res-${i}`} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-yellow-400" />
                  <span className="font-mono text-sm text-foreground">{String(r.variantDomain)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">{String(r.variantType)}</span>
                  <span className="text-[10px] text-yellow-400">Risk: {String(r.riskScore)}</span>
                </div>
              </div>
              <div className="ml-5 text-[10px] text-muted-foreground mt-1">
                <span>Distance: {String(r.levenshteinDistance)}</span>
                {r.resolvedIp ? <span> · DNS: {String(r.resolvedIp)}</span> : null}
              </div>
            </div>
          ))}

          {/* Non-resolving variants */}
          <details className="mt-3">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
              Show {results.filter((r) => !r.dnsResolves).length} non-resolving variants
            </summary>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {results.filter((r) => !r.dnsResolves).map((r, i) => (
                <span key={i} className="text-[10px] rounded px-2 py-1 bg-muted/10 text-muted-foreground font-mono border border-border">
                  {String(r.variantDomain)} ({String(r.variantType)})
                </span>
              ))}
            </div>
          </details>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  )
}
