"use client"

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, Network, Search, ShieldCheck, Users, CalendarClock, Eye, Skull, Target, Bug, Globe } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ThreatActorReport } from "@/lib/intel/types"

const RELATION_LABEL: Record<string, string> = {
  "uses-technique": "Uses technique",
  "linked-malware-family": "Linked malware family",
  "mentions-cve": "Related vulnerability",
  "linked-ioc": "Linked indicator",
  "intel-pulse": "Correlated intelligence pulse",
  "otx-pulse": "Correlated intelligence pulse",
}

function formatRelation(code: string): string {
  return RELATION_LABEL[code] || code.replace(/-/g, " ")
}

export default function ThreatActorReportPage() {
  const [queryText, setQueryText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ThreatActorReport | null>(null)

  const runReport = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? queryText).trim()
    if (q.length < 2) {
      setError("Please enter at least 2 characters to generate a report.")
      setReport(null)
      return
    }

    setLoading(true)
    setError(null)
    setReport(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(`/api/intel/actor-report?q=${encodeURIComponent(q)}`, {
        credentials: "include",
        signal: controller.signal,
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to generate report")
      }
      setReport(payload.data as ThreatActorReport)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Report generation timed out. Please try again.")
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate report")
      }
      setReport(null)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [queryText])

  const topRelationships = useMemo(
    () => (report?.relationships || []).slice(0, 25),
    [report],
  )

  // Read optional ?q=... from URL and auto-run
  useEffect(() => {
    if (typeof window === "undefined") return
    const urlQ = new URLSearchParams(window.location.search).get("q")?.trim()
    if (urlQ && urlQ.length >= 2) {
      setQueryText(urlQ)
      void runReport(urlQ)
    }
  }, [runReport])

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Deep Threat Actor Correlation Report</h1>
          <p className="text-xs text-muted-foreground">
            Correlated actor intelligence with linked entities and confidence scoring
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void runReport()
            }
          }}
          placeholder="Search actor (e.g., Anonymous, Lazarus, APT28)"
          className="h-9"
        />
        <Button
          type="button"
          disabled={loading || queryText.trim().length < 2}
          onClick={() => {
            void runReport()
          }}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Generate Report
        </Button>
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Generating report for &ldquo;{queryText.trim()}&rdquo;...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            <Stat title="Actors" value={String(report.actorMatches.length)} />
            <Stat title="Relationships" value={String(report.relationships.length)} />
            <Stat title="Linked CVEs" value={String(report.relatedCves.length)} />
            <Stat title="Linked IOCs" value={String(report.relatedIocs.length)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Card title="Actor Matches" icon={<Users className="h-4 w-4 text-green-400" />}>
              {report.actorMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground">No catalogued threat actor match for this query.</p>
              ) : (
                <div className="space-y-1.5">
                  {report.actorMatches.map((actor) => (
                    <div key={actor.stixId} className="text-xs border border-border rounded px-2 py-1.5">
                      <p className="font-medium">{actor.name}</p>
                      <p className="text-muted-foreground">
                        {(actor.aliases || []).slice(0, 4).join(", ") || "No aliases"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Confidence Summary" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
              <div className="text-xs space-y-2">
                <p>High confidence links: <strong>{report.confidenceSummary.high}</strong></p>
                <p>Medium confidence links: <strong>{report.confidenceSummary.medium}</strong></p>
                <p>Low confidence links: <strong>{report.confidenceSummary.low}</strong></p>
                <p className="text-muted-foreground">
                  Generated at {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
            </Card>
          </div>

          <Card title="Top Correlations" icon={<Network className="h-4 w-4 text-yellow-400" />}>
            <div className="space-y-1.5">
              {topRelationships.map((item) => (
                <div key={item.id} className="text-xs border border-border rounded px-2 py-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="text-muted-foreground">{item.source}</span>
                      {" -> "}
                      <span>{item.target}</span>
                    </p>
                    <p className="text-muted-foreground">{formatRelation(item.relation)}</p>
                  </div>
                  <span className="shrink-0 px-1.5 py-0.5 rounded border border-primary/30 text-primary">
                    {item.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Unified Profile Data */}
      {report && (report as any).unified && (
        <div className="space-y-3 border-t border-border pt-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-purple-400" /> Unified Threat Actor Profile
          </h2>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* MITRE Profile */}
            {(report as any).unified.mitreProfile && (
              <Card title="MITRE ATT&CK Profile" icon={<Target className="h-4 w-4 text-blue-400" />}>
                <div className="text-xs space-y-1">
                  <p className="font-medium text-foreground">{(report as any).unified.mitreProfile.name}</p>
                  {((report as any).unified.mitreProfile.techniques as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {((report as any).unified.mitreProfile.techniques as string[]).slice(0, 10).map((t: string) => (
                        <Link key={t} href={`/intelligence/attack-patterns?q=${t}`}
                          className="text-[9px] rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-400 font-mono hover:bg-blue-500/20">{t}</Link>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* APT Campaigns */}
            {(report as any).unified.aptCampaigns?.length > 0 && (
              <Card title="APT Campaigns" icon={<CalendarClock className="h-4 w-4 text-purple-400" />}>
                <div className="space-y-1.5">
                  {((report as any).unified.aptCampaigns as any[]).map((c: any) => (
                    <Link key={c.campaign_id} href="/intelligence/apt-campaigns"
                      className="block text-xs border border-border rounded px-2 py-1.5 hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.campaign_name}</span>
                        {c.is_active && <span className="text-[9px] text-green-400">Active</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(c.cves as string[])?.slice(0, 5).map((cve: string) => (
                          <span key={cve} className="text-[8px] rounded px-1 py-0.5 bg-red-500/10 text-red-400">{cve}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Darknet Posts */}
            {(report as any).unified.darknetPosts?.length > 0 && (
              <Card title="Dark Web Activity" icon={<Eye className="h-4 w-4 text-red-400" />}>
                <div className="space-y-1.5">
                  {((report as any).unified.darknetPosts as any[]).slice(0, 5).map((p: any) => (
                    <Link key={p.post_uid} href="/intelligence/darknet"
                      className="block text-xs border border-border rounded px-2 py-1.5 hover:border-red-500/30 transition-colors">
                      <p className="truncate">{p.title || p.threat_actor}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px] text-muted-foreground">
                        {p.victim_name && <span>Victim: {p.victim_name}</span>}
                        {p.severity && <span className="text-red-400">{p.severity}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Ransomware Groups */}
            {(report as any).unified.ransomwareGroups?.length > 0 && (
              <Card title="Ransomware Affiliation" icon={<Skull className="h-4 w-4 text-orange-400" />}>
                <div className="space-y-1.5">
                  {((report as any).unified.ransomwareGroups as any[]).map((g: any) => (
                    <Link key={g.slug} href="/intelligence/ransomware"
                      className="block text-xs border border-border rounded px-2 py-1.5 hover:border-orange-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{g.name}</span>
                        {g.active ? <span className="text-[9px] text-green-400">Active</span> : <span className="text-[9px] text-muted-foreground">Inactive</span>}
                      </div>
                      <p className="text-muted-foreground mt-0.5">{g.victim_count} victims</p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
