"use client"

import { useState } from "react"
import { Sparkles, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export type AIAnalysisPayload = {
  query: string
  mode: string
  results: any[]
  selectedResult?: any
  filters?: Record<string, unknown>
}

function cleanText(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join("; ")
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${cleanText(v)}`)
      .join("; ")
  }
  return String(value)
}

function parseMaybeJson(value: any): any {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function normalizeTextItems(items: any): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map(parseMaybeJson)
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map(cleanText)
    .filter(Boolean)
}

function ListSection({ title, items }: { title: string; items?: any[] }) {
  const normalized = normalizeTextItems(items)
  if (normalized.length === 0) return null
  return (
    <section className="rounded-lg border border-[#2c2535] bg-[#141018] p-4">
      <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
      <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
        {normalized.map((item, idx) => <li key={idx}>{item}</li>)}
      </ul>
    </section>
  )
}

function ObjectSection({ title, items }: { title: string; items?: any[] }) {
  if (!Array.isArray(items) || items.length === 0) return null

  const normalizedItems = items
    .map(parseMaybeJson)
    .map((item) => item && typeof item === "object" ? item : { value: item })
    .filter(Boolean)

  if (normalizedItems.length === 0) return null

  return (
    <section className="rounded-lg border border-[#2c2535] bg-[#141018] p-4">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">{title}</h3>
      <div className="space-y-2">
        {normalizedItems.map((item, idx) => {
          const label = cleanText(parseMaybeJson(item.label ?? item.name ?? item.title ?? item.value ?? item.type ?? `Item ${idx + 1}`))
          const type = cleanText(parseMaybeJson(item.type ?? item.category ?? ""))
          const value = cleanText(parseMaybeJson(item.value ?? item.indicator ?? item.ioc ?? ""))
          const detail = cleanText(parseMaybeJson(item.detail ?? item.evidence ?? item.description ?? item.summary ?? ""))
          const confidence = item.confidence ?? item.confidenceScore
          const knownKeys = new Set(["label", "name", "title", "value", "type", "category", "indicator", "ioc", "detail", "evidence", "description", "summary", "confidence", "confidenceScore"])
          const extra = Object.entries(item)
            .filter(([key, value]) => !knownKeys.has(key) && value !== null && value !== undefined && value !== "")
            .map(([key, value]) => `${key.replace(/_/g, " ")}: ${cleanText(parseMaybeJson(value))}`)
            .filter(Boolean)

          return (
            <div key={idx} className="rounded-md border border-[#2c2535] bg-[#0f0c12] p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-zinc-100">{label}</span>
                {confidence !== undefined && confidence !== null && confidence !== "" && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/25">
                    {cleanText(parseMaybeJson(confidence))}%
                  </span>
                )}
              </div>
              {(type || value) && (
                <p className="text-xs text-zinc-400">
                  {type && <><span className="text-zinc-500">Type:</span> {type} </>}
                  {value && <><span className="text-zinc-500">Value:</span> {value}</>}
                </p>
              )}
              {detail && <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap">{detail}</p>}
              {extra.length > 0 && (
                <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-zinc-500">
                  {extra.map((entry, extraIdx) => <li key={extraIdx}>{entry}</li>)}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function AIAnalysisPanel({
  open,
  onClose,
  payload,
}: {
  open: boolean
  onClose: () => void
  payload: AIAnalysisPayload | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any | null>(null)

  if (!open) return null

  const runAnalysis = async () => {
    if (!payload) return
    setLoading(true)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", { credentials: "include" })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""

      const res = await fetch("/api/search/ai-analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ...payload, csrfToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || "AI analysis failed")
      setAnalysis(data.analysis)
    } catch (e: any) {
      setError(e.message || "AI analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const confidence = Number(analysis?.confidenceScore ?? 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
      <div className="w-full max-w-2xl h-full bg-[#0f0c12] border-l border-[#2c2535] flex flex-col">
        <div className="p-4 border-b border-[#2c2535] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Advanced AI Analysis</h2>
              <p className="text-xs text-zinc-500">Entities, indicators, risk, pivots, and follow-up queries</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 border-b border-[#2c2535] space-y-3">
          <p className="text-sm text-zinc-300">
            Query: <span className="text-zinc-100 font-medium">{payload?.query}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={runAnalysis} disabled={loading || !payload} className="bg-[var(--primary)] hover:brightness-110">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {analysis ? "Re-run Advanced Analysis" : "Run Advanced Analysis"}
            </Button>
            <span className="text-xs text-zinc-500">Context: {payload?.results?.length || 0} results</span>
          </div>
          {error && <p className="text-sm text-red-400 whitespace-pre-wrap">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!analysis && !loading && !error && (
            <div className="rounded-lg border border-dashed border-[#2c2535] p-6 text-sm text-zinc-500">
              Click <span className="text-zinc-200">Run Advanced Analysis</span> to extract entities, indicators, pivots, and investigation steps.
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-[#2c2535] bg-[#141018] p-6 text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
              Analyzing evidence and generating advanced report...
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <section className="rounded-lg border border-[#2c2535] bg-[#141018] p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{analysis.shortTitle || "Executive Summary"}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/25">
                    Confidence {confidence || 0}%
                  </span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{analysis.executiveSummary || analysis.summary}</p>
              </section>

              {analysis.likelyJudgement && (
                <section className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4">
                  <h3 className="text-sm font-semibold text-[var(--primary)] mb-2">Likely Judgement</h3>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{analysis.likelyJudgement}</p>
                </section>
              )}

              <ListSection title="Evidence Summary by Source" items={analysis.evidenceSummary} />
              <ListSection title="Cross-source Correlations" items={analysis.crossSourceCorrelations} />
              <ListSection title="Source Coverage" items={analysis.sourceCoverage} />
              <ListSection title="Key Findings" items={analysis.keyFindings} />
              <ListSection title="Why It Matters" items={analysis.whyItMatters} />
              <ObjectSection title="Entities" items={analysis.entities} />
              <ObjectSection title="Indicators" items={analysis.indicators} />
              <ListSection title="Patterns" items={analysis.patterns} />
              <ListSection title="Risks" items={analysis.risks} />
              <ListSection title="Contradictions / Gaps" items={analysis.contradictionsOrGaps} />
              <ListSection title="Recommended Next Steps" items={analysis.suggestedNextSteps} />
              <ListSection title="Best Follow-up Queries" items={analysis.bestFollowUpQueries} />
              <ListSection title="Investigation Pivots" items={analysis.pivots} />
              <ObjectSection title="Timeline / Sequence" items={analysis.timeline} />
              <ListSection title="Confidence Drivers" items={analysis.confidenceDrivers} />

              {analysis.confidenceNotes && (
                <section className="rounded-lg border border-[#2c2535] bg-[#141018] p-4">
                  <h3 className="text-sm font-semibold text-zinc-100 mb-2">Confidence Notes</h3>
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap">{analysis.confidenceNotes}</p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
