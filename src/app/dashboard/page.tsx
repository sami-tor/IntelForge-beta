"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Loader2, Search, Clock, TrendingUp, ShieldCheck, Globe, Lock, Key, Plus, Eye, EyeOff, Trash2, Sparkles, Cpu, Zap, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { TwoFactorSetupModal } from "@/components/2fa-setup-modal"
import { canGenerateAPIKeys, getDisplaySubscription } from "@/lib/roles"
import DashboardNavbar from "@/components/dashboard-navbar"
import Footer from "@/components/footer"

interface SearchHistory {
  id: number
  query: string
  results_count: number
  ip_address: string | null
  created_at: string
}

interface LoginActivity {
  id: number
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [profileForm, setProfileForm] = useState({ email: "", username: "" })
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set())
  const [aiSettings, setAiSettings] = useState<any | null>(null)
  const [loadingAISettings, setLoadingAISettings] = useState(false)
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false)
  const [aiForm, setAiForm] = useState({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "",
    baseUrl: "",
    enabled: true,
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchSearchHistory()
      fetchLoginActivity()
      setProfileForm({ email: user.email, username: user.username })
      fetchAISettings()

      // Fetch API keys if user has permission (Admin or Premium)
      if (canGenerateAPIKeys(user)) {
        fetchApiKeys()
      }
    }
  }, [user])

  const fetchSearchHistory = async () => {
    try {
      const response = await fetch("/api/user/search-history", { credentials: "include" })
      if (response.status === 401) {
        setSearchHistory([])
        return
      }
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setSearchHistory(data.history ?? [])
    } catch {
      setSearchHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchLoginActivity = async () => {
    try {
      const response = await fetch("/api/user/login-activity", { credentials: "include" })
      if (response.status === 401) {
        setLoginActivity([])
        return
      }
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setLoginActivity(data.activity ?? [])
    } catch {
      setLoginActivity([])
    } finally {
      setLoadingActivity(false)
    }
  }

  const fetchAISettings = async () => {
    setLoadingAISettings(true)
    try {
      const response = await fetch("/api/user/ai-settings", { credentials: "include" })
      if (response.status === 401) {
        setAiSettings(null)
        return
      }
      if (!response.ok) throw new Error("Failed to fetch AI settings")
      const data = await response.json()
      if (data.settings) {
        setAiSettings(data.settings)
        setAiForm({
          provider: data.settings.provider || "openai",
          model: data.settings.model || "gpt-4o-mini",
          apiKey: "",
          baseUrl: data.settings.baseUrl || "",
          enabled: data.settings.enabled !== false,
        })
      }
    } catch {
      setAiSettings(null)
    } finally {
      setLoadingAISettings(false)
    }
  }

  const fetchApiKeys = async () => {
    setLoadingKeys(true)
    try {
      const response = await fetch("/api/user/api-keys", { credentials: "include" })
      if (response.status === 401) {
        setApiKeys([])
        return
      }
      if (!response.ok) throw new Error("Failed to fetch API keys")
      const data = await response.json()
      setApiKeys(data.keys || [])
    } catch {
      setApiKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  const saveAISettings = async () => {
    setAiSettingsSaving(true)
    setError(null)
    setMessage(null)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const response = await fetch("/api/user/ai-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          provider: aiForm.provider,
          model: aiForm.model,
          apiKey: aiForm.apiKey,
          baseUrl: aiForm.baseUrl || null,
          enabled: aiForm.enabled,
          csrfToken,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save AI settings")
      setAiSettings(data.settings)
      setAiForm(prev => ({ ...prev, apiKey: "" }))
      setMessage("AI settings saved successfully.")
    } catch (error: any) {
      setError(error.message || "Failed to save AI settings")
    } finally {
      setAiSettingsSaving(false)
    }
  }

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      setError("Please enter a key name")
      return
    }

    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        credentials: "include",
        body: JSON.stringify({ keyName: newKeyName, expiresInDays: 365, csrfToken }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate API key")
      }

      const data = await response.json()
      setGeneratedKey(data.key)
      setNewKeyName("")
      setShowNewKeyForm(false)
      setMessage("API key generated successfully!")
      fetchApiKeys()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const revokeApiKey = async (keyId: number) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return

    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const response = await fetch(`/api/user/api-keys?id=${keyId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ csrfToken }),
      })
      
      if (!response.ok) throw new Error("Failed to revoke API key")
      
      setMessage("API key revoked successfully")
      fetchApiKeys()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const toggleKeyVisibility = (keyId: number) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    setMessage(null)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ...profileForm, csrfToken }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      setMessage("Profile updated successfully.")
      await refreshUser()
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    setMessage(null)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ...passwordForm, csrfToken }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update password")
      }

      setMessage("Password updated successfully.")
      setPasswordForm({ currentPassword: "", newPassword: "" })
    } catch (err: any) {
      setError(err.message || "Failed to update password")
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const searchPercentage = user.searchLimit === -1 ? 100 : (user.searchCount / user.searchLimit) * 100

  return (
    <main className="min-h-screen bg-background">
      <DashboardNavbar />
      <div className="pt-16 pb-16 container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Dashboard</h1>
        </div>

        {/* Intelligence Hub Quick Access */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Intelligence Hub</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <a href="/intelligence" className="group flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Hub Dashboard</span>
              <span className="text-[10px] text-muted-foreground">All 30+ intel modules</span>
            </a>
            <a href="/intelligence/command-center" className="group flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-lg hover:border-orange-500/40 hover:bg-orange-500/5 transition-all">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Cpu className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-sm font-medium">Command Center</span>
              <span className="text-[10px] text-muted-foreground">Live threat score & clusters</span>
            </a>
            <a href="/search" className="group flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-lg hover:border-red-500/40 hover:bg-red-500/5 transition-all">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Search className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-sm font-medium">Search</span>
              <span className="text-[10px] text-muted-foreground">Text, face & image search</span>
            </a>
            <a href="/intel/ai-analyst" className="group flex flex-col items-start gap-2 p-4 bg-card border border-border rounded-lg hover:border-purple-500/40 hover:bg-purple-500/5 transition-all">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-sm font-medium">AI Analyst</span>
              <span className="text-[10px] text-muted-foreground">Evidence-backed CTI queries</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Searches Used</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {user.searchCount}
              <span className="text-lg text-muted-foreground"> / {user.searchLimit === -1 ? "∞" : user.searchLimit}</span>
            </p>
            <div className="mt-3 w-full bg-border rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(searchPercentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Subscription</h3>
            </div>
            <p className="text-2xl font-bold text-primary">{getDisplaySubscription(user)}</p>
            {user.subscriptionEnd && (
              <p className="text-sm text-muted-foreground mt-2">
                Expires: {new Date(user.subscriptionEnd).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Account Status</h3>
            </div>
            <p className="text-2xl font-bold text-foreground">{user.verificationStatus === "verified" ? "Verified" : "Pending"}</p>
            {user.verificationStatus !== "verified" && (
              <p className="text-sm text-muted-foreground mt-2">Check your email to verify.</p>
            )}
          </div>
        </div>

        {(message || error) && (
          <Card className={`mb-6 p-4 ${error ? "border-destructive" : "border-green-500"}`}>
            <p className={error ? "text-destructive" : "text-green-600"}>{error ?? message}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Account Settings
            </h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={profileSaving} className="w-full">
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Profile"}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  required
                  minLength={8}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={passwordSaving} className="w-full">
                {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
              </Button>
            </form>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Analysis Settings
            </h2>
            {loadingAISettings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="aiProvider">Provider</Label>
                  <select
                    id="aiProvider"
                    value={aiForm.provider}
                    onChange={(e) => {
                      const provider = e.target.value
                      const defaults: Record<string, string> = {
                        openai: "gpt-4o-mini",
                        anthropic: "claude-3-5-sonnet-latest",
                        google: "gemini-1.5-flash",
                        deepseek: "deepseek-chat",
                        custom: "custom-model",
                      }
                      setAiForm(prev => ({ ...prev, provider, model: defaults[provider] || prev.model }))
                    }}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">Custom OpenAI-compatible</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="aiModel">Model</Label>
                  <Input
                    id="aiModel"
                    value={aiForm.model}
                    onChange={(e) => setAiForm(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="gpt-4o-mini"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="aiApiKey">API Key</Label>
                  <Input
                    id="aiApiKey"
                    type="password"
                    value={aiForm.apiKey}
                    onChange={(e) => setAiForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={aiSettings?.hasApiKey ? "Stored securely — enter new key to replace" : "Paste provider API key"}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Key encrypted at rest and never returned to browser.</p>
                </div>
                <div>
                  <Label htmlFor="aiBaseUrl">Base URL (optional)</Label>
                  <Input
                    id="aiBaseUrl"
                    value={aiForm.baseUrl}
                    onChange={(e) => setAiForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com"
                    className="mt-1"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aiForm.enabled}
                    onChange={(e) => setAiForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  Enable AI Analysis
                </label>
                {aiSettings?.hasApiKey && (
                  <p className="text-xs text-green-600">AI settings configured for {aiSettings.provider} / {aiSettings.model}.</p>
                )}
                <Button onClick={saveAISettings} disabled={aiSettingsSaving} className="w-full">
                  {aiSettingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save AI Settings"}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* API Keys Section - Admin and Premium Users */}
        {user && canGenerateAPIKeys(user) && (
          <Card className="p-6 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                API Keys
              </h2>
              <Button onClick={() => setShowNewKeyForm(!showNewKeyForm)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Generate Key
              </Button>
            </div>

            {/* Generated Key Display */}
            {generatedKey && (
              <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="font-semibold mb-2 text-green-600">✅ API Key Generated!</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Copy this key now - it won't be shown again!
                </p>
                <div className="flex gap-2">
                  <Input
                    value={generatedKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey)
                      setMessage("API key copied to clipboard!")
                    }}
                    variant="outline"
                  >
                    Copy
                  </Button>
                  <Button onClick={() => setGeneratedKey(null)}>
                    Done
                  </Button>
                </div>
              </div>
            )}

            {/* New Key Form */}
            {showNewKeyForm && (
              <div className="mb-4 p-4 bg-background border border-border rounded-lg">
                <h3 className="font-semibold mb-3">Generate New API Key</h3>
                <div className="flex gap-2">
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Enter key name (e.g., Production API)"
                    className="flex-1"
                  />
                  <Button onClick={generateApiKey}>
                    Generate
                  </Button>
                  <Button onClick={() => setShowNewKeyForm(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum 5 active API keys allowed. Keys expire in 1 year.
                </p>
              </div>
            )}

            {/* API Keys List */}
            {loadingKeys ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : apiKeys.length > 0 ? (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4 bg-background border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{key.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            Stored securely — not retrievable
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Rate Limit: {key.rate_limit} req/min • Created: {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used && ` • Last used: ${new Date(key.last_used).toLocaleString()}`}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                          key.is_active ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                        }`}>
                          {key.is_active ? "Active" : "Revoked"}
                        </span>
                      </div>
                      {key.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeApiKey(key.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No API keys generated yet. Click "Generate Key" to create one.
              </p>
            )}

            {/* API Documentation */}
            {apiKeys.length > 0 && (
              <div className="mt-6 p-4 bg-background border border-border rounded-lg">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  How to Use Your API Key
                </h3>
                
                <div className="space-y-4">
                  {/* API Endpoint */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">API Endpoint:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/search
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/search`)
                          setMessage("API endpoint copied!")
                          setTimeout(() => setMessage(null), 2000)
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Example Request */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Example Request (cURL):</p>
                    <div className="bg-muted p-3 rounded overflow-x-auto">
                      <pre className="text-xs font-mono">
{`curl -X GET "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/search?q=example" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json"`}
                      </pre>
                    </div>
                  </div>

                  {/* Example with JavaScript */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Example Request (JavaScript):</p>
                    <div className="bg-muted p-3 rounded overflow-x-auto">
                      <pre className="text-xs font-mono">
{`const response = await fetch('${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/search?q=example', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY_HERE',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();`}
                      </pre>
                    </div>
                  </div>

                  {/* Example with Python */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Example Request (Python):</p>
                    <div className="bg-muted p-3 rounded overflow-x-auto">
                      <pre className="text-xs font-mono">
{`import requests

url = "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/search"
headers = {
    "Authorization": "Bearer YOUR_API_KEY_HERE",
    "Content-Type": "application/json"
}
params = {"q": "example"}

response = requests.get(url, headers=headers, params=params)
data = response.json()
print(data)`}
                      </pre>
                    </div>
                  </div>

                  {/* Parameters */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Query Parameters:</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs">q</code>
                        <span className="text-muted-foreground">(required) - Search query string</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs">categories</code>
                        <span className="text-muted-foreground">(optional) - Comma-separated category IDs</span>
                      </div>
                    </div>
                  </div>

                  {/* Response Format */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Response Format:</p>
                    <div className="bg-muted p-3 rounded overflow-x-auto">
                      <pre className="text-xs font-mono">
{`{
  "success": true,
  "results": [
    {
      "FilePath": "path/to/file.txt",
      "LineNum": 42,
      "Content": "matching content...",
      "Category": "category-name"
    }
  ],
  "totalResults": 10,
  "cached": false
}`}
                      </pre>
                    </div>
                  </div>

                  {/* Rate Limits */}
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded">
                    <p className="text-sm font-medium mb-1">⚡ Rate Limits:</p>
                    <p className="text-sm text-muted-foreground">
                      Your API key has a rate limit of <strong>{apiKeys[0]?.rate_limit || 100} requests per minute</strong>.
                      Exceeding this limit will result in 429 (Too Many Requests) errors.
                    </p>
                  </div>

                  {/* Documentation Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Need more help? Check out the full API documentation.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('/api-docs', '_blank')}
                    >
                      View Full Docs
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="bg-card border border-border rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Searches</h2>
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : searchHistory.length > 0 ? (
            <div className="space-y-3">
              {searchHistory.map((search) => (
                <div key={search.id} className="p-4 bg-background border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-foreground">{search.query}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(search.created_at).toLocaleString()} • {search.results_count} results
                      </p>
                      {search.ip_address && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> IP: {search.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No searches recorded yet.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Recent Login Activity</h2>
          {loadingActivity ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : loginActivity.length > 0 ? (
            <div className="space-y-3">
              {loginActivity.map((activity) => (
                <div key={activity.id} className="p-4 bg-background border border-border rounded-lg">
                  <p className="font-mono text-sm text-foreground">{activity.ip_address || "Unknown IP"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                  {activity.user_agent && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.user_agent}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No login activity recorded yet.</p>
          )}
        </div>

        {/* Security Section */}
        <div className="bg-card border border-border rounded-lg p-6 mt-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Security Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-background border border-border rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Two-Factor Authentication (2FA)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add an extra layer of security to your account with 2FA
                </p>
              </div>
              <Button
                onClick={() => setShow2FAModal(true)}
                variant="outline"
                className="ml-4"
              >
                Enable 2FA
              </Button>
            </div>

            <div className="p-4 bg-background border border-border rounded-lg">
              <p className="font-semibold text-foreground mb-3">Active Sessions</p>
              <p className="text-sm text-muted-foreground mb-2">You're currently logged in from:</p>
              {loginActivity.slice(0, 1).map((activity, idx) => (
                <div key={idx} className="text-xs font-mono text-foreground/70 p-2 bg-muted rounded">
                  {activity.ip_address || "Unknown"} - {new Date(activity.created_at).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <TwoFactorSetupModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onSuccess={() => {
          setShow2FAModal(false)
          setMessage("✅ Two-factor authentication enabled successfully!")
          setTimeout(() => setMessage(null), 5000)
        }}
      />
      <Footer />
    </main>
  )
}
