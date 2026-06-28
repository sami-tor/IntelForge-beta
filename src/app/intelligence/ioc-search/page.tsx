"use client"

import { useState } from "react"
import { Search, Loader2, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Copy, Check, Globe, Fish, Bug, Radar } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { IOCLookupResult, IOCSourceResult } from "@/lib/intel/types"

const EXAMPLE_IOCS = [
  { label: "IP",     value: "185.220.101.1" },
  { label: "Domain", value: "malware-c2.example.com" },
  { label: "Hash",   value: "44d88612fea8a8f36de82e1278abb02f" },
  { label: "URL",    value: "http://suspicious.example.com/payload.exe" },
]

const VERDICT_STYLE = {
  malicious:  { icon: ShieldX,     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",    label: "MALICIOUS" },
  suspicious: { icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "SUSPICIOUS" },
  clean:      { icon: ShieldCheck, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20", label: "CLEAN" },
  unknown:    { icon: AlertTriangle,color: "text-muted-foreground", bg: "bg-muted/50 border-border",   label: "UNKNOWN" },
}

function SourceCard({ source, index }: { source: IOCSourceResult; index: number }) {
  const v = source.verdict || "unknown"
  const style = VERDICT_STYLE[v as keyof typeof VERDICT_STYLE] || VERDICT_STYLE.unknown
  const Icon = style.icon

  return (
    <div className={`rounded-lg border p-3 ${style.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${style.color}`} />
          <span className="text-xs font-medium text-foreground">Detailed check {index + 1}</span>
        </div>
        {!source.error && (
          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${style.color}`}>
            {style.label}
          </Badge>
        )}
      </div>
      {source.error ? (
        <p className="text-[10px] text-muted-foreground italic">{source.error}</p>
      ) : (
        <div className="space-y-1">
          {Object.entries(source.data).map(([k, v]) => {
            if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null
            return (
              <div key={k} className="flex gap-2 text-[10px]">
                <span className="text-muted-foreground capitalize min-w-[80px]">{k.replace(/_/g, " ")}:</span>
                <span className="text-foreground font-mono truncate">
                  {Array.isArray(v) ? (v as string[]).slice(0, 5).join(", ") : String(v)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function IOCSearchPage() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<IOCLookupResult | null>(null)
  const [correlated, setCorrelated] = useState<Record<string, unknown[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const handleSearch = async (val?: string) => {
    const v = (val ?? input).trim()
    if (!v) return

    setLoading(true)
    setError("")
    setResult(null)
    setCorrelated(null)

    try {
      // Run external IOC lookup and local DB correlation in parallel
      const [iocRes, correlateRes] = await Promise.all([
        fetch("/api/intel/ioc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: v }),
        }),
        fetch(`/api/intel/correlate?q=${encodeURIComponent(v)}`, { credentials: "include" }),
      ])

      const iocData = await iocRes.json()
      if (!iocRes.ok) {
        setError(iocData.error || "Lookup failed")
        if (iocData.upgradeRequired) setError(`${iocData.error} — Upgrade to ${iocData.upgradeRequired} for more lookups.`)
        setResult(null)
      } else {
        setResult(iocData.data)
      }

      const correlateData = await correlateRes.json()
      if (correlateData.success && correlateData.data) {
        setCorrelated(correlateData.data)
      }
    } catch (e) {
      if (!result) setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const v = result?.verdict
  const verdictStyle = v ? VERDICT_STYLE[v] : null
  const VerdictIcon = verdictStyle?.icon

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">IOC Lookup</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auto-detects IP, domain, file hash, and URL, then cross-checks against multiple cached intelligence feeds
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          className="font-mono text-sm"
          placeholder="Enter IP, domain, MD5/SHA256 hash, or URL..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={() => handleSearch()} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Quick examples */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_IOCS.map((ex) => (
          <button
            key={ex.value}
            onClick={() => { setInput(ex.value); handleSearch(ex.value) }}
            className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors font-mono"
          >
            {ex.label}: {ex.value}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Verdict header */}
          <div className={`rounded-xl border p-4 ${verdictStyle?.bg}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {VerdictIcon && <VerdictIcon className={`h-6 w-6 ${verdictStyle?.color}`} />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${verdictStyle?.color}`}>
                      {verdictStyle?.label}
                    </span>
                    <Badge variant="outline" className="text-xs uppercase">
                      {result.iocType}
                    </Badge>
                  </div>
                  <p className="font-mono text-sm text-foreground mt-0.5">{result.iocValue}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className={`text-2xl font-bold ${verdictStyle?.color}`}>{result.confidenceScore}%</p>
              </div>
            </div>
            {result.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {result.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Source cards */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Detailed results ({result.sources.length})</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied!" : "Copy JSON"}
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {result.sources.map((s, i) => <SourceCard key={`${s.source}-${i}`} source={s} index={i} />)}
          </div>

          {/* Cross-reference links based on IOC type */}
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary mb-2">Correlate Across IntelHub</p>
            <div className="flex flex-wrap gap-2">
              {result.iocType === "domain" && (
                <>
                  <Link href={`/intelligence/cert-domain?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Globe className="h-2.5 w-2.5" /> Domain Intel
                  </Link>
                  <Link href={`/intelligence/typosquatting?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> Typosquatting
                  </Link>
                  <Link href={`/intelligence/phishing?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Fish className="h-2.5 w-2.5" /> Phishing Intel
                  </Link>
                  <Link href={`/intelligence/attack-surface?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Radar className="h-2.5 w-2.5" /> Attack Surface
                  </Link>
                </>
              )}
              {result.iocType === "ip" && (
                <>
                  <Link href={`/intelligence/malware?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Bug className="h-2.5 w-2.5" /> Malware Intel
                  </Link>
                  <Link href={`/intelligence/phishing?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Fish className="h-2.5 w-2.5" /> Phishing Intel
                  </Link>
                  <Link href={`/intelligence/ioc-search?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Search className="h-2.5 w-2.5" /> IOC Lookup
                  </Link>
                </>
              )}
              {result.iocType === "hash" && (
                <>
                  <Link href={`/intelligence/malware?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Bug className="h-2.5 w-2.5" /> Malware Intel
                  </Link>
                  <Link href={`/intelligence/yara?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> YARA Rules
                  </Link>
                  <Link href={`/intelligence/ioc-search?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Search className="h-2.5 w-2.5" /> IOC Lookup
                  </Link>
                </>
              )}
              {result.iocType === "url" && (
                <>
                  <Link href={`/intelligence/phishing?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Fish className="h-2.5 w-2.5" /> Phishing Intel
                  </Link>
                  <Link href={`/intelligence/malware?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Bug className="h-2.5 w-2.5" /> Malware Intel
                  </Link>
                  <Link href={`/intelligence/ioc-search?q=${encodeURIComponent(result.iocValue)}`}
                    className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                    <Search className="h-2.5 w-2.5" /> IOC Lookup
                  </Link>
                </>
              )}
              <Link href={`/intelligence/attack-surface?q=${encodeURIComponent(result.iocValue)}`}
                className="text-[10px] px-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-colors flex items-center gap-1">
                <Radar className="h-2.5 w-2.5" /> Attack Surface
              </Link>
            </div>
          </div>

          {/* Correlated Local Intel (from correlate API) */}
          {correlated && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Radar className="h-3 w-3" /> Local Intelligence Correlation
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 text-[10px]">
                {Object.entries(correlated)
                  .filter(([, v]) => Array.isArray(v) && v.length > 0)
                  .slice(0, 12)
                  .map(([key, items]) => {
                    const count = (items as unknown[]).length
                    const linkMap: Record<string, string> = {
                      cve: `/intelligence/cve?q=${encodeURIComponent(result.iocValue)}`,
                      exploits: `/intelligence/exploits?q=${encodeURIComponent(result.iocValue)}`,
                      malware: `/intelligence/malware?q=${encodeURIComponent(result.iocValue)}`,
                      phishing: `/intelligence/phishing?q=${encodeURIComponent(result.iocValue)}`,
                      certs: `/intelligence/cert-domain?q=${encodeURIComponent(result.iocValue)}`,
                      typosquats: `/intelligence/typosquatting?q=${encodeURIComponent(result.iocValue)}`,
                      actors: `/intelligence/threat-actors?q=${encodeURIComponent(result.iocValue)}`,
                      groups: `/intelligence/ransomware?q=${encodeURIComponent(result.iocValue)}`,
                      victims: `/intelligence/ransomware?view=victims&q=${encodeURIComponent(result.iocValue)}`,
                      darknet: `/intelligence/darknet?q=${encodeURIComponent(result.iocValue)}`,
                      aptCampaigns: `/intelligence/apt-campaigns?q=${encodeURIComponent(result.iocValue)}`,
                      supplyChain: `/intelligence/supply-chain?q=${encodeURIComponent(result.iocValue)}`,
                      techniques: `/intelligence/attack-patterns?q=${encodeURIComponent(result.iocValue)}`,
                      sigma: `/intelligence/sigma?q=${encodeURIComponent(result.iocValue)}`,
                      yaraRules: `/intelligence/yara?q=${encodeURIComponent(result.iocValue)}`,
                      githubSecrets: `/intelligence/github-secrets?q=${encodeURIComponent(result.iocValue)}`,
                      news: `/intelligence/news?q=${encodeURIComponent(result.iocValue)}`,
                    }
                    const href = linkMap[key]
                    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())
                    return href ? (
                      <Link key={key} href={href}
                        className="rounded px-2 py-1.5 border border-border bg-card hover:border-primary/30 transition-colors">
                        <span className="font-bold text-foreground">{count}</span>{" "}
                        <span className="text-muted-foreground">{label}</span>
                      </Link>
                    ) : null
                  })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Looked up at {new Date(result.lookupTimestamp).toLocaleTimeString()} · Results cached for 1 hour
          </p>
        </div>
      )}

      {/* How it works */}
      {!result && !loading && (
        <div className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
          <h3 className="text-sm font-semibold">Supported Indicator Types</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
            {[
              { title: "IP Address", desc: "Checks open ports, CVE exposure, abuse confidence score, mass-scanner classification, and community detections" },
              { title: "File Hash (MD5 / SHA1 / SHA256)", desc: "Looks up malware family, file type, AV detection results, and threat indicator match" },
              { title: "Domain", desc: "Checks domain reputation, malware hosting status, and threat indicator match" },
              { title: "URL", desc: "Scans URL against malware and phishing databases, checks threat indicator match" },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-border bg-background p-3">
                <p className="font-medium text-foreground mb-1">{item.title}</p>
                <p className="text-[11px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Results are aggregated from multiple threat intelligence databases and cached for 1 hour.
          </p>
        </div>
      )}
    </div>
  )
}
