"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Building2, Plus, ArrowRight, Users, Calendar } from "lucide-react"
import Link from "next/link"
import DashboardNavbar from "@/components/dashboard-navbar"

interface Org {
  id: number
  name: string
  slug: string
  description: string | null
  industry: string | null
  size: string | null
  created_at: string
}

export default function OrganizationsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return }
    if (user) fetchOrgs()
  }, [user, loading])

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/organizations", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setOrgs(data.organizations || [])
      }
    } catch { /* silent */ }
    setPageLoading(false)
  }

  const createOrg = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName, description: newDesc }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/organizations/${data.organization.id}`)
      }
    } catch { /* silent */ }
    setCreating(false)
  }

  if (pageLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Organizations</p>
            <h1 className="text-3xl font-bold">Your Organizations</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Organization
          </button>
        </div>

        {orgs.length === 0 && !showCreate ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-4">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No organizations yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create an organization to collaborate with your team, share cases, and manage investigations together.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Create Your First Organization
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/dashboard/organizations/${org.id}`}
                className="group rounded-2xl border border-border bg-card p-6 transition hover:border-primary hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{org.name}</h2>
                {org.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{org.description}</p>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(org.created_at).toLocaleDateString()}
                  </span>
                  {org.size && <span>{org.size} employees</span>}
                  {org.industry && <span>{org.industry}</span>}
                </div>
              </Link>
            ))}

            {/* Create New Card */}
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <Plus className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">Create New Organization</p>
            </button>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <h2 className="text-xl font-bold">Create Organization</h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowCreate(false); setNewName(""); setNewDesc("") }}
                  className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={createOrg}
                  disabled={creating || newName.length < 2}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
