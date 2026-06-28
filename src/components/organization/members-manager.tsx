"use client"

import { useState, useEffect } from "react"
import { UserPlus, Trash2, Shield, Mail, Clock, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface Member {
  id: number
  user_id: number
  role: string
  email: string
  username: string
  joined_at: string
  is_active: boolean
}

interface Invite {
  id: number
  email: string
  role: string
  token: string
  inviter_name: string
  created_at: string
}

export function MembersManager({ orgId }: { orgId: number }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchMembers()
  }, [orgId])

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setInvites(data.invites || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail) return
    setSending(true)
    setError("")
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setInviteEmail("")
        fetchMembers()
      } else {
        setError(data.error || "Failed to invite")
      }
    } catch {
      setError("Network error")
    }
    setSending(false)
  }

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await fetch(`/api/organizations/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, role }),
      })
      fetchMembers()
    } catch { /* silent */ }
  }

  const handleRemove = async (userId: number) => {
    if (!confirm("Remove this member from the organization?")) return
    try {
      await fetch(`/api/organizations/${orgId}/members?userId=${userId}`, {
        method: "DELETE",
        credentials: "include",
      })
      fetchMembers()
    } catch { /* silent */ }
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-amber-500/20 text-amber-600 border-amber-500/30",
      admin: "bg-purple-500/20 text-purple-600 border-purple-500/30",
      member: "bg-blue-500/20 text-blue-600 border-blue-500/30",
      viewer: "bg-gray-500/20 text-gray-600 border-gray-500/30",
    }
    return (
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[role] || colors.member}`}>
        {role}
      </span>
    )
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading members...</div>

  const currentUserRole = members.find(m => m.user_id === (user as any)?.id)?.role || ""
  const canManage = currentUserRole === "owner" || currentUserRole === "admin"

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      {canManage && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite Members
          </h3>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={sending || !inviteEmail}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Invite"}
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" /> Members ({members.length})
          </h3>
        </div>
        <div className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.user_id === (user as any)?.id
            const isOwner = member.role === "owner"
            return (
              <div key={member.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-bold">
                    {(member.username || member.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {member.username || member.email}
                      {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && !isSelf && !isOwner ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemove(member.user_id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    roleBadge(member.role)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" /> Pending Invites ({invites.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invite.inviter_name} • {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
                  {invite.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
