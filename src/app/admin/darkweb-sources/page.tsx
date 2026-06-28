"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Plus, Shield, Trash2, CheckCircle, XCircle, Loader2, Globe, Clock3, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface DarkwebSource {
  id: number
  source_key: string
  source_name: string
  onion_url: string
  source_type: string
  enabled: boolean
  rate_limit_minutes: number
  legal_basis: string
  collection_policy: string
  reliability_score: number
  last_success_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export default function DarkwebSourcesPage() {
  const [sources, setSources] = useState<DarkwebSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [formData, setFormData] = useState({
    sourceKey: "",
    sourceName: "",
    onionUrl: "",
    sourceType: "forum_public",
    enabled: true,
    rateLimitMinutes: 1440,
    reliabilityScore: 50,
    legalBasis: "",
    collectionPolicy: "",
  })

  useEffect(() => {
    fetchSources()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch("/api/admin/darkweb-sources", { credentials: "include" })
      if (!response.ok) throw new Error(`Failed with status ${response.status}`)
      const data = await response.json()
      setSources(data.dataSources || [])
    } catch (error) {
      console.error("Failed to fetch darkweb sources:", error)
      setSources([])
    } finally {
      setLoading(false)
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "darkweb-sync" }),
      })
      if (response.ok) await fetchSources()
    } catch (error) {
      console.error("Failed to sync darkweb sources:", error)
    } finally {
      setSyncing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch("/api/admin/darkweb-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        setFormData({
          sourceKey: "",
          sourceName: "",
          onionUrl: "",
          sourceType: "forum_public",
          enabled: true,
          rateLimitMinutes: 1440,
          reliabilityScore: 50,
          legalBasis: "",
          collectionPolicy: "",
        })
        setShowAddForm(false)
        fetchSources()
      }
    } catch (error) {
      console.error("Failed to add darkweb source:", error)
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (id: number, enabled: boolean) => {
    try {
      const response = await fetch("/api/admin/darkweb-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, enabled: !enabled }),
      })
      if (response.ok) fetchSources()
    } catch (error) {
      console.error("Failed to toggle darkweb source:", error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this darkweb source?")) return
    try {
      const response = await fetch(`/api/admin/darkweb-sources?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (response.ok) fetchSources()
    } catch (error) {
      console.error("Failed to delete darkweb source:", error)
    }
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
          <h1 className="text-3xl font-bold text-foreground">Darkweb Sources</h1>
          <p className="text-muted-foreground mt-1">Manage approved onion sources for production CTI collection</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncNow} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Source
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Darkweb Source</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceKey">Source Key</Label>
                <Input id="sourceKey" value={formData.sourceKey} onChange={(e) => setFormData({ ...formData, sourceKey: e.target.value })} placeholder="ransomblog-001" required />
              </div>
              <div>
                <Label htmlFor="sourceName">Source Name</Label>
                <Input id="sourceName" value={formData.sourceName} onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })} placeholder="Approved Ransom Blog" required />
              </div>
            </div>

            <div>
              <Label htmlFor="onionUrl">Onion URL</Label>
              <Input id="onionUrl" value={formData.onionUrl} onChange={(e) => setFormData({ ...formData, onionUrl: e.target.value })} placeholder="http://exampleonionaddress.onion" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="sourceType">Source Type</Label>
                <select id="sourceType" value={formData.sourceType} onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background" required>
                  <option value="forum_public">Forum Public</option>
                  <option value="ransomware_blog">Ransomware Blog</option>
                  <option value="paste">Paste</option>
                  <option value="marketplace_watch">Marketplace Watch</option>
                  <option value="research_honeypot">Research Honeypot</option>
                </select>
              </div>
              <div>
                <Label htmlFor="rateLimitMinutes">Rate Limit Minutes</Label>
                <Input id="rateLimitMinutes" type="number" min={60} value={formData.rateLimitMinutes} onChange={(e) => setFormData({ ...formData, rateLimitMinutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="reliabilityScore">Reliability Score</Label>
                <Input id="reliabilityScore" type="number" min={0} max={100} value={formData.reliabilityScore} onChange={(e) => setFormData({ ...formData, reliabilityScore: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <Label htmlFor="legalBasis">Legal Basis</Label>
              <Textarea id="legalBasis" value={formData.legalBasis} onChange={(e) => setFormData({ ...formData, legalBasis: e.target.value })} placeholder="Public/authorized source only. Defensive collection for CTI." />
            </div>

            <div>
              <Label htmlFor="collectionPolicy">Collection Policy</Label>
              <Textarea id="collectionPolicy" value={formData.collectionPolicy} onChange={(e) => setFormData({ ...formData, collectionPolicy: e.target.value })} placeholder="Read-only, no login, no download, no JS execution." />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Source
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {sources.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Darkweb Sources</h3>
            <p className="text-muted-foreground mb-4">Add approved onion sources to start collection</p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
        ) : (
          sources.map((source) => {
            const statusText = source.last_error ? "Error" : source.last_success_at ? "Synced" : "Idle"
            const statusBadge = source.last_error
              ? "bg-red-500/15 text-red-300 border-red-500/25"
              : source.last_success_at
                ? "bg-green-500/15 text-green-300 border-green-500/25"
                : "bg-yellow-500/15 text-yellow-300 border-yellow-500/25"

            return (
              <div key={source.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Globe className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold">{source.source_name}</h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">{source.source_type}</span>
                      <span className={`px-2 py-1 text-xs rounded-full border ${statusBadge}`}>{statusText}</span>
                      {source.enabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono break-all">{source.onion_url}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {source.rate_limit_minutes} min</span>
                      <span>Reliability {source.reliability_score}/100</span>
                      <span>{source.last_success_at ? `Last sync ${new Date(source.last_success_at).toLocaleString()}` : "Never synced"}</span>
                    </div>
                    {source.collection_policy && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{source.collection_policy}</p>}
                    {source.legal_basis && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{source.legal_basis}</p>}
                    {source.last_error && <p className="text-xs text-red-500 whitespace-pre-wrap">{source.last_error}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={source.enabled ? "outline" : "default"} onClick={() => toggleEnabled(source.id, source.enabled)}>
                      {source.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(source.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
