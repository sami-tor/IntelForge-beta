"use client"

import { useEffect, useState } from "react"
import { AdminProtected } from "@/components/admin-protected"
import { Key, Loader2, Plus, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

interface APIKey {
  id: number
  user_id: number
  username: string
  key: string
  name: string
  is_active: boolean
  last_used: string | null
  created_at: string
  rate_limit: number
}

interface NewKeyForm {
  userId: number
  keyName: string
  expiresInDays: number
}

export default function APIKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyForm, setNewKeyForm] = useState<NewKeyForm>({
    userId: 0,
    keyName: "",
    expiresInDays: 365,
  })
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/api-keys", {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch API keys: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      
      // Ensure data.keys is an array
      if (Array.isArray(data.keys)) {
        setKeys(data.keys)
      } else if (Array.isArray(data)) {
        setKeys(data)
      } else {
        console.warn("Unexpected API response format:", data)
        setKeys([])
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error)
      setKeys([]) // Set empty array on error to prevent crashes
    } finally {
      setLoading(false)
    }
  }

  const generateKey = async () => {
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newKeyForm),
      })
      if (!response.ok) throw new Error("Failed to generate API key")
      const data = await response.json()
      setGeneratedKey(data.key)
      setShowNewKeyForm(false)
      fetchKeys()
    } catch (error) {
      console.error("Failed to generate API key:", error)
    }
  }

  const toggleKeyVisibility = (keyId: number) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const revokeKey = async (keyId: number) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return

    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to revoke API key")
      fetchKeys()
    } catch (error) {
      console.error("Failed to revoke API key:", error)
    }
  }

  return (
    <AdminProtected>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6" />
              API Key Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage API keys for premium users
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchKeys} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setShowNewKeyForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Generate Key
            </Button>
          </div>
        </div>

        {/* Generated Key Display */}
        {generatedKey && (
          <Card className="p-6 mb-6 bg-green-500/10 border-green-500/30">
            <h3 className="font-semibold mb-2 text-green-600">✅ API Key Generated Successfully!</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Copy this key now - it won't be shown again!
            </p>
            <div className="flex gap-2">
              <Input
                value={generatedKey}
                readOnly
                className="font-mono text-sm bg-background"
              />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey)
                  alert("API key copied to clipboard!")
                }}
                variant="outline"
              >
                Copy
              </Button>
              <Button onClick={() => setGeneratedKey(null)}>
                Done
              </Button>
            </div>
          </Card>
        )}

        {/* New Key Form */}
        {showNewKeyForm && (
          <Card className="p-6 mb-6">
            <h3 className="font-semibold mb-4">Generate New API Key</h3>
            <div className="space-y-4">
              <div>
                <Label>User ID</Label>
                <Input
                  type="number"
                  value={newKeyForm.userId || ""}
                  onChange={(e) =>
                    setNewKeyForm({ ...newKeyForm, userId: parseInt(e.target.value) || 0 })
                  }
                  placeholder="Enter user ID"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Key Name</Label>
                <Input
                  value={newKeyForm.keyName}
                  onChange={(e) => setNewKeyForm({ ...newKeyForm, keyName: e.target.value })}
                  placeholder="e.g., Production API Key"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Expires In (Days)</Label>
                <Input
                  type="number"
                  value={newKeyForm.expiresInDays}
                  onChange={(e) =>
                    setNewKeyForm({ ...newKeyForm, expiresInDays: parseInt(e.target.value) || 365 })
                  }
                  placeholder="365"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={generateKey} className="flex-1">
                  Generate
                </Button>
                <Button
                  onClick={() => setShowNewKeyForm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* API Keys List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Key Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      API Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Rate Limit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keys.length > 0 ? (
                    keys.map((key) => (
                      <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium">{key.username || `User #${key.user_id}`}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm">{key.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {visibleKeys.has(key.id) 
                                ? (key.key || 'N/A') 
                                : (key.key ? `${key.key.slice(0, 8)}...***` : 'N/A')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleKeyVisibility(key.id)}
                            >
                              {visibleKeys.has(key.id) ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm">{key.rate_limit} req/min</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {key.last_used
                              ? new Date(key.last_used).toLocaleString()
                              : "Never"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              key.is_active
                                ? "bg-green-500/20 text-green-600"
                                : "bg-red-500/20 text-red-600"
                            }`}
                          >
                            {key.is_active ? "Active" : "Revoked"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeKey(key.id)}
                            disabled={!key.is_active}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        No API keys found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {keys.length} API key{keys.length !== 1 ? "s" : ""}
        </div>
      </div>
    </AdminProtected>
  )
}

