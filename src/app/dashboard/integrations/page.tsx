"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import {
  Shield, Server, MessageSquare, MessageCircle, Webhook, BarChart3,
  Layers, Zap, Brain, GitGraph, ArrowLeft, CheckCircle2, XCircle,
  Settings, RefreshCw, TestTube, Save, Trash2,
} from "lucide-react"
import DashboardNavbar from "@/components/dashboard-navbar"
import { IntegrationCard } from "@/components/integrations/integration-card"
import { WebhookManager } from "@/components/integrations/webhook-manager"
import Link from "next/link"

const CONFIG_COMPONENTS: Record<string, string> = {
  misp: "MISP Configuration",
  siem: "SIEM Configuration",
  slack: "Slack Configuration",
  teams: "Teams Configuration",
  splunk: "Splunk Configuration",
  elastic: "Elastic Configuration",
  webhooks: "Webhooks",
}

export default function IntegrationsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [integrations, setIntegrations] = useState<any[]>([])
  const [activeConfig, setActiveConfig] = useState<string | null>(null)
  const [configData, setConfigData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState("")
  const [previewData, setPreviewData] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return }
    if (user) fetchIntegrations()
  }, [user, loading])

  const fetchIntegrations = async () => {
    try {
      const [marketRes, configsRes] = await Promise.all([
        fetch("/api/integrations/marketplace"),
        fetch("/api/integrations/notifications", { credentials: "include" }),
      ])

      const market = marketRes.ok ? await marketRes.json() : { integrations: [] }
      const configs = configsRes.ok ? await configsRes.json() : { configs: {} }

      // Merge configured status
      const configuredIds = new Set(Object.keys(configs.configs || {}))
      // Also check MISP, SIEM, webhooks
      try {
        const [mispRes, siemRes, whRes] = await Promise.all([
          fetch("/api/integrations/misp", { credentials: "include" }),
          fetch("/api/integrations/siem", { credentials: "include" }),
          fetch("/api/integrations/webhooks", { credentials: "include" }),
        ])
        if (mispRes.ok) { const d = await mispRes.json(); if (d.config) configuredIds.add("misp") }
        if (siemRes.ok) { const d = await siemRes.json(); if (d.config) configuredIds.add("siem") }
        if (whRes.ok) { const d = await whRes.json(); if (d.webhooks?.length) configuredIds.add("webhooks") }
      } catch { /* silent */ }

      const merged = market.integrations.map((i: any) => ({
        ...i,
        configured: configuredIds.has(i.id) || configuredIds.has(i.id.replace("_", "-")),
      }))

      setIntegrations(merged)
    } catch { /* silent */ }
  }

  const handleConfigure = async (id: string) => {
    setActiveConfig(id)
    setTestMessage("")
    setPreviewData(null)

    // Load existing config
    try {
      if (id === "misp") {
        const res = await fetch("/api/integrations/misp", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.config) setConfigData(data.config.config || {})
        }
      } else if (id === "siem") {
        const res = await fetch("/api/integrations/siem", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.config) setConfigData(data.config.config || {})
        }
      } else if (id === "slack" || id === "teams") {
        const res = await fetch("/api/integrations/notifications", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data.configs?.[id]) setConfigData(data.configs[id].config || {})
        }
      }
    } catch { /* silent */ }
  }

  const handleSave = async (integrationType: string) => {
    setSaving(true)
    try {
      let endpoint = ""
      let body: any = { action: "save", integration_type: integrationType, ...configData }

      if (integrationType === "misp") {
        endpoint = "/api/integrations/misp"
      } else if (integrationType === "siem") {
        endpoint = "/api/integrations/siem"
      } else if (integrationType === "slack" || integrationType === "teams") {
        endpoint = "/api/integrations/notifications"
      }

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      setActiveConfig(null)
      fetchIntegrations()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleTest = async (integrationType: string) => {
    setTesting(true)
    setTestMessage("")
    try {
      let endpoint = ""
      let body: any = { action: "test", integration_type: integrationType }

      if (integrationType === "misp") {
        endpoint = "/api/integrations/misp"
      } else if (integrationType === "siem") {
        endpoint = "/api/integrations/siem"
        body = { action: "preview", format: configData.format || "cef" }
      } else if (integrationType === "slack" || integrationType === "teams") {
        endpoint = "/api/integrations/notifications"
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (integrationType === "siem" && data.formatted) {
        setPreviewData(data.formatted)
        setTestMessage(`Preview generated in ${data.format.toUpperCase()} format`)
      } else if (data.success) {
        setTestMessage("Connection test successful")
      } else {
        setTestMessage(data.error || "Test failed")
      }
    } catch { /* silent */ }
    setTesting(false)
  }

  const updateConfig = (key: string, value: any) => {
    setConfigData(prev => ({ ...prev, [key]: value }))
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Integrations</p>
          <h1 className="text-3xl font-bold">Integrations & Connectors</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Connect IntelForge with your existing security stack — SIEMs, threat intel platforms,
            messaging tools, and custom webhooks.
          </p>
        </div>

        {/* Webhooks section (special UI) */}
        {activeConfig === "webhooks" ? (
          <div className="space-y-4">
            <button onClick={() => setActiveConfig(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Integrations
            </button>
            <WebhookManager />
          </div>
        ) : activeConfig && activeConfig !== "webhooks" ? (
          /* Configuration Panel for non-webhook integrations */
          <div className="space-y-6">
            <button onClick={() => { setActiveConfig(null); setPreviewData(null) }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Integrations
            </button>

            <div className="rounded-2xl border border-border bg-card p-6 max-w-2xl space-y-4">
              <h2 className="text-xl font-bold">{CONFIG_COMPONENTS[activeConfig] || "Configuration"}</h2>

              {activeConfig === "misp" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">MISP Base URL</label>
                    <input type="url" value={configData.baseUrl || ""} onChange={e => updateConfig("baseUrl", e.target.value)}
                      placeholder="https://misp.example.com" autoFocus
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <input type="password" value={configData.apiKey || ""} onChange={e => updateConfig("apiKey", e.target.value)}
                      placeholder="Your MISP API key"
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={configData.autoPublish || false} onChange={e => updateConfig("autoPublish", e.target.checked)} />
                    Auto-publish events to MISP
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={configData.verifySsl !== false} onChange={e => updateConfig("verifySsl", e.target.checked)} />
                    Verify SSL certificate
                  </label>
                </>
              )}

              {activeConfig === "siem" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Export Format</label>
                    <select value={configData.format || "cef"} onChange={e => updateConfig("format", e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="cef">CEF (ArcSight, Splunk)</option>
                      <option value="leef">LEEF (QRadar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Syslog Host</label>
                    <input type="text" value={configData.syslog_host || ""} onChange={e => updateConfig("syslog_host", e.target.value)}
                      placeholder="syslog.example.com"
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Port</label>
                      <input type="number" value={configData.syslog_port || 514} onChange={e => updateConfig("syslog_port", parseInt(e.target.value))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Protocol</label>
                      <select value={configData.syslog_protocol || "tcp"} onChange={e => updateConfig("syslog_protocol", e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                      </select>
                    </div>
                  </div>
                  {previewData && (
                    <div className="rounded-xl bg-muted p-4">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Preview</p>
                      <pre className="text-xs font-mono break-all whitespace-pre-wrap">{previewData}</pre>
                    </div>
                  )}
                </>
              )}

              {(activeConfig === "slack" || activeConfig === "teams") && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Webhook URL</label>
                    <input type="url" value={configData.webhookUrl || ""} onChange={e => updateConfig("webhookUrl", e.target.value)}
                      placeholder={activeConfig === "slack" ? "https://hooks.slack.com/services/..." : "https://...webhook.office.com/..."}
                      autoFocus
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  {activeConfig === "slack" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Channel (optional)</label>
                        <input type="text" value={configData.channel || ""} onChange={e => updateConfig("channel", e.target.value)}
                          placeholder="#alerts"
                          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Bot Name</label>
                        <input type="text" value={configData.username || "IntelForge"} onChange={e => updateConfig("username", e.target.value)}
                          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-4 border-t border-border">
                <button onClick={() => handleSave(activeConfig)} disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Configuration"}
                </button>
                <button onClick={() => handleTest(activeConfig)} disabled={testing}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50">
                  <TestTube className="h-4 w-4" /> {testing ? "Testing..." : "Test Connection"}
                </button>
              </div>

              {testMessage && (
                <p className={`text-sm ${testMessage.includes("successful") || testMessage.includes("Preview") ? "text-green-600" : "text-red-500"}`}>
                  {testMessage}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Grid of integration cards */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration: any) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConfigure={handleConfigure}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
