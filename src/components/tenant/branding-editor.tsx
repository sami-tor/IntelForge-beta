"use client"

import { useState, useEffect } from "react"
import { Save, Palette, Globe, Eye, EyeOff, Image, Mail, ShieldCheck } from "lucide-react"

interface Branding {
  id?: number
  company_name?: string
  logo_url?: string
  favicon_url?: string
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  custom_css?: string
  hide_intelforge_branding?: boolean
  hide_powered_by?: boolean
  custom_domain?: string
  domain_verified?: boolean
  login_title?: string
  login_subtitle?: string
  login_bg_url?: string
  email_from_name?: string
  email_footer_text?: string
}

export function BrandingEditor({ orgId }: { orgId?: number }) {
  const [branding, setBranding] = useState<Branding>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [domainInput, setDomainInput] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [domainMsg, setDomainMsg] = useState("")

  useEffect(() => {
    fetchBranding()
  }, [orgId])

  const fetchBranding = async () => {
    try {
      const url = orgId ? `/api/tenant/branding?orgId=${orgId}` : "/api/tenant/branding"
      const res = await fetch(url, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        if (data.branding) setBranding(data.branding)
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const update = (key: string, value: any) => {
    setBranding(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const body: any = { ...branding }
      if (orgId) body.organization_id = orgId

      await fetch("/api/tenant/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDomainRequest = async () => {
    if (!domainInput) return
    setVerifying(true)
    setDomainMsg("")
    try {
      const res = await fetch("/api/tenant/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "request", domain: domainInput, orgId }),
      })
      const data = await res.json()
      setDomainMsg(data.message || data.error || "Request sent")
      if (data.success) {
        update("custom_domain", domainInput)
        update("domain_verified", false)
      }
    } catch {
      setDomainMsg("Failed to request verification")
    }
    setVerifying(false)
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading branding settings...</div>

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Colors */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5" /> Brand Colors
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "primary_color", label: "Primary", default: "#DC2626" },
            { key: "secondary_color", label: "Secondary", default: "#1F2937" },
            { key: "accent_color", label: "Accent", default: "#3B82F6" },
          ].map(({ key, label, default: def }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(branding as any)[key] || def}
                  onChange={e => update(key, e.target.value)}
                  className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={(branding as any)[key] || def}
                  onChange={e => update(key, e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-xl p-4" style={{ backgroundColor: branding.primary_color || "#DC2626" }}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {branding.company_name?.[0] || "I"}
            </div>
            <span className="text-white font-bold">{branding.company_name || "IntelForge"}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="h-3 w-16 rounded-full bg-white/30" />
            <div className="h-3 w-12 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Image className="h-5 w-5" /> Company Info
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1">Company Name</label>
          <input type="text" value={branding.company_name || ""}
            onChange={e => update("company_name", e.target.value)}
            placeholder="Your Company"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input type="url" value={branding.logo_url || ""}
            onChange={e => update("logo_url", e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Favicon URL</label>
          <input type="url" value={branding.favicon_url || ""}
            onChange={e => update("favicon_url", e.target.value)}
            placeholder="https://example.com/favicon.ico"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* White-Label Options */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <EyeOff className="h-5 w-5" /> White-Label Options
        </h3>
        <label className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium">Hide IntelForge Branding</span>
            <p className="text-xs text-muted-foreground">Remove all "IntelForge" references from the UI</p>
          </div>
          <input type="checkbox" checked={branding.hide_intelforge_branding || false}
            onChange={e => update("hide_intelforge_branding", e.target.checked)} className="rounded" />
        </label>
        <label className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium">Hide "Powered by" Footer</span>
            <p className="text-xs text-muted-foreground">Remove the powered by line from footers</p>
          </div>
          <input type="checkbox" checked={branding.hide_powered_by || false}
            onChange={e => update("hide_powered_by", e.target.checked)} className="rounded" />
        </label>
      </div>

      {/* Custom Domain */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="h-5 w-5" /> Custom Domain
        </h3>
        <div className="flex gap-2">
          <input type="text" value={domainInput}
            onChange={e => setDomainInput(e.target.value)}
            placeholder="app.yourcompany.com"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleDomainRequest} disabled={verifying || !domainInput}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {verifying ? "Verifying..." : "Verify"}
          </button>
        </div>
        {branding.custom_domain && (
          <p className={`text-sm ${branding.domain_verified ? "text-green-600" : "text-amber-500"}`}>
            {branding.custom_domain} — {branding.domain_verified ? "Verified" : "Pending verification"}
          </p>
        )}
        {domainMsg && <p className="text-sm text-muted-foreground">{domainMsg}</p>}
      </div>

      {/* Login Page */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Login Page
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1">Login Title</label>
          <input type="text" value={branding.login_title || ""}
            onChange={e => update("login_title", e.target.value)}
            placeholder="Welcome to YourPlatform"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Login Subtitle</label>
          <textarea value={branding.login_subtitle || ""}
            onChange={e => update("login_subtitle", e.target.value)}
            placeholder="Your security investigation platform"
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Login Background Image URL</label>
          <input type="url" value={branding.login_bg_url || ""}
            onChange={e => update("login_bg_url", e.target.value)}
            placeholder="https://example.com/bg.jpg"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* Email */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email Settings
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1">From Name</label>
          <input type="text" value={branding.email_from_name || ""}
            onChange={e => update("email_from_name", e.target.value)}
            placeholder="YourCompany Security"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email Footer Text</label>
          <textarea value={branding.email_footer_text || ""}
            onChange={e => update("email_footer_text", e.target.value)}
            placeholder="© YourCompany. All rights reserved."
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* Custom CSS */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold">Custom CSS</h3>
        <textarea
          value={branding.custom_css || ""}
          onChange={e => update("custom_css", e.target.value)}
          placeholder="/* Custom styles */&#10;.header { background: var(--brand-primary); }"
          rows={6}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Branding Settings"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
      </div>
    </div>
  )
}
