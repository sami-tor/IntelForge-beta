"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock, Trash2, AlertCircle, CheckCircle, Plus } from "lucide-react"
import Link from "next/link"
const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || "/admin"

interface IPPolicy {
  id: number
  userId: number
  userEmail: string
  ipAddress: string
  status: "active" | "locked" | "unlocked"
  createdAt: string
  lastActivity: string
}

interface LoginActivity {
  id: number
  userId: number
  userEmail: string
  ipAddress: string
  status: "success" | "failed" | "suspicious"
  reason?: string
  timestamp: string
}

export default function AdminSecurity() {
  const [policies, setPolicies] = useState<IPPolicy[]>([])
  const [activities, setActivities] = useState<LoginActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      const [policiesRes, activitiesRes] = await Promise.all([
        fetch("/api/admin/security/ip-policies", { credentials: "include" }),
        fetch("/api/admin/security/login-activity", { credentials: "include" }),
      ])

      if (policiesRes.ok) {
        const data = await policiesRes.json()
        setPolicies(data.policies || [])
      }

      if (activitiesRes.ok) {
        const data = await activitiesRes.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error("Failed to fetch security data:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleIPPolicy = async (policyId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "locked" ? "unlocked" : "locked"
      const response = await fetch("/api/admin/security/ip-policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ policyId, status: newStatus }),
      })

      if (response.ok) {
        setMessage(`IP policy ${newStatus} successfully!`)
        setMessageType("success")
        fetchSecurityData()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update policy")
      setMessageType("error")
    }
  }

  const deleteIPPolicy = async (policyId: number) => {
    if (!confirm("Are you sure you want to delete this IP policy?")) return

    try {
      const response = await fetch("/api/admin/security/ip-policies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ policyId }),
      })

      if (response.ok) {
        setMessage("IP policy deleted successfully!")
        setMessageType("success")
        fetchSecurityData()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete policy")
      setMessageType("error")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-600 border-green-500/30"
      case "locked":
        return "bg-red-500/20 text-red-600 border-red-500/30"
      case "unlocked":
        return "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
      case "success":
        return "bg-green-500/20 text-green-600"
      case "failed":
        return "bg-red-500/20 text-red-600"
      case "suspicious":
        return "bg-orange-500/20 text-orange-600"
      default:
        return ""
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading security data...</div>
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Security Management</h1>
        <p className="text-muted-foreground">Manage IP policies, lock suspicious accounts, and view login activity</p>
        <div className="mt-4">
          <Link href={`${ADMIN_ALIAS}/audit-logs?source=security`}>
            <Button variant="outline">View Security Audit Logs</Button>
          </Link>
        </div>
      </div>

      {message && (
        <Card className={`p-4 border ${messageType === "success" ? "border-green-500/30 bg-green-50/10" : "border-red-500/30 bg-red-50/10"}`}>
          <div className="flex items-center gap-3">
            {messageType === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={messageType === "success" ? "text-green-600" : "text-red-600"}>{message}</span>
          </div>
        </Card>
      )}

      {/* IP Lock Policies */}
      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6" />
            <h2 className="text-2xl font-bold">IP Lock Policies</h2>
          </div>
          <span className="text-sm text-muted-foreground">{policies.length} policies</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">IP Address</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Created</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Last Activity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No IP policies configured yet
                  </td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold">{policy.userEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">{policy.ipAddress}</td>
                    <td className="px-6 py-4">
                      <Badge className={`${getStatusColor(policy.status)} border`}>{policy.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">{new Date(policy.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{new Date(policy.lastActivity).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleIPPolicy(policy.id, policy.status)}
                        >
                          {policy.status === "locked" ? "Unlock" : "Lock"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteIPPolicy(policy.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Login Activity */}
      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Login Activity</h2>
          </div>
          <span className="text-sm text-muted-foreground">{activities.length} recent activities</span>
        </div>

        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No login activity recorded yet</div>
          ) : (
            activities.slice(0, 20).map((activity) => (
              <div key={activity.id} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-semibold">{activity.userEmail}</div>
                        <div className="text-sm text-muted-foreground">
                          IP: <span className="font-mono">{activity.ipAddress}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(activity.status)}>{activity.status}</Badge>
                    <div className="text-xs text-muted-foreground text-right">
                      {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                {activity.reason && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <strong>Reason:</strong> {activity.reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
