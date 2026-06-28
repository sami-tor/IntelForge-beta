"use client"

import { useState } from "react"
import { Globe, Search, Shield, ShieldAlert, AlertTriangle, ExternalLink, FileCode, Fish, Key, ChevronDown, Radar } from "lucide-react"
import Link from "next/link"

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  LOW: "text-green-400 bg-green-500/10 border-green-500/20",
}

export default function AttackSurfacePage() {
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")

  const handleScan = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setError("")
    setReport(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    try {
      const res = await fetch(`/api/intel/attack-surface?domain=${encodeURIComponent(domain.trim())}`, {
        signal: controller.signal,
      })
      const json = await res.json()
      if (json.success) setReport(json.data)
      else setError(json.error || "Scan failed")
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Scan timed out. The domain lookup took too long — please try again.")
      } else {
        setError("Network error. Please check your connection and try again.")
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">External Attack Surface Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consolidated domain intelligence: certificate transparency, typosquatting, exposed secrets, and phishing mentions
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Enter domain (e.g., example.com)"
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={handleScan} disabled={loading || !domain.trim()}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "Scanning…" : "Generate Report"}
        </button>
      </div>

      {report && (
        <>
          {/* Overall Risk */}
          <div className={`rounded-xl border p-6 ${RISK_COLOR[String(report.overallRisk)] || ""}`}>
            <div className="flex items-center gap-3">
              {String(report.overallRisk) === "CRITICAL" || String(report.overallRisk) === "HIGH" ? (
                <ShieldAlert className="h-6 w-6" />
              ) : (
                <Shield className="h-6 w-6" />
              )}
              <div>
                <p className="text-sm font-bold">Overall Risk: {String(report.overallRisk)}</p>
                <p className="text-xs opacity-70">{String(report.domain)} · Generated {new Date(String(report.generatedAt)).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Certificates */}
            {(report.certs as Record<string, unknown>) && (
              <Link href={`/intelligence/cert-domain?q=${encodeURIComponent(domain)}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors block">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> SSL Certificates
                </p>
                <div className="space-y-1 text-xs">
                  <p>Total: <span className="font-bold">{String((report.certs as any).total)}</span></p>
                  <p>Wildcards: <span className="text-yellow-400 font-bold">{String((report.certs as any).wildcards)}</span></p>
                  <p>Revoked: <span className="text-red-400 font-bold">{String((report.certs as any).revoked)}</span></p>
                  {(report.certs as any).issuers?.length > 0 && (
                    <p className="text-muted-foreground">Issuers: {(report.certs as any).issuers.join(", ")}</p>
                  )}
                  <p className="text-[10px] text-primary hover:underline mt-2">View full report →</p>
                </div>
              </Link>
            )}

            {/* Typosquatting */}
            {(report.typosquats as Record<string, unknown>) && (
              <Link href={`/intelligence/typosquatting?q=${encodeURIComponent(domain)}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors block">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Typosquatting
                </p>
                <div className="space-y-1 text-xs">
                  <p>Variants: <span className="font-bold">{String((report.typosquats as any).total)}</span></p>
                  <p>High Risk: <span className="text-red-400 font-bold">{String((report.typosquats as any).highRisk)}</span></p>
                  <p>DNS Resolving: <span className="text-yellow-400 font-bold">{String((report.typosquats as any).resolving)}</span></p>
                  {(report.typosquats as any).topRisks?.slice(0, 3).map((t: any, i: number) => (
                    <div key={i} className="text-[10px] text-muted-foreground ml-1">
                      <span className="font-mono text-orange-400">{t.domain}</span> ({t.type}, risk {t.riskScore})
                    </div>
                  ))}
                  <p className="text-[10px] text-primary hover:underline mt-2">View full report →</p>
                </div>
              </Link>
            )}

            {/* GitHub Secrets */}
            {(report.githubSecrets as Record<string, unknown>) && (
              <Link href={`/intelligence/github-secrets?q=${encodeURIComponent(domain)}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors block">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Exposed Secrets
                </p>
                <div className="space-y-1 text-xs">
                  <p>Found: <span className="font-bold">{String((report.githubSecrets as any).total)}</span></p>
                  <p>Critical: <span className="text-red-400 font-bold">{String((report.githubSecrets as any).critical)}</span></p>
                  {(report.githubSecrets as any).repos?.map((r: string, i: number) => (
                    <p key={i} className="text-[10px] font-mono text-pink-400 truncate">{r}</p>
                  ))}
                  <p className="text-[10px] text-primary hover:underline mt-2">View details →</p>
                </div>
              </Link>
            )}

            {/* Phishing */}
            {(report.phishingMentions as Record<string, unknown>) && (
              <Link href={`/intelligence/phishing?q=${encodeURIComponent(domain)}`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors block">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Fish className="h-3.5 w-3.5" /> Phishing Mentions
                </p>
                <div className="space-y-1 text-xs">
                  <p>Total: <span className="font-bold">{String((report.phishingMentions as any).total)}</span></p>
                  <p>Active: <span className="text-red-400 font-bold">{String((report.phishingMentions as any).active)}</span></p>
                  <p className="text-[10px] text-primary hover:underline mt-2">View details →</p>
                </div>
              </Link>
            )}
          </div>

          {/* Subdomains */}
          {(report.subdomains as string[])?.length > 0 && (
            <details className="rounded-xl border border-border bg-card p-4">
              <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">
                Discovered Subdomains ({(report.subdomains as string[]).length})
              </summary>
              <div className="flex flex-wrap gap-1 mt-3">
                {(report.subdomains as string[]).map((s, i) => (
                  <Link key={i} href={`/intelligence/cert-domain?q=${encodeURIComponent(s)}`}
                    className="text-[9px] rounded-full px-2 py-1 bg-primary/5 text-primary font-mono border border-primary/10 hover:bg-primary/10 transition-colors">
                    {s}
                  </Link>
                ))}
              </div>
            </details>
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
