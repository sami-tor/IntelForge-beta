"use client"

import { useState } from "react"
import { Globe, Search, ExternalLink, Shield, ShieldX, AlertTriangle, Fish, Radar } from "lucide-react"
import Link from "next/link"

export default function CertDomainPage() {
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ certs: Array<Record<string, unknown>>; subdomains: string[] } | null>(null)
  const [error, setError] = useState("")

  const handleSearch = async (val?: string) => {
    const q = (val ?? domain).trim()
    if (!q) return
    if (!val) setDomain(q)
    else setDomain(val)
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch(`/api/intel/cert-transparency?domain=${encodeURIComponent(q)}`)
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Domain Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Certificate Transparency lookup via crt.sh — discover subdomains, SSL certificates, and infrastructure
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter domain (e.g., example.com)"
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={() => handleSearch()} disabled={loading || !domain.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Searching..." : "Lookup"}
        </button>
      </div>

      {/* Results */}
      {data && (
        <>
          {/* Cross-reference links */}
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub for {domain}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/intelligence/typosquatting?q=${encodeURIComponent(domain)}`}
                className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> Typosquatting
              </Link>
              <Link href={`/intelligence/phishing?q=${encodeURIComponent(domain)}`}
                className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                <Fish className="h-2.5 w-2.5" /> Phishing Intel
              </Link>
              <Link href={`/intelligence/attack-surface?q=${encodeURIComponent(domain)}`}
                className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                <Radar className="h-2.5 w-2.5" /> Attack Surface
              </Link>
              <Link href={`/intelligence/ioc-search?q=${encodeURIComponent(domain)}`}
                className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                <Search className="h-2.5 w-2.5" /> IOC Lookup
              </Link>
            </div>
          </div>
          {/* Subdomains */}
          {data.subdomains.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Discovered Subdomains ({data.subdomains.length})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {data.subdomains.map((s) => (
                  <button key={s} onClick={() => handleSearch(s)}
                    className="text-[10px] rounded-full px-2 py-1 bg-primary/5 text-primary font-mono border border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Certificates */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              SSL Certificates ({data.certs.length})
            </h2>
            {data.certs.map((cert: Record<string, unknown>, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-foreground">{String(cert.domain || "N/A")}</span>
                  {Boolean(cert.wildcard) && (
                    <span className="text-[9px] rounded px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400">Wildcard</span>
                  )}
                  {Boolean(cert.revoked) ? (
                    <span className="flex items-center gap-0.5 text-red-400"><ShieldX className="h-2.5 w-2.5" /> Revoked</span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-green-400"><Shield className="h-2.5 w-2.5" /> Valid</span>
                  )}
                </div>
                {cert.issuer ? (
                  <p className="text-muted-foreground">Issuer: {String(cert.issuer)}</p>
                ) : null}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {cert.notBefore ? <span>From: {new Date(String(cert.notBefore)).toLocaleDateString()}</span> : null}
                  {cert.notAfter ? <span>To: {new Date(String(cert.notAfter)).toLocaleDateString()}</span> : null}
                </div>
              </div>
            ))}
          </div>

          {data.certs.length === 0 && data.subdomains.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No certificates found for this domain.</p>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  )
}
