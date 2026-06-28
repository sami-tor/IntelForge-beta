"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Database, Plus, Shield, Clock3, CheckCircle, XCircle, RefreshCw, Trash2 } from "lucide-react"

interface IntelSource {
  id: number
  source_key: string
  source_name: string
  source_type: string
  endpoint: string | null
  enabled: boolean
  trust_score: number
  rate_limit_minutes: number
  collection_policy: string | null
  tenant_scope: string
  last_success_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

interface ScraperRun {
  id: number
  source_key: string
  status: string
  started_at: string
  finished_at: string | null
  fetched_count: number
  stored_count: number
  error_message: string | null
  duration_ms: number
  metadata: Record<string, any>
}

export default function IntelSourcesPage() {
  const [sources, setSources] = useState<IntelSource[]>([])
  const [runs, setRuns] = useState<ScraperRun[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sourceKey: "",
    sourceName: "",
    sourceType: "api",
    endpoint: "",
    trustScore: 70,
    rateLimitMinutes: 60,
    collectionPolicy: "",
    tenantScope: "global",
    enabled: true,
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const response = await fetch("/api/admin/intel-sources", { credentials: "include" })
      const data = await response.json()
      setSources(data.sources || [])
      setRuns(data.runs || [])
    } catch (error) {
      console.error("Failed to load intel sources:", error)
      setSources([])
      setRuns([])
    } finally {
      setLoading(false)
    }
  }

  const saveSource = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/intel-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      })
      if (response.ok) {
        setForm({
          sourceKey: "",
          sourceName: "",
          sourceType: "api",
          endpoint: "",
          trustScore: 70,
          rateLimitMinutes: 60,
          collectionPolicy: "",
          tenantScope: "global",
          enabled: true,
        })
        await fetchAll()
      }
    } catch (error) {
      console.error("Failed to save intel source:", error)
    } finally {
      setSaving(false)
    }
  }

  const toggleSource = async (id: number, enabled: boolean) => {
    await fetch("/api/admin/intel-sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, enabled: !enabled }),
    })
    await fetchAll()
  }

  const deleteSource = async (id: number) => {
    if (!confirm("Delete source?")) return
    await fetch(`/api/admin/intel-sources?id=${id}`, { method: "DELETE", credentials: "include" })
    await fetchAll()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Intel Source Registry</h1>
          <p className="text-muted-foreground mt-1">Unified registry and run history for collection sources</p>
        </div>
        <Button variant="outline" onClick={fetchAll} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> Add Source</h2>
          <div className="space-y-3">
            <input className="w-full h-10 px-3 rounded-md border bg-background" placeholder="source key" value={form.sourceKey} onChange={(e) => setForm({ ...form, sourceKey: e.target.value })} />
            <input className="w-full h-10 px-3 rounded-md border bg-background" placeholder="source name" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} />
            <input className="w-full h-10 px-3 rounded-md border bg-background" placeholder="endpoint" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
            <textarea className="w-full min-h-24 px-3 py-2 rounded-md border bg-background" placeholder="collection policy" value={form.collectionPolicy} onChange={(e) => setForm({ ...form, collectionPolicy: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full h-10 px-3 rounded-md border bg-background" type="number" value={form.trustScore} onChange={(e) => setForm({ ...form, trustScore: Number(e.target.value) })} />
              <input className="w-full h-10 px-3 rounded-md border bg-background" type="number" value={form.rateLimitMinutes} onChange={(e) => setForm({ ...form, rateLimitMinutes: Number(e.target.value) })} />
            </div>
            <Button onClick={saveSource} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Save Source
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock3 className="w-5 h-5" /> Recent Runs</h2>
          <div className="space-y-3 max-h-[440px] overflow-auto">
            {runs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No runs yet</div>
            ) : runs.map((run) => (
              <div key={run.id} className="rounded-md border p-3 bg-background/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{run.source_key}</div>
                  <span className="text-xs px-2 py-1 rounded-full border">{run.status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  fetched {run.fetched_count} · stored {run.stored_count} · {run.duration_ms}ms
                </div>
                {run.error_message && <div className="text-xs text-red-500 mt-1">{run.error_message}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {sources.map((source) => (
          <div key={source.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <Shield className="w-5 h-5 text-primary" />
                  <div className="font-semibold">{source.source_name}</div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{source.source_type}</span>
                  {source.enabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="text-sm text-muted-foreground break-all">{source.endpoint || "No endpoint"}</div>
                <div className="text-xs text-muted-foreground">Trust {source.trust_score}/100 · Cadence {source.rate_limit_minutes}m · Scope {source.tenant_scope}</div>
                {source.collection_policy && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{source.collection_policy}</div>}
                {source.last_error && <div className="text-xs text-red-500 whitespace-pre-wrap">{source.last_error}</div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={source.enabled ? "outline" : "default"} onClick={() => toggleSource(source.id, source.enabled)}>
                  {source.enabled ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteSource(source.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
