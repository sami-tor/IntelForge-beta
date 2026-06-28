"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Eye,
  X,
  Mail,
  Globe
} from "lucide-react"

interface Alert {
  id: number
  alert_type: string
  severity: string
  title: string
  description: string
  source_info: any
  is_read: boolean
  is_dismissed?: boolean
  created_at: string
  item_type: string
  item_value: string
}

interface MonitoringAlertsDropdownProps {
  className?: string
}

export function MonitoringAlertsDropdown({ className }: MonitoringAlertsDropdownProps) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlerts()
    // Refresh every 60 seconds
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/user/monitoring?type=alerts', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const allAlerts = data.alerts || []
        setAlerts(allAlerts.slice(0, 5)) // Show only last 5
        setUnreadCount(allAlerts.filter((a: Alert) => !a.is_read && !a.is_dismissed).length)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/user/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_read', alertId })
      })
      fetchAlerts()
    } catch (error) {
      console.error('Error marking alert read:', error)
    }
  }

  const handleDismiss = async (alertId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/user/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'dismiss', alertId })
      })
      fetchAlerts()
    } catch (error) {
      console.error('Error dismissing alert:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      default: return 'text-blue-500'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '!' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="font-semibold">Monitoring Alerts</h4>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">No alerts</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your monitored items are safe
            </p>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-0 ${
                  !alert.is_read ? 'bg-primary/5' : ''
                }`}
                onClick={() => router.push('/dashboard/monitoring')}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${getSeverityColor(alert.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {alert.item_type === 'email' ? (
                        <Mail className="w-3 h-3" />
                      ) : (
                        <Globe className="w-3 h-3" />
                      )}
                      <span className="truncate">{alert.item_value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!alert.is_read && (
                      <button
                        onClick={(e) => handleMarkRead(alert.id, e)}
                        className="p-1 hover:bg-background rounded"
                        title="Mark as read"
                      >
                        <Eye className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDismiss(alert.id, e)}
                      className="p-1 hover:bg-background rounded"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/dashboard/monitoring')}
          className="justify-center"
        >
          <span>View All Alerts</span>
          <ExternalLink className="w-3 h-3 ml-1" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

