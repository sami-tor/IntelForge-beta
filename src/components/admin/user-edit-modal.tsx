"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"

interface User {
  id: number
  email: string
  username: string
  role: string
  verification_status: string
  subscription_type: string
  is_active: boolean
}

interface UserEditModalProps {
  user: User
  onClose: () => void
  onUpdate: () => void
}

export function UserEditModal({ user, onClose, onUpdate }: UserEditModalProps) {
  const [role, setRole] = useState(user.role)
  const [verification, setVerification] = useState(user.verification_status)
  const [isActive, setIsActive] = useState(user.is_active)
  const [subscriptionType, setSubscriptionType] = useState(user.subscription_type)
  const [durationValue, setDurationValue] = useState<number>(1)
  const [durationUnit, setDurationUnit] = useState<string>("month")
  const [isLifetime, setIsLifetime] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
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
        console.error("[v0] Failed to fetch CSRF token:", error)
      }
    }
    fetchCsrfToken()
  }, [])

  const makeRequest = async (action: string, value: any) => {
    if (!csrfToken) {
      setError("CSRF token not available. Please refresh the page.")
      return { success: false }
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({ 
          userId: user.id, 
          action, 
          value,
          csrfToken, // Also include in body as fallback
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Failed to update ${action}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (err: any) {
      setError(err.message || "Failed to update user")
      return { success: false, error: err.message }
    }
  }

  const handleUpdateRole = async () => {
    return await makeRequest("role", role)
  }

  const handleUpdateVerification = async () => {
    return await makeRequest("verification", verification)
  }

  const handleUpdateStatus = async () => {
    return await makeRequest("status", isActive)
  }

  const handleUpdateSubscription = async () => {
    return await makeRequest("subscription", {
      subscriptionType,
      durationValue: isLifetime ? null : durationValue,
      durationUnit: isLifetime ? null : durationUnit,
      isLifetime,
    })
  }

  const handleSave = async () => {
    if (!csrfToken) {
      setError("CSRF token not available. Please refresh the page.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const results = await Promise.all([
        handleUpdateRole(),
        handleUpdateVerification(),
        handleUpdateStatus(),
        handleUpdateSubscription(),
      ])

      const hasError = results.some(r => !r.success)
      if (hasError) {
        setError("Some updates failed. Please check the errors and try again.")
        return
      }

      onUpdate()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to save changes")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Edit User: {user.username}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <Label>Verification Status</Label>
            <select
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <Label>Account Status</Label>
            <select
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <Label>Subscription Type</Label>
            <select
              value={subscriptionType}
              onChange={(e) => {
                const selectedPlan = e.target.value
                setSubscriptionType(selectedPlan)
                
                // Auto-set duration based on plan
                if (selectedPlan === "free") {
                  setIsLifetime(false)
                  setDurationValue(1)
                  setDurationUnit("month")
                } else if (selectedPlan === "starter") {
                  setIsLifetime(false)
                  setDurationValue(1)
                  setDurationUnit("month")
                } else if (selectedPlan === "professional") {
                  setIsLifetime(false)
                  setDurationValue(1)
                  setDurationUnit("month")
                } else if (selectedPlan === "enterprise") {
                  setIsLifetime(true)
                } else if (selectedPlan === "api_access") {
                  setIsLifetime(true)
                }
              }}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="free">Free (50 searches/month)</option>
              <option value="starter">Starter - $50/month (500 searches)</option>
              <option value="professional">Professional - $300/month (1500 searches)</option>
              <option value="enterprise">Enterprise - Contact (Unlimited)</option>
              <option value="api_access">API Access - Contact (Unlimited + API)</option>
            </select>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={isLifetime} 
                onChange={(e) => setIsLifetime(e.target.checked)}
                disabled={subscriptionType === "enterprise" || subscriptionType === "api_access"}
              />
              Lifetime Subscription
              {(subscriptionType === "enterprise" || subscriptionType === "api_access") && (
                <span className="text-xs text-muted-foreground">(Always lifetime)</span>
              )}
            </Label>
          </div>

          {!isLifetime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration Value</Label>
                <Input
                  type="number"
                  value={durationValue}
                  onChange={(e) => setDurationValue(Number.parseInt(e.target.value))}
                  className="mt-1"
                  min={1}
                />
              </div>
              <div>
                <Label>Duration Unit</Label>
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSave} 
              className="flex-1" 
              disabled={loading || !csrfToken}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
