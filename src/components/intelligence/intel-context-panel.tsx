"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldAlert, Skull, Bug, Newspaper, Users, Bomb, Fish, Package,
  FileCode, Eye, CalendarClock, Key, Terminal, Globe,
  AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Zap,
  FolderPlus, Check, Loader2,
} from "lucide-react"

interface IntelPanelProps { query: string }

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  LOW:      "text-green-400 bg-green-500/10 border-green-500/20",
}

const RISK_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low:      "text-green-400 bg-green-500/10 border-green-500/20",
}

const CATEGORY_COLOR: Record<string, string> = {
  ransomware: "text-red-400 bg-red-500/8", vulnerability: "text-orange-400 bg-orange-500/8",
  breach: "text-purple-400 bg-purple-500/8", malware: "text-yellow-400 bg-yellow-500/8",
  "nation-state":"text-blue-300 bg-blue-600/8", general: "text-zinc-400 bg-zinc-800",
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h > 48) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60000)}m ago`
}

function countHits(data: Record<string, unknown>, type: string): number {
  if (!data || type === "none") return 0
  let c = 0
  const arrKeys = ["news","cves","groups","victims","malware","actors","techniques",
    "exploits","phishing","supplyChain","sigma","darknet","aptCampaigns","githubSecrets","yaraRules",
    "malwareIocs","iocMatches","malwareUrls","iocLookups","typosquats","certs"]
  for (const k of arrKeys) {
    const v = data[k]
    if (Array.isArray(v)) c += v.length
  }
  if (data.cve) c++
  if (data.sample) c++
  return c
}

export function IntelContextPanel({ query }: IntelPanelProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [type, setType] = useState<string>("none")
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalHits = countHits(data || {}, type)

  const saveInvestigation = async () => {
    setSaving(true)
    try {
      const d = data as Record<string, unknown[]>
      const body = {
        title: `Investigation: ${query}`,
        query,
        searchResultsCount: 0,
        linkedCves: type === "cve" && (data as any)?.cve ? [(data as any).cve.cve_id] : (d?.cves || []).map((c: any) => c.cve_id),
        linkedGroups: (d?.groups || []).map((g: any) => g.name),
        linkedVictims: (d?.victims || []).map((v: any) => v.victim_name),
        linkedActors: (d?.actors || []).map((a: any) => a.name),
        linkedIocs: type === "hash" && (data as any)?.sample?.sha256 ? [(data as any).sample.sha256] : [],
        linkedNewsUrls: ((d?.news || [])).map((n: any) => n.url),
        tags: [type],
      }
      const res = await fetch("/api/intel/investigations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  useEffect(() => {
    if (!query || query.length < 3) return
    setSaved(false)
    setLoading(true)
    setData(null)
    setType("none")
    fetch(`/api/intel/correlate?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((res) => { setType(res.type || "none"); setData(res.data || {}) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query])

  if (totalHits === 0 && !loading) return null
  if (loading) return (
    <div className="mb-4 rounded-xl border border-[#2c2535] bg-[#141018]/60 p-3 flex items-center gap-2 text-sm text-zinc-400">
      <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
      Searching 19 intelligence databases…
    </div>
  )

  return (
    <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
      <button onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-yellow-500/5 transition-colors rounded-xl">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-300">Intel Context</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
            {totalHits} hit{totalHits !== 1 ? "s" : ""} across {countCategories(data || {}, type)} sources
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/intelligence/actor-report?q=${encodeURIComponent(query)}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
            Deep Report
          </Link>
          <button onClick={(e) => { e.stopPropagation(); saveInvestigation() }}
            disabled={saving || saved}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3 text-green-400" /> : <FolderPlus className="h-3 w-3" />}
            {saved ? "Saved!" : "Save"}
          </button>
          {collapsed ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-yellow-500/10 pt-3">

          {/* CVE */}
          {type === "cve" && (data as any)?.cve && <CVECard cve={(data as any).cve} exploits={(data as any).exploits} aptCampaigns={(data as any).aptCampaigns} sigmaRules={(data as any).sigmaRules} />}

          {/* Hash */}
          {type === "hash" && (data as any)?.sample && <MalwareCard sample={(data as any).sample} yaraRules={(data as any).yaraRules} />}

          {/* IP */}
          {type === "ip" && <IOCSection data={data as any} />}

          {/* Domain */}
          {type === "domain" && <DomainSection data={data as any} />}

          {/* URL */}
          {type === "url" && <URLSection data={data as any} />}

          {/* Keyword */}
          {type === "keyword" && <KeywordResults data={data as any} />}

          {/* News */}
          {Array.isArray((data as any)?.news) && (data as any).news.length > 0 && (
            <NewsSection articles={(data as any).news} />
          )}

          <div className="pt-1 border-t border-[#2c2535] flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">Data from local intelligence cache</p>
            <Link href="/intelligence" className="text-[10px] text-yellow-500/70 hover:text-yellow-400 flex items-center gap-1">
              Intelligence Hub <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Category count ----
function countCategories(data: Record<string, unknown>, type: string): number {
  if (!data) return 0
  let count = 0
  for (const [k, v] of Object.entries(data)) {
    if (k === "query" || k === "news") continue
    if (Array.isArray(v) && v.length > 0) count++
    else if (v && typeof v === "object" && !Array.isArray(v)) count++
  }
  return count
}

// ---- CVE Card (with deep links) ----
function CVECard({ cve, exploits, aptCampaigns, sigmaRules }: { cve: Record<string, unknown>; exploits?: Record<string, unknown>[]; aptCampaigns?: Record<string, unknown>[]; sigmaRules?: Record<string, unknown>[] }) {
  const score = Number(cve.cvss_v3_score)
  const severity = String(cve.cvss_v3_severity || "")
  const epss = Math.round(Number(cve.epss_score || 0) * 100)
  const cveId = String(cve.cve_id || "")

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldAlert className="h-4 w-4 text-orange-400 shrink-0" />
            <a href={`https://nvd.nist.gov/vuln/detail/${cveId}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs font-bold text-orange-300 hover:underline">{cveId}</a>
            {severity && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[severity] || ""}`}>{severity}</span>}
            {!!cve.is_kev && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/15 text-red-400 border border-red-500/20 font-semibold">KEV</span>}
          </div>
          {score > 0 && <span className={`text-sm font-bold shrink-0 ${score >= 9 ? "text-red-400" : score >= 7 ? "text-orange-400" : "text-yellow-400"}`}>{score.toFixed(1)}</span>}
        </div>
        <p className="text-[11px] text-zinc-400 line-clamp-3 mb-2">{String(cve.description || "")}</p>
        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
          {epss > 0 && <span>Exploit probability: <span className={epss >= 50 ? "text-red-400 font-semibold" : epss >= 10 ? "text-orange-400" : "text-green-400"}>{epss}%</span></span>}
          {!!cve.vendor && <span>Vendor: {String(cve.vendor)}</span>}
          {!!cve.product && <span>Product: {String(cve.product)}</span>}
        </div>
      </div>

      {/* Linked exploits */}
      {exploits && exploits.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-red-500/60 mb-1 flex items-center gap-1"><Bomb className="h-3 w-3" /> Related Exploits</p>
          <div className="space-y-1">
            {exploits.map((e, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
                <span className="font-mono text-[10px] text-red-400">{String(e.exploit_id)}</span>
                <span className="text-zinc-300 truncate flex-1">{String(e.title)}</span>
                {Boolean(e.poc_url) && <a href={String(e.poc_url)} target="_blank" rel="noopener noreferrer" className="text-[9px] text-red-400 hover:underline shrink-0">PoC →</a>}
              </div>
            ))}
          </div>
          <Link href={`/intelligence/exploits`} className="text-[9px] text-red-400 hover:underline">View all exploits →</Link>
        </div>
      )}

      {/* Linked APT campaigns */}
      {aptCampaigns && aptCampaigns.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-purple-500/60 mb-1 flex items-center gap-1"><CalendarClock className="h-3 w-3" /> APT Campaigns Using This CVE</p>
          <div className="space-y-1">
            {aptCampaigns.map((c, i) => (
              <Link key={i} href={`/intelligence/apt-campaigns?q=${encodeURIComponent(String(c.campaign_name))}`}
                className="flex items-center gap-2 rounded-lg border border-purple-500/10 bg-purple-500/3 px-3 py-1.5 text-xs hover:border-purple-500/20">
                <span className="text-zinc-300 font-medium">{String(c.campaign_name)}</span>
                <span className="text-zinc-500">by {String(c.threat_actor)}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded ml-auto ${c.confidence === "confirmed" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>{String(c.confidence)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Linked Sigma rules */}
      {sigmaRules && sigmaRules.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-blue-500/60 mb-1 flex items-center gap-1"><FileCode className="h-3 w-3" /> Detection Rules</p>
          <div className="flex flex-wrap gap-1">
            {sigmaRules.map((s, i) => (
              <Link key={i} href="/intelligence/sigma"
                className="text-[9px] rounded px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/15 hover:bg-blue-500/20">
                {String(s.title)} {s.level ? `[${String(s.level).toUpperCase()}]` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Malware Card ----
function MalwareCard({ sample, yaraRules, compact }: { sample: Record<string, unknown>; yaraRules?: Record<string, unknown>[]; compact?: boolean }) {
  const families = Array.isArray(sample.malware_family) ? sample.malware_family as string[] : []
  return (
    <div className="space-y-2">
      <div className={`rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3`}>
        <div className="flex items-start gap-2 mb-1">
          <Bug className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {!!(sample.sha256 || sample.sha1 || sample.md5) && (
              <p className="font-mono text-[10px] text-yellow-300 truncate">{String(sample.sha256 || sample.sha1 || sample.md5 || "").slice(0, 40)}…</p>
            )}
            {!!sample.file_name && <p className="text-[11px] text-zinc-400 truncate">{String(sample.file_name)}</p>}
          </div>
        </div>
        {families.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {families.map((f) => (
              <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">{f}</span>
            ))}
          </div>
        )}
      </div>
      {yaraRules && yaraRules.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-amber-500/60 mb-1 flex items-center gap-1"><Terminal className="h-3 w-3" /> Matching YARA Rules</p>
          <div className="flex flex-wrap gap-1">
            {yaraRules.map((y, i) => (
              <Link key={i} href="/intelligence/yara"
                className="text-[9px] rounded px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/15 hover:bg-amber-500/20">
                {String(y.rule_name)} [{String(y.severity || "medium")}]
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- IOC Section (IP) ----
function IOCSection({ data }: { data: Record<string, unknown[]> }) {
  return (
    <div className="space-y-3">
      {data.malwareIocs?.length > 0 && (
        <Section label="Malware IOC Matches" icon={Bug} color="text-yellow-500/60">
          {data.malwareIocs.map((m, i) => <MalwareCard key={i} sample={m as any} compact />)}
        </Section>
      )}
      {data.phishing?.length > 0 && (
        <Section label="Phishing Activity" icon={Fish} color="text-red-500/60">
          {(data.phishing as Record<string, unknown>[]).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-zinc-300 truncate">{String(p.url).replace(/^https?:\/\//, "").slice(0, 40)}</span>
              {Boolean(p.target_brand) && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400">{String(p.target_brand)}</span>}
              {!!p.active && <span className="text-[9px] text-green-400">Active</span>}
            </div>
          ))}
          <Link href="/intelligence/phishing" className="text-[9px] text-red-400 hover:underline">View phishing intel →</Link>
        </Section>
      )}
    </div>
  )
}

// ---- Domain Section ----
function DomainSection({ data }: { data: Record<string, unknown[]> }) {
  return (
    <div className="space-y-3">
      {data.phishing?.length > 0 && (
        <Section label="Phishing Activity" icon={Fish} color="text-red-500/60">
          {(data.phishing as Record<string, unknown>[]).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-zinc-300 truncate">{String(p.url).replace(/^https?:\/\//, "").slice(0, 40)}</span>
              {Boolean(p.target_brand) && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400">{String(p.target_brand)}</span>}
            </div>
          ))}
        </Section>
      )}
      {data.certs?.length > 0 && (
        <Section label="SSL Certificates" icon={Globe} color="text-blue-500/60">
          {(data.certs as Record<string, unknown>[]).slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-blue-500/10 bg-blue-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-blue-300">{String(c.domain)}</span>
              {!!c.wildcard && <span className="text-[9px] text-yellow-400">Wildcard</span>}
              {!!c.revoked ? <span className="text-[9px] text-red-400">Revoked</span> : <span className="text-[9px] text-green-400">Valid</span>}
            </div>
          ))}
          <Link href={`/intelligence/cert-domain?q=${data.query || ""}`} className="text-[9px] text-blue-400 hover:underline">View cert transparency →</Link>
        </Section>
      )}
      {data.typosquats?.length > 0 && (
        <Section label="Domain Typosquatting Risks" icon={AlertTriangle} color="text-orange-500/60">
          {(data.typosquats as Record<string, unknown>[]).slice(0, 5).map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-orange-500/10 bg-orange-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-orange-300">{String(t.variant_domain)}</span>
              <span className="text-[9px] text-zinc-500">{String(t.variant_type)}</span>
              <span className="text-[9px] font-bold text-orange-400 ml-auto">Risk: {String(t.risk_score)}</span>
            </div>
          ))}
          <Link href={`/intelligence/typosquatting?q=${data.query || ""}`} className="text-[9px] text-orange-400 hover:underline">Full typosquat scan →</Link>
        </Section>
      )}
      {data.malwareIocs?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-yellow-500/60 mb-1 flex items-center gap-1"><Bug className="h-3 w-3" /> Malware IOC Matches</p>
          {data.malwareIocs.map((m, i) => <MalwareCard key={i} sample={m as any} compact />)}
        </div>
      )}
    </div>
  )
}

// ---- URL Section ----
function URLSection({ data }: { data: Record<string, unknown[]> }) {
  return (
    <div className="space-y-3">
      {data.phishing?.length > 0 && (
        <Section label="Phishing Records" icon={Fish} color="text-red-500/60">
          {(data.phishing as Record<string, unknown>[]).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-zinc-300 truncate">{String(p.url).replace(/^https?:\/\//, "").slice(0, 40)}</span>
              {Boolean(p.target_brand) && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400">{String(p.target_brand)}</span>}
            </div>
          ))}
        </Section>
      )}
      {data.malwareUrls?.length > 0 && (
        <Section label="Malware URL Matches" icon={Bug} color="text-yellow-500/60">
          {data.malwareUrls.map((m, i) => <MalwareCard key={i} sample={m as any} compact />)}
        </Section>
      )}
    </div>
  )
}

// ---- Keyword Results (ALL features) ----
function KeywordResults({ data }: { data: Record<string, unknown[]> }) {
  return (
    <div className="space-y-3">
      {data.cves?.length > 0 && (
        <Section label="Matching Vulnerabilities" icon={ShieldAlert} color="text-orange-500/60">
          {(data.cves as Record<string, unknown>[]).map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[#2c2535] bg-[#141018] px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <a href={`https://nvd.nist.gov/vuln/detail/${c.cve_id}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[11px] text-orange-400 hover:underline shrink-0">{String(c.cve_id)}</a>
                {!!c.is_kev && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400">KEV</span>}
                <span className="text-[10px] text-zinc-500 truncate">{String(c.description || "").slice(0, 60)}…</span>
              </div>
              <span className="text-xs font-bold text-orange-400 shrink-0">{Number(c.cvss_v3_score || 0).toFixed(1)}</span>
            </div>
          ))}
        </Section>
      )}

      {data.exploits?.length > 0 && (
        <Section label="Exploit Database Matches" icon={Bomb} color="text-red-500/60">
          {(data.exploits as Record<string, unknown>[]).map((e, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-red-400">{String(e.exploit_id)}</span>
              {Boolean(e.cve_id) && <span className="font-mono text-[9px] text-orange-400">{String(e.cve_id)}</span>}
              <span className="text-zinc-300 truncate flex-1">{String(e.title)}</span>
            </div>
          ))}
          <Link href="/intelligence/exploits" className="text-[9px] text-red-400 hover:underline">View all exploits →</Link>
        </Section>
      )}

      {data.phishing?.length > 0 && (
        <Section label="Phishing Intelligence" icon={Fish} color="text-red-500/60">
          {(data.phishing as Record<string, unknown>[]).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-zinc-300 truncate">{String(p.url).replace(/^https?:\/\//, "").slice(0, 40)}</span>
              {Boolean(p.target_brand) && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400">{String(p.target_brand)}</span>}
            </div>
          ))}
        </Section>
      )}

      {data.supplyChain?.length > 0 && (
        <Section label="Supply Chain Vulnerabilities" icon={Package} color="text-cyan-500/60">
          {(data.supplyChain as Record<string, unknown>[]).map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-cyan-500/10 bg-cyan-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-cyan-400">{String(s.osv_id)}</span>
              <span className="text-zinc-300">{String(s.package_name)}</span>
              {Boolean(s.severity) && <span className={`text-[9px] px-1 py-0.5 rounded border ${SEVERITY_COLOR[String(s.severity)] || ""}`}>{String(s.severity)}</span>}
              {Boolean(s.fixed_version) && <span className="text-[9px] text-green-400">Fixed: {String(s.fixed_version)}</span>}
            </div>
          ))}
          <Link href="/intelligence/supply-chain" className="text-[9px] text-cyan-400 hover:underline">View supply chain intel →</Link>
        </Section>
      )}

      {data.techniques?.length > 0 && (
        <Section label="MITRE ATT&CK Techniques" icon={FileCode} color="text-purple-500/60">
          {(data.techniques as Record<string, unknown>[]).map((t, i) => (
            <Link key={i} href={`/intelligence/attack-patterns?q=${encodeURIComponent(String(t.technique_id))}`}
              className="flex items-center gap-2 rounded-lg border border-purple-500/10 bg-purple-500/3 px-3 py-1.5 text-xs hover:border-purple-500/20">
              <span className="font-mono text-[10px] text-purple-400">{String(t.technique_id)}</span>
              <span className="text-zinc-300">{String(t.name)}</span>
              {Array.isArray(t.tactic) && <span className="text-zinc-500 text-[9px]">{(t.tactic as string[]).join(", ")}</span>}
            </Link>
          ))}
          <Link href="/intelligence/attack-patterns" className="text-[9px] text-purple-400 hover:underline">View attack patterns →</Link>
        </Section>
      )}

      {data.sigma?.length > 0 && (
        <Section label="Sigma Detection Rules" icon={FileCode} color="text-blue-500/60">
          {(data.sigma as Record<string, unknown>[]).map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-blue-500/10 bg-blue-500/3 px-3 py-1.5 text-xs">
              <span className="text-zinc-300 flex-1">{String(s.title)}</span>
              {Boolean(s.level) && <span className={`text-[9px] px-1 py-0.5 rounded ${RISK_COLOR[String(s.level)] || ""}`}>{String(s.level).toUpperCase()}</span>}
              <span className="text-[9px] text-zinc-500">{String(s.logsource_product || "")}</span>
            </div>
          ))}
          <Link href="/intelligence/sigma" className="text-[9px] text-blue-400 hover:underline">View Sigma rules →</Link>
        </Section>
      )}

      {data.groups?.length > 0 && (
        <Section label="Ransomware Groups" icon={Skull} color="text-red-500/60">
          {(data.groups as Record<string, unknown>[]).map((g, i) => (
            <Link key={i} href={`/intelligence/ransomware?q=${encodeURIComponent(String(g.name))}`}
              className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs hover:border-red-500/20">
              <span className={`text-[9px] px-1 py-0.5 rounded ${g.active ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>{g.active ? "ACTIVE" : "INACTIVE"}</span>
              <span className="text-zinc-200 font-medium">{String(g.name)}</span>
              <span className="text-zinc-500">{Number(g.victim_count)} victims</span>
            </Link>
          ))}
          <Link href="/intelligence/ransomware" className="text-[9px] text-red-400 hover:underline">View ransomware tracker →</Link>
        </Section>
      )}

      {data.victims?.length > 0 && (
        <Section label="Ransomware Victims" icon={Skull} color="text-red-500/60">
          {(data.victims as Record<string, unknown>[]).map((v, i) => (
            <Link key={i} href={`/intelligence/ransomware?view=victims&q=${encodeURIComponent(String(v.victim_name))}`}
              className="flex items-center gap-2 rounded-lg border border-red-500/10 bg-red-500/3 px-3 py-1.5 text-xs hover:border-red-500/20">
              <span className="text-zinc-200 font-medium">{String(v.victim_name)}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-400">{String(v.group_name)}</span>
              {!!v.country && <span className="text-zinc-500">{String(v.country)}</span>}
            </Link>
          ))}
          <Link href="/intelligence/ransomware?view=victims" className="text-[9px] text-red-400 hover:underline">View ransomware tracker →</Link>
        </Section>
      )}

      {data.darknet?.length > 0 && (
        <Section label="Dark Web / Leak Posts" icon={Eye} color="text-purple-500/60">
          {(data.darknet as Record<string, unknown>[]).map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-purple-500/10 bg-purple-500/3 px-3 py-1.5 text-xs">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${p.severity === "critical" ? "bg-red-500" : p.severity === "high" ? "bg-orange-500" : "bg-yellow-500"}`} />
              <span className="text-zinc-300 truncate flex-1">{String(p.threat_actor || p.title || "")}</span>
              {Boolean(p.victim_name) && <span className="text-zinc-500">{String(p.victim_name)}</span>}
              {Boolean(p.severity) && <span className={`text-[9px] px-1 py-0.5 rounded ${RISK_COLOR[String(p.severity)] || ""}`}>{String(p.severity).toUpperCase()}</span>}
            </div>
          ))}
          <Link href="/intelligence/darknet" className="text-[9px] text-purple-400 hover:underline">View darknet monitor →</Link>
        </Section>
      )}

      {data.aptCampaigns?.length > 0 && (
        <Section label="APT Campaigns" icon={CalendarClock} color="text-indigo-500/60">
          {(data.aptCampaigns as Record<string, unknown>[]).map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-indigo-500/10 bg-indigo-500/3 px-3 py-1.5 text-xs">
              <span className="text-zinc-300 font-medium">{String(c.campaign_name)}</span>
              <span className="text-zinc-500">by {String(c.threat_actor)}</span>
              {!!c.is_active && <span className="text-[9px] text-green-400">Active</span>}
            </div>
          ))}
          <Link href="/intelligence/apt-campaigns" className="text-[9px] text-indigo-400 hover:underline">View APT campaigns →</Link>
        </Section>
      )}

      {data.actors?.length > 0 && (
        <Section label="Threat Actors" icon={Users} color="text-green-500/60">
          {(data.actors as Record<string, unknown>[]).map((a, i) => (
            <Link key={i} href={`/intelligence/threat-actors?q=${encodeURIComponent(String(a.name))}`}
              className="flex items-center gap-2 rounded-lg border border-green-500/10 bg-green-500/3 px-3 py-1.5 text-xs hover:border-green-500/20">
              <span className="text-zinc-200 font-medium">{String(a.name)}</span>
              {!!a.group_id && <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">{String(a.group_id)}</span>}
            </Link>
          ))}
          <Link href="/intelligence/threat-actors" className="text-[9px] text-green-400 hover:underline">View all threat actors →</Link>
        </Section>
      )}

      {data.githubSecrets?.length > 0 && (
        <Section label="GitHub Secret Exposures" icon={Key} color="text-pink-500/60">
          {(data.githubSecrets as Record<string, unknown>[]).map((g, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-pink-500/10 bg-pink-500/3 px-3 py-1.5 text-xs">
              <span className="text-pink-400 font-mono text-[10px]">{String(g.repo_name)}</span>
              <span className="text-zinc-500 truncate">{String(g.file_path)}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded ml-auto ${RISK_COLOR[String(g.risk_level)] || ""}`}>{String(g.risk_level).toUpperCase()}</span>
            </div>
          ))}
          <Link href="/intelligence/github-secrets" className="text-[9px] text-pink-400 hover:underline">View exposed secrets →</Link>
        </Section>
      )}

      {data.yaraRules?.length > 0 && (
        <Section label="YARA Rules" icon={Terminal} color="text-amber-500/60">
          {(data.yaraRules as Record<string, unknown>[]).map((y, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-500/10 bg-amber-500/3 px-3 py-1.5 text-xs">
              <span className="font-mono text-[10px] text-amber-300">{String(y.rule_name)}</span>
              <span className="text-[9px] text-zinc-500">{String(y.category || "")}</span>
              <span className={`text-[9px] ml-auto ${RISK_COLOR[String(y.severity)] || ""}`}>{String(y.severity).toUpperCase()}</span>
            </div>
          ))}
          <Link href="/intelligence/yara" className="text-[9px] text-amber-400 hover:underline">View YARA repository →</Link>
        </Section>
      )}

      {data.malware?.length > 0 && (
        <Section label="Malware Samples" icon={Bug} color="text-yellow-500/60">
          {data.malware.map((m, i) => <MalwareCard key={i} sample={m as any} compact />)}
        </Section>
      )}
    </div>
  )
}

// ---- Reusable section wrapper ----
function Section({ label, icon: Icon, color, children }: { label: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wide ${color} mb-1.5 flex items-center gap-1`}>
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

// ---- News Section ----
function NewsSection({ articles }: { articles: Record<string, unknown>[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-blue-500/60 mb-1.5 flex items-center gap-1">
        <Newspaper className="h-3 w-3" /> Related News
      </p>
      <div className="space-y-1.5">
        {articles.map((n, i) => (
          <a key={i} href={String(n.url)} target="_blank" rel="noopener noreferrer"
            className="flex items-start justify-between gap-2 rounded-lg border border-[#2c2535] bg-[#141018] px-3 py-2 hover:border-blue-500/20 transition-colors group">
            <p className="text-[11px] text-zinc-300 line-clamp-2 leading-snug flex-1">{String(n.title)}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {!!n.category && <span className={`text-[9px] px-1 py-0.5 rounded ${CATEGORY_COLOR[String(n.category)] || CATEGORY_COLOR.general}`}>{String(n.category)}</span>}
              <span className="text-[9px] text-zinc-600">{!!n.published_at ? timeAgo(String(n.published_at)) : ""}</span>
            </div>
          </a>
        ))}
        <Link href="/intelligence/news" className="text-[10px] text-blue-400 hover:underline">View all news →</Link>
      </div>
    </div>
  )
}
