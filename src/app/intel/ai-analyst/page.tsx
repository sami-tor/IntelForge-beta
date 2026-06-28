"use client"

import { useMemo, useState } from "react"
import { Loader2, Sparkles, ShieldAlert, RefreshCw, Search, Target, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"

function cleanList(items: any): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (item === null || item === undefined) return ""
      if (typeof item === "string") return item
      if (typeof item === "number" || typeof item === "boolean") return String(item)
      if (typeof item === "object") {
        const bits = Object.entries(item)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([key, value]) => `${key.replace(/_/g, " ")}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
        return bits.join("; ")
      }
      return String(item)
    })
    .filter(Boolean)
}

function ObjectList({ title, items }: { title: string; items?: any[] }) {
  const normalized = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return []
    return items.map((item, index) => {
      const row = item && typeof item === "object" ? item : { value: item }
      return {
        label: String((row.label ?? row.name ?? row.title ?? row.value ?? `Item ${index + 1}`) || `Item ${index + 1}`),
        detail: cleanList([row.evidence ?? row.detail ?? row.description ?? row.summary ?? row.sourceType ?? row.sourceId ?? ""]).join(" "),
        extra: Object.entries(row)
          .filter(([key, value]) => !["label", "name", "title", "value", "evidence", "detail", "description", "summary", "sourceType", "sourceId"].includes(key) && value !== null && value !== undefined && value !== "")
          .map(([key, value]) => `${key.replace(/_/g, " ")}: ${typeof value === "string" ? value : JSON.stringify(value)}`),
      }
    })
  }, [items])

  if (normalized.length === 0) return null

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-3">
        {normalized.map((item, index) => (
          <div key={index} className="rounded-lg border p-3 bg-muted/30">
            <div className="font-medium">{item.label}</div>
            {item.detail && <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.detail}</div>}
            {item.extra.length > 0 && <div className="text-xs text-muted-foreground mt-2 space-y-1">{item.extra.map((line, idx) => <div key={idx}>{line}</div>)}</div>}
          </div>
        ))}
      </div>
    </Card>
  )
}

function ListCard({ title, items }: { title: string; items?: any[] }) {
  const normalized = cleanList(items)
  if (normalized.length === 0) return null
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        {normalized.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </Card>
  )
}

export default function AIAnalystPage() {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<any | null>(null)
  const [sourceCoverage, setSourceCoverage] = useState<any[]>([])
  const [terms, setTerms] = useState<string[]>([])

  const runAnalysis = async () => {
    if (!question.trim()) {
      setError("Question is required")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", { credentials: "include" })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""

      const res = await fetch("/api/intel/ai-analyst", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ question, csrfToken }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data.details || data.error || "AI analyst failed")
      setAnswer(data.answer)
      setSourceCoverage(Array.isArray(data.evidence?.sourceCoverage) ? data.evidence.sourceCoverage : [])
      setTerms(Array.isArray(data.evidence?.terms) ? data.evidence.terms : [])
    } catch (err: any) {
      setError(err.message || "AI analyst failed")
    } finally {
      setLoading(false)
    }
  }

  const confidence = Number(answer?.confidenceScore ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="w-7 h-7 text-primary" /> AI Analyst Workspace</h1>
          <p className="text-muted-foreground mt-1">Ask CTI questions across sources, cases, alerts, reports, and run history</p>
        </div>
        <Button variant="outline" onClick={runAnalysis} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Analysis
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Question</label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What does current evidence say about active phishing against finance sector and related infrastructure?"
            className="min-h-28"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analyze Evidence
          </Button>
          <Button variant="outline" onClick={() => setQuestion("Summarize top current threats, linked campaigns, and source health gaps.")} className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Example prompt
          </Button>
        </div>
        {error && <p className="text-sm text-red-500 whitespace-pre-wrap">{error}</p>}
      </Card>

      {answer && (
        <div className="space-y-4">
          <Card className="p-4 border-purple-500/30 bg-purple-500/5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold">{answer.executiveSummary || "AI Analysis"}</h2>
                {answer.answer && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{answer.answer}</p>}
              </div>
              <div className="rounded-full border px-3 py-1 text-sm font-semibold">Confidence {confidence || 0}%</div>
            </div>
          </Card>

          <ListCard title="Key Findings" items={answer.keyFindings} />
          <ListCard title="Correlations" items={answer.correlations} />
          <ListCard title="Operational Impact" items={answer.operationalImpact} />
          <ListCard title="Recommended Actions" items={answer.recommendedActions} />
          <ListCard title="Investigation Pivots" items={answer.investigationPivots} />
          <ListCard title="Gaps and Limitations" items={answer.gapsAndLimitations} />
          <ListCard title="Source Health Notes" items={answer.sourceHealthNotes} />
          <ObjectList title="Affected Entities" items={answer.affectedEntities} />
          <ObjectList title="Indicators" items={answer.indicators} />
          <ObjectList title="Evidence Citations" items={answer.evidenceCitations} />
          <ObjectList title="Timeline" items={answer.timeline} />

          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Link2 className="w-4 h-4" /> Evidence Scope</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Terms: {terms.length ? terms.join(", ") : "None"}</div>
              <div>Source coverage rows: {sourceCoverage.length}</div>
            </div>
            {sourceCoverage.length > 0 && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {sourceCoverage.map((item, index) => (
                  <div key={index} className="rounded-lg border p-3 bg-muted/30 text-sm">
                    <div className="font-medium">{item.term}</div>
                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{JSON.stringify(item.counts)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
