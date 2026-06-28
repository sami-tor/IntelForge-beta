"use client"

import { useState } from "react"
import {
  Search, Loader2, ShieldAlert, Skull, Users, Globe, Bug, Zap, Eye,
  FileText, AlertTriangle, Database, Key, Terminal, Package, Fish,
  GitBranch, Activity, Server, Layers, Calendar, Lock,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const SEV_COLOR: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

function Section({ icon: Icon, title, count, color, children }: any) {
  if (count === 0) return null
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-primary"}`} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{count} result{count > 1 ? "s" : ""}</span>
      </div>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">{children}</div>
    </div>
  )
}

function Row({ children, severity }: { children: React.ReactNode; severity?: string }) {
  return (
    <div className="text-xs border-l-2 border-primary/40 pl-3 py-1.5 hover:bg-muted/20 rounded-r overflow-hidden">
      {severity && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase mr-2 inline-block mb-1 ${SEV_COLOR[severity] || SEV_COLOR.medium}`}>
          {severity}
        </span>
      )}
      <div className="break-words">{children}</div>
    </div>
  )
}

export default function DeepSearchPage() {
  const [q, setQ] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (q.trim().length < 2) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/intel/deep-search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Search failed")
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">Intel Deep Search</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          One search — every intelligence source. Breach data, CVEs, actors, dark-web, exploits, stealer logs, correlations, and more.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search any entity: domain, email, actor, CVE, keyword..."
            className="w-full rounded-lg border border-border bg-background pl-11 pr-4 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Button onClick={search} disabled={loading || q.trim().length < 2} size="lg" className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
        </Button>
        {data && (
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const a = document.createElement("a")
            a.href = URL.createObjectURL(blob)
            a.download = `intelforge-deep-search-${q.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(a.href)
          }}>
            Export
          </Button>
        )}
      </div>

      {error && (
        <Card className="p-4 border-destructive">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {data && (
        <>
          {/* Summary banner */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{data.summary.riskScore}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Risk Score</p>
              </div>
              <div>
                <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full border font-semibold uppercase ${SEV_COLOR[data.summary.severity] || SEV_COLOR.medium}`}>
                  {data.summary.severity}
                </span>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{data.summary.totalSources}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sources matched</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{data.summary.breachRecords.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Breach records</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{data.summary.totalHits}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total intel hits</p>
              </div>
            </div>
          </div>

          {/* Grid of all sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Correlation Clusters */}
            <Section icon={GitBranch} title="Correlation Clusters" count={data.clusters?.length} color="text-primary">
              {data.clusters?.map((c: any, i: number) => (
                <Row key={i} severity={c.severity}>
                  <span className="font-semibold">{c.title}</span>
                  <span className="text-muted-foreground ml-2">score {c.risk_score} · {c.signal_count} signals · conf {c.confidence}%</span>
                  <p className="text-muted-foreground mt-0.5 line-clamp-1">{c.summary}</p>
                  {c.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {c.tags.map((t: string) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-muted">{t}</span>)}
                    </div>
                  )}
                </Row>
              ))}
            </Section>

            {/* CVEs */}
            <Section icon={ShieldAlert} title="CVE Vulnerabilities" count={data.cves?.length} color="text-orange-400">
              {data.cves?.map((c: any, i: number) => (
                <Row key={i} severity={c.cvss_v3_severity?.toLowerCase()}>
                  <span className="font-mono font-semibold">{c.cve_id}</span>
                  <span className="ml-2">CVSS {c.cvss_v3_score} {c.is_kev ? "· KEV ⚠️" : ""}</span>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                  {c.vendor && <p className="text-muted-foreground">Vendor: {c.vendor} · Product: {c.product}</p>}
                </Row>
              ))}
            </Section>

            {/* Threat Actors */}
            <Section icon={Users} title="Threat Actors" count={data.actors?.length} color="text-green-400">
              {data.actors?.map((a: any, i: number) => (
                <Row key={i}>
                  <span className="font-semibold">{a.name}</span>
                  {a.aliases?.length > 0 && <span className="text-muted-foreground ml-2">aka {a.aliases.slice(0, 3).join(", ")}</span>}
                  <p className="text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                  {a.sectors?.length > 0 && <p className="text-muted-foreground">Sectors: {a.sectors.join(", ")}</p>}
                </Row>
              ))}
            </Section>

            {/* Actor-CVE Links */}
            <Section icon={Zap} title="Actor → CVE Links" count={data.actorCveLinks?.length} color="text-red-400">
              {data.actorCveLinks?.map((l: any, i: number) => (
                <Row key={i}>
                  <span className="font-semibold">{l.actor_name}</span>
                  <span className="text-muted-foreground"> {l.relationship} </span>
                  <span className="font-mono">{l.cve_id}</span>
                  <span className="text-muted-foreground ml-2">conf {l.confidence}%</span>
                </Row>
              ))}
            </Section>

            {/* Ransomware */}
            <Section icon={Skull} title="Ransomware Victims" count={data.ransomwareVictims?.length} color="text-red-400">
              {data.ransomwareVictims?.map((v: any, i: number) => (
                <Row key={i} severity="high">
                  <span className="font-semibold">{v.victim_name}</span>
                  <span className="text-muted-foreground ml-2">by {v.group_name} · {v.sector} · {v.country}</span>
                  {v.description && <p className="text-muted-foreground mt-0.5 line-clamp-1">{v.description}</p>}
                </Row>
              ))}
            </Section>

            {/* Actor-Breach Links */}
            <Section icon={AlertTriangle} title="Actor → Breach Links" count={data.actorBreachLinks?.length} color="text-red-400">
              {data.actorBreachLinks?.map((b: any, i: number) => (
                <Row key={i} severity={b.severity}>
                  <span className="font-semibold">{b.actor_name} → {b.victim_name}</span>
                  <span className="text-muted-foreground ml-2">{b.breach_type} · {b.record_count?.toLocaleString()} records · {b.country}</span>
                </Row>
              ))}
            </Section>

            {/* Dark Web */}
            <Section icon={Eye} title="Dark Web Posts" count={data.darknet?.length} color="text-purple-400">
              {data.darknet?.map((d: any, i: number) => (
                <Row key={i} severity={d.severity}>
                  <span className="font-semibold">{d.title || d.victim_name}</span>
                  <span className="text-muted-foreground ml-2">by {d.threat_actor} · {d.leak_type}</span>
                  {d.content && <p className="text-muted-foreground mt-0.5 line-clamp-2">{d.content}</p>}
                </Row>
              ))}
            </Section>

            {/* News */}
            <Section icon={FileText} title="News Articles" count={data.news?.length} color="text-blue-400">
              {data.news?.map((n: any, i: number) => (
                <Row key={i}>
                  <span className="font-semibold">{n.title}</span>
                  <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded ${SEV_COLOR[n.category] || "bg-muted"}`}>{n.category}</span>
                  {n.description && <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>}
                </Row>
              ))}
            </Section>

            {/* Exploits */}
            <Section icon={Zap} title="Public Exploits" count={data.exploits?.length} color="text-red-400">
              {data.exploits?.map((e: any, i: number) => (
                <Row key={i} severity="high">
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-muted-foreground ml-2">{e.cve_id} · {e.exploit_type} · {e.platform}</span>
                  {e.verified && <span className="text-green-400 ml-2">✓ verified</span>}
                </Row>
              ))}
            </Section>

            {/* Stealer Logs */}
            <Section icon={Lock} title="Stealer Logs" count={data.stealerLogs?.length} color="text-yellow-400">
              {data.stealerLogs?.map((s: any, i: number) => (
                <Row key={i} severity="high">
                  <span className="font-mono text-[11px]">{s.captured_url}</span>
                  <p className="text-muted-foreground">{s.login_user} · {s.password_redacted} · {s.stealer_family} · {s.country}</p>
                </Row>
              ))}
            </Section>

            {/* Compromised Hosts */}
            <Section icon={Server} title="Compromised Hosts" count={data.hosts?.length} color="text-orange-400">
              {data.hosts?.map((h: any, i: number) => (
                <Row key={i} severity={h.severity}>
                  <span className="font-semibold">{h.hostname}</span>
                  <span className="text-muted-foreground ml-2">{h.os} · {h.stealer_family} · {h.country}</span>
                  <p className="text-muted-foreground">Creds: {h.credential_count} · Cookies: {h.cookie_count} · Domains: {h.matched_domains?.join(", ")}</p>
                </Row>
              ))}
            </Section>

            {/* Paste Posts */}
            <Section icon={FileText} title="Paste / Leak Posts" count={data.pastes?.length} color="text-purple-400">
              {data.pastes?.map((p: any, i: number) => (
                <Row key={i} severity={p.severity}>
                  <span className="font-semibold">{p.title}</span>
                  {p.threat_actor && <span className="text-muted-foreground ml-2">by {p.threat_actor}</span>}
                  {p.excerpt && <p className="text-muted-foreground mt-0.5 line-clamp-2">{p.excerpt}</p>}
                </Row>
              ))}
            </Section>

            {/* Combolists */}
            <Section icon={Database} title="Combolist Drops" count={data.combolists?.length} color="text-pink-400">
              {data.combolists?.map((c: any, i: number) => (
                <Row key={i} severity={c.severity}>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground ml-2">{c.line_count?.toLocaleString()} lines · {c.source}</span>
                  {c.threat_actor && <span className="text-muted-foreground"> · by {c.threat_actor}</span>}
                </Row>
              ))}
            </Section>

            {/* Phishing */}
            <Section icon={Fish} title="Phishing URLs" count={data.phishing?.length} color="text-red-400">
              {data.phishing?.map((p: any, i: number) => (
                <Row key={i} severity={p.active ? "high" : "low"}>
                  <span className="font-mono text-[11px]">{p.url}</span>
                  <span className="text-muted-foreground ml-2">brand: {p.target_brand} · {p.phish_type}</span>
                </Row>
              ))}
            </Section>

            {/* Malware */}
            <Section icon={Bug} title="Malware Samples" count={data.malware?.length} color="text-yellow-400">
              {data.malware?.map((m: any, i: number) => (
                <Row key={i} severity="high">
                  <span className="font-semibold">{m.file_name}</span>
                  <span className="text-muted-foreground ml-2">{m.malware_family?.join(", ")} · {m.source}</span>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{m.sha256?.slice(0, 32)}...</p>
                </Row>
              ))}
            </Section>

            {/* Sigma Rules */}
            <Section icon={Terminal} title="Sigma Detection Rules" count={data.sigma?.length} color="text-amber-400">
              {data.sigma?.map((s: any, i: number) => (
                <Row key={i} severity={s.level}>
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-muted-foreground ml-2">{s.logsource_product} · {s.technique_id?.join(", ")}</span>
                </Row>
              ))}
            </Section>

            {/* GitHub Secrets */}
            <Section icon={Key} title="GitHub Secret Exposures" count={data.github?.length} color="text-green-400">
              {data.github?.map((g: any, i: number) => (
                <Row key={i} severity={g.risk_level}>
                  <span className="font-mono text-[11px]">{g.repo_name}/{g.file_path}</span>
                  <span className="text-muted-foreground ml-2">{g.secret_type} · {g.still_exposed ? "⚠️ still exposed" : "fixed"}</span>
                </Row>
              ))}
            </Section>

            {/* Intel Entities */}
            <Section icon={Activity} title="Intel Entities" count={data.entities?.length} color="text-cyan-400">
              {data.entities?.map((e: any, i: number) => (
                <Row key={i}>
                  <span className="font-semibold">{e.value}</span>
                  <span className="text-muted-foreground ml-2">{e.entity_type} · risk {e.risk_score} · conf {e.confidence}%</span>
                  {e.tags?.length > 0 && <div className="flex gap-1 mt-1">{e.tags.map((t: string) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-muted">{t}</span>)}</div>}
                </Row>
              ))}
            </Section>

            {/* Intel Findings */}
            <Section icon={AlertTriangle} title="Intel Findings" count={data.findings?.length} color="text-red-400">
              {data.findings?.map((f: any, i: number) => (
                <Row key={i} severity={f.severity}>
                  <span className="font-semibold">{f.title}</span>
                  <span className="text-muted-foreground ml-2">risk {f.risk_score} · conf {f.confidence}%</span>
                  {f.description && <p className="text-muted-foreground mt-0.5 line-clamp-2">{f.description}</p>}
                </Row>
              ))}
            </Section>

            {/* Breach Records (Quickwit) */}
            <Section icon={Database} title={`Breach Records (${data.breach?.total?.toLocaleString()} total)`} count={data.breach?.hits?.length} color="text-red-400">
              {data.breach?.hits?.map((h: any, i: number) => (
                <Row key={i} severity="high">
                  <span className="font-mono text-[11px]">{h.url || h.file_name}</span>
                  <p className="text-muted-foreground">{h.username} · {h.password} · [{h.source}]</p>
                </Row>
              ))}
            </Section>

          </div>
        </>
      )}

      {!data && !loading && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold">Search any entity</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try: <button onClick={() => { setQ("acmecorp"); }} className="text-primary hover:underline">acmecorp</button>
            {" · "}
            <button onClick={() => { setQ("LockBit"); }} className="text-primary hover:underline">LockBit</button>
            {" · "}
            <button onClick={() => { setQ("CVE-2026-99001"); }} className="text-primary hover:underline">CVE-2026-99001</button>
            {" · "}
            <button onClick={() => { setQ("eurobank"); }} className="text-primary hover:underline">eurobank</button>
          </p>
        </Card>
      )}
    </div>
  )
}
