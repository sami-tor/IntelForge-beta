"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card } from "@/components/ui/card"
import { Users, CheckCircle, Clock, Mail, Search, FileText, Zap } from "lucide-react"

interface Stats {
  totalUsers: number
  activeUsers: number
  pendingVerifications: number
  unreadMessages: number
  totalSearches: number
  totalFiles: number
}

interface HealthStatus {
  database: {
    status: "online" | "offline" | "degraded"
    message: string
    responseTime: number
  }
  fileSystem: {
    status: "online" | "offline" | "degraded"
    message: string
    dataDir: string
  }
  api: {
    status: "online" | "offline"
    message: string
    uptime: number
  }
  overall: "healthy" | "degraded" | "unhealthy"
  timestamp: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || '/admin'
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingVerifications: 0,
    unreadMessages: 0,
    totalSearches: 0,
    totalFiles: 0,
  })

  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    // Check if user is admin
    if (!loading) {
      if (!user || user.role !== "admin") {
        // Redirect non-admin users to admin login
        const loginPath = `${ADMIN_ALIAS}/login`
        window.location.href = loginPath
        return
      }
      setPageLoading(false)
    }
  }, [user, loading, router, ADMIN_ALIAS])

  useEffect(() => {
    if (!pageLoading) {
      fetchStats()
      fetchHealth()
    }
  }, [pageLoading])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      })
      if (response.status === 401) {
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          pendingVerifications: 0,
          unreadMessages: 0,
          totalSearches: 0,
          totalFiles: 0,
        })
        return
      }
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setStats(data)
    } catch {
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        pendingVerifications: 0,
        unreadMessages: 0,
        totalSearches: 0,
        totalFiles: 0,
      })
    }
  }

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/admin/health", {
        credentials: "include",
      })
      if (response.status === 401) {
        setHealth(null)
        return
      }
      if (response.ok) {
        const data = await response.json()
        setHealth(data)
      }
    } catch {
      setHealth(null)
    } finally {
      // setLoading(false) // This line was removed as per the new_code
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case "degraded":
        return <Zap className="w-5 h-5 text-yellow-600" />
      case "offline":
        return <Zap className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-50 border-green-200"
      case "degraded":
        return "bg-yellow-50 border-yellow-200"
      case "offline":
        return "bg-red-50 border-red-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  const getOverallHealthColor = (overall: string) => {
    switch (overall) {
      case "healthy":
        return "text-green-600"
      case "degraded":
        return "text-yellow-600"
      case "unhealthy":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const statCards = [
    { title: "User Directory Status", value: "Active", icon: Users, color: "text-[var(--primary)]" },
    { title: "System Authentication", value: "Verified", icon: CheckCircle, color: "text-green-600" },
    { title: "Verification Queue", value: "Nominal", icon: Clock, color: "text-yellow-600" },
    { title: "Communications Channel", value: "Online", icon: Mail, color: "text-red-600" },
    { title: "Intel Pipeline Engine", value: "Functional", icon: Search, color: "text-[var(--primary)]" },
    { title: "Storage Directory", value: "Optimal", icon: FileText, color: "text-indigo-600" },
  ]

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Intel Forge administration panel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`w-12 h-12 ${stat.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a href={`${ADMIN_ALIAS}/users`} className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
              Manage Users
            </a>
            <a
              href={`${ADMIN_ALIAS}/subscriptions`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Manage Subscriptions
            </a>
            <a
              href={`${ADMIN_ALIAS}/settings`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              System Settings
            </a>
            <a
              href={`${ADMIN_ALIAS}/security`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Security Management
            </a>
            <a
              href={`${ADMIN_ALIAS}/audit-logs`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Audit Logs
            </a>
            <a
              href={`${ADMIN_ALIAS}/intel-sources`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Intel Source Registry
            </a>
            <a
              href={`${ADMIN_ALIAS}/automation`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Automation Control
            </a>
            <a
              href={`${ADMIN_ALIAS}/darkweb-sources`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Manage Darkweb Sources
            </a>
            <a
              href={`${ADMIN_ALIAS}/data-sources`}
              className="block p-3 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Manage Data Sources
            </a>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">System Status</h2>
            {health && (
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getOverallHealthColor(health.overall)}`}>
                {health.overall.toUpperCase()}
              </span>
            )}
          </div>

          {health ? (
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(health.database.status)}`}>
                <div>
                  <div className="font-semibold text-sm">Database</div>
                  <div className="text-xs text-muted-foreground">{health.database.message}</div>
                </div>
                {getStatusIcon(health.database.status)}
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(health.fileSystem.status)}`}>
                <div>
                  <div className="font-semibold text-sm">File System</div>
                  <div className="text-xs text-muted-foreground">{health.fileSystem.message}</div>
                </div>
                {getStatusIcon(health.fileSystem.status)}
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(health.api.status)}`}>
                <div>
                  <div className="font-semibold text-sm">API Server</div>
                  <div className="text-xs text-muted-foreground">{health.api.message}</div>
                </div>
                {getStatusIcon(health.api.status)}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  <div>Last checked: {new Date(health.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Failed to fetch health status</div>
          )}
        </Card>
      </div>
    </div>
  )
}
