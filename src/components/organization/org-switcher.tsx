"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { Building2, ChevronDown, Plus, Users, Settings, Check } from "lucide-react"
import Link from "next/link"

interface Org {
  id: number
  name: string
  slug: string
}

export function OrgSwitcher() {
  const { user, refreshUser } = useAuth()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null)
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) fetchOrgs()
  }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/organizations", { credentials: "include" })
      if (res.status === 401) {
        setOrgs([])
        setCurrentOrg(null)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setOrgs(data.organizations || [])
        const current = (data.organizations || []).find(
          (o: Org) => o.id === (user as any)?.currentOrgId
        ) || data.organizations?.[0]
        setCurrentOrg(current || null)
      }
    } catch { /* silent */ }
  }

  const switchOrg = async (orgId: number) => {
    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      })
      if (res.ok) {
        await refreshUser()
        const org = orgs.find(o => o.id === orgId)
        setCurrentOrg(org || null)
      }
    } catch { /* silent */ }
    setOpen(false)
  }

  const createOrg = async () => {
    if (!newOrgName.trim() || newOrgName.length < 2) return
    setCreating(true)
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newOrgName.trim() }),
      })
      if (res.ok) {
        await fetchOrgs()
        setNewOrgName("")
        setShowCreate(false)
      }
    } catch { /* silent */ }
    setCreating(false)
  }

  if (!user || orgs.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent transition-colors"
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[140px] truncate font-medium">
          {currentOrg?.name || "Personal"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Organizations
            </p>
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-left truncate">{org.name}</span>
                {currentOrg?.id === org.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {!showCreate ? (
              <>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Organization
                </button>
                {currentOrg && (
                  <Link
                    href={`/dashboard/organizations/${currentOrg.id}`}
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Organization Settings
                  </Link>
                )}
              </>
            ) : (
              <div className="space-y-2 p-1">
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Organization name..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createOrg()
                    if (e.key === "Escape") setShowCreate(false)
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={createOrg}
                    disabled={creating || newOrgName.length < 2}
                    className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setNewOrgName("") }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
