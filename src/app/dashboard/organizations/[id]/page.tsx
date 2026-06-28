"use client"

import { useEffect, useState, use } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Building2, Save, Trash2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import DashboardNavbar from "@/components/dashboard-navbar"
import { MembersManager } from "@/components/organization/members-manager"

export default function OrgSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading } = useAuth()
  const router = useRouter()
  const orgId = parseInt(id)

  const [org, setOrg] = useState<any>(null)
  const [role, setRole] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [industry, setIndustry] = useState("")
  const [orgSize, setOrgSize] = useState("")
  const [activeTab, setActiveTab] = useState<"general" | "members">("general")

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return }
    if (user && !isNaN(orgId)) fetchOrg()
  }, [user, loading, orgId])

  const fetchOrg = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setOrg(data.organization)
        setRole(data.role)
        setName(data.organization.name)
        setDescription(data.organization.description || "")
        setWebsite(data.organization.website || "")
        setIndustry(data.organization.industry || "")
        setOrgSize(data.organization.size || "")
      } else {
        router.push("/dashboard/organizations")
      }
    } catch { router.push("/dashboard/organizations") }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, website, industry, size: orgSize }),
      })
      fetchOrg()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm("Delete this organization? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (res.ok) router.push("/dashboard/organizations")
    } catch { /* silent */ }
    setDeleting(false)
  }

  if (!org) return <div className="flex items-center justify-center h-screen">Loading...</div>

  const canManage = role === "owner" || role === "admin"

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/dashboard/organizations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Organizations
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Organization Settings</p>
            <h1 className="text-2xl font-bold">{org.name}</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 rounded-xl bg-muted p-1 w-fit">
          <button
            onClick={() => setActiveTab("general")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "general" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "members" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Members
          </button>
        </div>

        {activeTab === "general" ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">General Settings</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Organization Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canManage}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canManage}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={!canManage}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={!canManage}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    <option value="cybersecurity">Cybersecurity</option>
                    <option value="government">Government / Law Enforcement</option>
                    <option value="finance">Finance / Banking</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="technology">Technology</option>
                    <option value="defense">Defense</option>
                    <option value="energy">Energy</option>
                    <option value="education">Education</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Organization Size</label>
                  <select
                    value={orgSize}
                    onChange={(e) => setOrgSize(e.target.value)}
                    disabled={!canManage}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-1000">201-1,000</option>
                    <option value="1000+">1,000+</option>
                  </select>
                </div>
              </div>

              {canManage && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            {role === "owner" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">
                  Deleting your organization will deactivate it and remove all members. This action cannot be undone.
                </p>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Deleting..." : "Delete Organization"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <MembersManager orgId={orgId} />
        )}
      </main>
    </div>
  )
}
