"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Mail, Settings, Save, AlertCircle, CheckCircle } from "lucide-react"

interface SMTPSettings {
  host: string
  port: number
  username: string
  password: string
  sender: string
  senderName: string
  tlsEnabled: boolean
}

interface SystemSettings {
  searchQuotaFree: number
  maxResultsPerFile: number
  maxTotalResults: number
  maintenanceMode: boolean
}

export default function AdminSettings() {
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: "mail.osintsearch.online",
    port: 585,
    username: "sender@osintsearch.online",
    password: "",
    sender: "sender@osintsearch.online",
    senderName: "Intel Forge",
    tlsEnabled: true,
  })

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    searchQuotaFree: 50,
    maxResultsPerFile: 5,
    maxTotalResults: 10000,
    maintenanceMode: false,
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [testingSMTP, setTestingSMTP] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        if (data.smtp) setSmtpSettings(data.smtp)
        if (data.system) setSystemSettings(data.system)
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    }
  }

  const saveSMTPSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ section: "smtp", data: smtpSettings }),
      })

      if (response.ok) {
        setMessage("SMTP settings saved successfully!")
        setMessageType("success")
      } else {
        setMessage("Failed to save SMTP settings")
        setMessageType("error")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error saving settings")
      setMessageType("error")
    } finally {
      setLoading(false)
    }
  }

  const saveSystemSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ section: "system", data: systemSettings }),
      })

      if (response.ok) {
        setMessage("System settings saved successfully!")
        setMessageType("success")
      } else {
        setMessage("Failed to save system settings")
        setMessageType("error")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error saving settings")
      setMessageType("error")
    } finally {
      setLoading(false)
    }
  }

  const testSMTP = async () => {
    setTestingSMTP(true)
    try {
      const response = await fetch("/api/admin/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(smtpSettings),
      })

      if (response.ok) {
        setMessage("Test email sent successfully!")
        setMessageType("success")
      } else {
        setMessage("Failed to send test email")
        setMessageType("error")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error testing SMTP")
      setMessageType("error")
    } finally {
      setTestingSMTP(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">System Settings</h1>
        <p className="text-muted-foreground">Configure SMTP, quotas, and system options</p>
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

      {/* SMTP Configuration */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6" />
          <h2 className="text-2xl font-bold">SMTP Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">SMTP Host</label>
            <Input
              value={smtpSettings.host}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
              placeholder="mail.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">SMTP Port</label>
            <Input
              type="number"
              value={smtpSettings.port}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
              placeholder="585"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <Input
              value={smtpSettings.username}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              value={smtpSettings.password}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sender Email</label>
            <Input
              value={smtpSettings.sender}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, sender: e.target.value })}
              placeholder="sender@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sender Name</label>
            <Input
              value={smtpSettings.senderName}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, senderName: e.target.value })}
              placeholder="Your App Name"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={smtpSettings.tlsEnabled}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, tlsEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Enable TLS/SSL</span>
          </label>
        </div>

        <div className="flex gap-4">
          <Button onClick={saveSMTPSettings} disabled={loading} className="bg-[var(--primary)] hover:brightness-110">
            <Save className="w-4 h-4 mr-2" /> Save SMTP Settings
          </Button>
          <Button onClick={testSMTP} disabled={testingSMTP} variant="outline">
            {testingSMTP ? "Testing..." : "Test Email"}
          </Button>
        </div>
      </Card>

      {/* System Settings */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Search & System Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Free User Monthly Quota</label>
            <Input
              type="number"
              value={systemSettings.searchQuotaFree}
              onChange={(e) => setSystemSettings({ ...systemSettings, searchQuotaFree: parseInt(e.target.value) })}
              placeholder="50"
            />
            <p className="text-xs text-muted-foreground mt-1">Searches per month for free users</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Max Results Per File</label>
            <Input
              type="number"
              value={systemSettings.maxResultsPerFile}
              onChange={(e) => setSystemSettings({ ...systemSettings, maxResultsPerFile: parseInt(e.target.value) })}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum results per file for free users</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Max Total Results</label>
            <Input
              type="number"
              value={systemSettings.maxTotalResults}
              onChange={(e) => setSystemSettings({ ...systemSettings, maxTotalResults: parseInt(e.target.value) })}
              placeholder="10000"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum total results per search</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 bg-yellow-50/10 border border-yellow-500/20 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={systemSettings.maintenanceMode}
              onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium">Maintenance Mode</span>
              <p className="text-xs text-muted-foreground">Disable search for all users except admins</p>
            </div>
          </label>
          {systemSettings.maintenanceMode && <Badge variant="destructive">ACTIVE</Badge>}
        </div>

        <Button onClick={saveSystemSettings} disabled={loading} className="bg-[var(--primary)] hover:brightness-110">
          <Save className="w-4 h-4 mr-2" /> Save System Settings
        </Button>
      </Card>
    </div>
  )
}
