"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Power, PowerOff, RefreshCw, Clock, AlertCircle, Webhook as WebhookIcon } from "lucide-react"
import { WEBHOOK_EVENTS } from "@/lib/integrations/event-types"

interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  is_active: boolean
  last_triggered?: string
  failure_count: number
  created_at: string
}

interface WebhookLog {
  id: number
  event: string
  response_code?: number
  duration_ms?: number
  error?: string
  created_at: string
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [events, setEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState("")

  useEffect(() => { fetchWebhooks() }, [])

  const fetchWebhooks = async () => {
    try {
      const res = await fetch("/api/integrations/webhooks", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const fetchLogs = async (webhookId: number) => {
    try {
      const res = await fetch(`/api/integrations/webhooks/${webhookId}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch { /* silent */ }
  }

  const handleCreate = async () => {
    if (!name || !url || events.length === 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, url, events, secret: secret || undefined }),
      })
      if (res.ok) {
        setShowCreate(false)
        setName("")
        setUrl("")
        setSecret("")
        setEvents([])
        fetchWebhooks()
      }
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this webhook?")) return
    try {
      await fetch(`/api/integrations/webhooks/${id}`, { method: "DELETE", credentials: "include" })
      setSelectedWebhook(null)
      fetchWebhooks()
    } catch { /* silent */ }
  }

  const handleToggle = async (webhook: Webhook) => {
    try {
      await fetch(`/api/integrations/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !webhook.is_active }),
      })
      fetchWebhooks()
    } catch { /* silent */ }
  }

  const handleTest = async (webhookId: number) => {
    setTesting(true)
    setTestResult("")
    try {
      const res = await fetch(`/api/integrations/webhooks/${webhookId}`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      setTestResult(data.success ? "Test event dispatched successfully" : "Test failed")
      if (selectedWebhook) fetchLogs(selectedWebhook.id)
    } catch {
      setTestResult("Test failed — network error")
    }
    setTesting(false)
  }

  const toggleEvent = (event: string) => {
    setEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading webhooks...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Webhooks</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Create Webhook
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold">Create Webhook</h3>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="My Webhook" autoFocus
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Secret (optional)</label>
              <input
                type="text" value={secret} onChange={e => setSecret(e.target.value)}
                placeholder="HMAC signing secret"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Events</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {WEBHOOK_EVENTS.map(event => (
                  <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !name || !url || events.length === 0}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook List */}
      {webhooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <WebhookIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No webhooks configured yet.</p>
          <p className="text-sm text-muted-foreground">Create one to receive real-time event notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div
              key={wh.id}
              className={`rounded-2xl border p-5 transition cursor-pointer ${
                selectedWebhook?.id === wh.id ? "border-primary bg-accent/50" : "border-border bg-card hover:border-primary/30"
              }`}
              onClick={() => { setSelectedWebhook(wh); fetchLogs(wh.id) }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${wh.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                  <div>
                    <h3 className="font-semibold">{wh.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{wh.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wh.failure_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" /> {wh.failure_count}
                    </span>
                  )}
                  {wh.last_triggered && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {new Date(wh.last_triggered).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {wh.events.map(e => (
                  <span key={e} className="rounded-full bg-muted px-2 py-0.5 text-xs">{e}</span>
                ))}
              </div>

              {/* Detail panel */}
              {selectedWebhook?.id === wh.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-3" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggle(wh)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        wh.is_active ? "bg-red-500/10 text-red-600 hover:bg-red-500/20" : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                      }`}>
                      {wh.is_active ? <><PowerOff className="h-3.5 w-3.5" /> Disable</> : <><Power className="h-3.5 w-3.5" /> Enable</>}
                    </button>
                    <button onClick={() => handleTest(wh.id)} disabled={testing}
                      className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent">
                      <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} /> Test
                    </button>
                    <button onClick={() => handleDelete(wh.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                  {testResult && <p className="text-xs text-muted-foreground">{testResult}</p>}

                  {/* Logs */}
                  {logs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Logs</p>
                      {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                          <span>{log.event}</span>
                          <span className={log.error ? "text-red-500" : log.response_code && log.response_code >= 400 ? "text-amber-500" : "text-green-500"}>
                            {log.error ? "Error" : log.response_code || "—"} • {log.duration_ms}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
