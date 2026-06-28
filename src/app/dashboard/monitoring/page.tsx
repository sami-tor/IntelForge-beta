"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { 
  Loader2, 
  Mail, 
  Globe, 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  RefreshCw,
  Bell,
  BellOff,
  Shield,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DashboardNavbar from "@/components/dashboard-navbar"
import Footer from "@/components/footer"

interface MonitoredItem {
  id: number
  item_type: 'email' | 'domain'
  item_value: string
  is_verified: boolean
  verification_code?: string
  verification_expires?: string
  last_checked?: string
  last_found?: string
  found_count: number
  created_at: string
}

interface Alert {
  id: number
  alert_type: string
  severity: string
  title: string
  description: string
  source_info: any
  is_read: boolean
  created_at: string
  item_type: string
  item_value: string
}

export default function MonitoringPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  const [items, setItems] = useState<MonitoredItem[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingData, setLoadingData] = useState(true)
  const [checking, setChecking] = useState(false)
  
  // Add item form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addType, setAddType] = useState<'email' | 'domain'>('email')
  const [addValue, setAddValue] = useState('')
  const [adding, setAdding] = useState(false)
  
  // Verification
  const [verifyingItem, setVerifyingItem] = useState<number | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showVerificationCode, setShowVerificationCode] = useState<string | null>(null)
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && user.role !== 'admin') {
      fetchMonitoringData()
    }
  }, [user])

  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/user/monitoring', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch monitoring data')
      const data = await response.json()
      setItems(data.items || [])
      setAlerts(data.alerts || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleAddItem = async () => {
    if (!addValue.trim()) {
      setMessage({ type: 'error', text: 'Please enter a value' })
      return
    }

    setAdding(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemType: addType, itemValue: addValue.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add item')
      }

      setMessage({ type: 'success', text: data.message })
      
      if (data.verificationCode) {
        setShowVerificationCode(data.verificationCode)
      }
      
      setAddValue('')
      setShowAddForm(false)
      fetchMonitoringData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setAdding(false)
    }
  }

  const handleVerify = async (itemId: number) => {
    if (!verificationCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter the verification code' })
      return
    }

    setVerifying(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'verify', itemId, verificationCode: verificationCode.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setMessage({ type: 'success', text: 'Item verified successfully!' })
      setVerifyingItem(null)
      setVerificationCode('')
      fetchMonitoringData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async (itemId: number) => {
    try {
      const response = await fetch('/api/user/monitoring/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code')
      }

      setMessage({ type: 'success', text: data.message })
      
      if (data.verificationCode) {
        setShowVerificationCode(data.verificationCode)
      }
      
      fetchMonitoringData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Are you sure you want to remove this item from monitoring?')) return

    try {
      const response = await fetch(`/api/user/monitoring?id=${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to delete item')

      setMessage({ type: 'success', text: 'Item removed from monitoring' })
      fetchMonitoringData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  const handleCheckNow = async () => {
    setChecking(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/monitoring/check', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Check failed')
      }

      if (data.newAlerts > 0) {
        setMessage({ type: 'error', text: `⚠️ Found ${data.newAlerts} new alert(s)!` })
      } else {
        setMessage({ type: 'success', text: 'Check complete. No new threats detected.' })
      }

      fetchMonitoringData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setChecking(false)
    }
  }

  const handleMarkAlertRead = async (alertId: number) => {
    try {
      await fetch('/api/user/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_read', alertId })
      })
      fetchMonitoringData()
    } catch (error) {
      console.error('Error marking alert read:', error)
    }
  }

  const handleDismissAlert = async (alertId: number) => {
    try {
      await fetch('/api/user/monitoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'dismiss', alertId })
      })
      fetchMonitoringData()
    } catch (error) {
      console.error('Error dismissing alert:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Copied to clipboard!' })
    setTimeout(() => setMessage(null), 2000)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (user.role === 'admin') {
    return (
      <main className="min-h-screen bg-background">
        <DashboardNavbar />
        <div className="pt-16 pb-16 container mx-auto px-4 lg:px-8">
          <Card className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Monitoring Not Available</h2>
            <p className="text-muted-foreground">
              The monitoring feature is not available for admin accounts.
            </p>
          </Card>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardNavbar />
      <div className="pt-16 pb-16 container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Breach Monitoring
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor your emails and domains for data breaches in real-time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleCheckNow} 
              disabled={checking || items.filter(i => i.is_verified).length === 0}
              variant="outline"
            >
              {checking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check Now
            </Button>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <Card className={`mb-6 p-4 ${message.type === 'error' ? 'border-destructive bg-destructive/10' : 'border-green-500 bg-green-500/10'}`}>
            <div className="flex items-center justify-between">
              <p className={message.type === 'error' ? 'text-destructive' : 'text-green-600'}>
                {message.text}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setMessage(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Domain Verification Code Display */}
        {showVerificationCode && (
          <Card className="mb-6 p-6 border-primary bg-primary/5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Domain Verification Required
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a file named <code className="bg-muted px-2 py-1 rounded">intelforge-verify.txt</code> in your domain root containing this code:
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 bg-muted px-4 py-3 rounded text-2xl font-bold tracking-widest text-center text-primary">
                {showVerificationCode}
              </code>
              <Button variant="outline" onClick={() => copyToClipboard(showVerificationCode)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: <code>https://yourdomain.com/intelforge-verify.txt</code> should contain: <code>{showVerificationCode}</code>
            </p>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowVerificationCode(null)}>
              Dismiss
            </Button>
          </Card>
        )}

        {/* Add Item Modal */}
        {showAddForm && (
          <Card className="mb-6 p-6 border-primary">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Item to Monitor</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <Tabs value={addType} onValueChange={(v) => setAddType(v as 'email' | 'domain')}>
              <TabsList className="mb-4">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="domain" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Domain
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={addValue}
                      onChange={(e) => setAddValue(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      A verification code will be sent to this email address.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="domain">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="domain">Domain Name</Label>
                    <Input
                      id="domain"
                      type="text"
                      placeholder="example.com"
                      value={addValue}
                      onChange={(e) => setAddValue(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      You'll need to create a verification file on your domain to prove ownership.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddItem} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add & Verify'}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monitored Items */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Monitored Items
              </h2>

              {loadingData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No items being monitored yet.</p>
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 border rounded-lg ${
                        item.is_verified 
                          ? item.found_count > 0 
                            ? 'border-destructive bg-destructive/5' 
                            : 'border-green-500/30 bg-green-500/5'
                          : 'border-yellow-500/30 bg-yellow-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {item.item_type === 'email' ? (
                            <Mail className="w-5 h-5 text-primary mt-1" />
                          ) : (
                            <Globe className="w-5 h-5 text-primary mt-1" />
                          )}
                          <div>
                            <p className="font-semibold">{item.item_value}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.is_verified ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                                  <CheckCircle className="w-3 h-3" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  Pending Verification
                                </span>
                              )}
                              {item.found_count > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                                  <AlertTriangle className="w-3 h-3" />
                                  {item.found_count} breach(es) found
                                </span>
                              )}
                            </div>
                            {item.last_checked && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Last checked: {new Date(item.last_checked).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!item.is_verified && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setVerifyingItem(verifyingItem === item.id ? null : item.id)
                                  setVerificationCode('')
                                }}
                              >
                                Verify
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleResendCode(item.id)}
                              >
                                Resend
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Verification Form */}
                      {verifyingItem === item.id && !item.is_verified && (
                        <div className="mt-4 pt-4 border-t">
                          <Label htmlFor={`verify-${item.id}`}>
                            {item.item_type === 'email' 
                              ? 'Enter the verification code sent to your email:'
                              : 'Click verify after creating the verification file on your domain:'
                            }
                          </Label>
                          <div className="flex gap-2 mt-2">
                            <Input
                              id={`verify-${item.id}`}
                              placeholder="Enter code"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                              className="font-mono tracking-widest"
                              maxLength={8}
                            />
                            <Button onClick={() => handleVerify(item.id)} disabled={verifying}>
                              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                            </Button>
                          </div>
                          {item.item_type === 'domain' && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Make sure the file <code>intelforge-verify.txt</code> exists at your domain root with the verification code.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Alerts Panel */}
          <div>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Alerts
                  {unreadCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h2>
              </div>

              {loadingData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No alerts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll notify you when your monitored items are found in breaches.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-3 border rounded-lg ${
                        !alert.is_read ? 'bg-primary/5 border-primary/30' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-500' :
                            alert.severity === 'medium' ? 'text-yellow-500' :
                            'text-blue-500'
                          }`} />
                          <div>
                            <p className="font-medium text-sm">{alert.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {alert.item_value}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!alert.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleMarkAlertRead(alert.id)}
                              title="Mark as read"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDismissAlert(alert.id)}
                            title="Dismiss"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {alert.source_info?.matchCount && (
                        <p className="text-xs text-destructive mt-2">
                          Found in {alert.source_info.matchCount} location(s)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Info Card */}
            <Card className="p-6 mt-6">
              <h3 className="font-semibold mb-3">How It Works</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">1.</span>
                  Add your email or domain to monitor
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">2.</span>
                  Verify ownership (email code or domain file)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">3.</span>
                  We check our breach database 24/7
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">4.</span>
                  Get instant alerts when found
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}

