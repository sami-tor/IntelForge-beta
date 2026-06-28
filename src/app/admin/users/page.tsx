"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Edit, Trash2, CheckCircle, XCircle } from "lucide-react"
import { UserEditModal } from "@/components/admin/user-edit-modal"
import { AdminProtected } from "@/components/admin-protected"

interface User {
  id: number
  email: string
  username: string
  role: string
  verification_status: string
  subscription_type: string
  subscription_end: string | null
  is_lifetime: boolean
  is_active: boolean
  created_at: string
}

function UsersManagementContent() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchCsrf()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("Failed to fetch users:", error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCsrf = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken)
        } else if (response.headers.get("X-CSRF-Token")) {
          setCsrfToken(response.headers.get("X-CSRF-Token"))
        }
      }
    } catch (error) {
      console.error("Failed to fetch CSRF token:", error)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return

    if (!csrfToken) {
      await fetchCsrf()
      if (!csrfToken) {
        alert("Security token missing. Please refresh the page and try again.")
        return
      }
    }

    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ csrfToken }),
      })

      if (response.ok) {
        fetchUsers()
      } else {
        const err = await response.json().catch(() => ({ error: "Forbidden" }))
        alert(err.error || "Failed to delete user")
      }
    } catch (error) {
      console.error("Failed to delete user:", error)
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading users...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">Manage all user accounts and permissions</p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search users by email or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Subscription</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-semibold">{user.username}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <Badge
                        variant={
                          user.verification_status === "verified"
                            ? "default"
                            : user.verification_status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {user.verification_status}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium">{user.subscription_type}</div>
                      {user.is_lifetime ? (
                        <div className="text-xs text-green-600">Lifetime</div>
                      ) : user.subscription_end ? (
                        <div className="text-xs text-muted-foreground">
                          Expires: {new Date(user.subscription_end).toLocaleDateString()}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user)
                          setShowEditModal(true)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showEditModal && selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
          onUpdate={() => {
            fetchUsers()
            setShowEditModal(false)
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}

export default function UsersManagement() {
  return (
    <AdminProtected>
      <UsersManagementContent />
    </AdminProtected>
  )
}
