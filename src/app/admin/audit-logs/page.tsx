"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { History, Search as SearchIcon } from "lucide-react"

interface AuditLog {
  id: number
  adminId: number
  adminEmail: string
  action: string
  resource: string
  resourceId?: number
  details: Record<string, any>
  timestamp: string
  ipAddress?: string
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [securityLogs, setSecurityLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState("")

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/admin/audit-logs", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
      const secRes = await fetch("/api/admin/audit-logs?source=security", { credentials: "include" })
      if (secRes.ok) {
        const secData = await secRes.json()
        setSecurityLogs(secData.logs || [])
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes("delete")) return "bg-red-500/20 text-red-600 border-red-500/30"
    if (action.includes("create")) return "bg-green-500/20 text-green-600 border-green-500/30"
    if (action.includes("update")) return "bg-blue-500/20 text-blue-600 border-blue-500/30"
    return "bg-gray-500/20 text-gray-600 border-gray-500/30"
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = !filterAction || log.action === filterAction

    return matchesSearch && matchesFilter
  })

  const actions = [...new Set(logs.map((log) => log.action))]
  const securityActions = [...new Set(securityLogs.map((log) => log.action))]

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading audit logs...</div>
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Audit Logs</h1>
        <p className="text-muted-foreground">Track all admin actions and system activity</p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative col-span-2">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by admin, action, or resource..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background"
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No audit logs found</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{log.adminEmail}</span>
                      <Badge className={`${getActionColor(log.action)} border`}>{log.action}</Badge>
                      <Badge variant="outline">{log.resource}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>

                  {log.ipAddress && (
                    <div className="text-xs text-muted-foreground text-right">
                      <div className="font-mono">{log.ipAddress}</div>
                    </div>
                  )}
                </div>

                {Object.keys(log.details).length > 0 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded text-xs">
                    <div className="font-mono text-muted-foreground">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Security Audit Logs</h2>
        </div>
        <div className="space-y-4">
          {securityLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No security audit logs found</div>
          ) : (
            securityLogs.map((log) => (
              <div key={`sec-${log.id}`} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <History className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{log.adminEmail || "User"}</span>
                      <Badge className={`${getActionColor(log.action)} border`}>{log.action}</Badge>
                      <Badge variant="outline">{log.resource}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {log.ipAddress && (
                    <div className="text-xs text-muted-foreground text-right">
                      <div className="font-mono">{log.ipAddress}</div>
                    </div>
                  )}
                </div>
                {Object.keys(log.details).length > 0 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded text-xs">
                    <div className="font-mono text-muted-foreground">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6 border-yellow-500/20 bg-yellow-50/5">
        <div className="text-sm text-muted-foreground">
          <strong>Note:</strong> Audit logs are stored in the database with full details of all admin actions.
          Only administrators can view this page. Logs are automatically cleared after 90 days for storage optimization.
        </div>
      </Card>
    </div>
  )
}
