"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Plus, Database, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DataSource {
  id: number
  name: string
  type: string
  connection_string: string
  is_active: boolean
  created_at: string
}

export default function DataSourcesPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "postgresql",
    connection_string: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDataSources()
  }, [])

  const fetchDataSources = async () => {
    try {
      const response = await fetch("/api/admin/data-sources", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setDataSources(data.dataSources || [])
    } catch (error) {
      console.error("Failed to fetch data sources:", error)
      setDataSources([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/admin/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setFormData({ name: "", type: "postgresql", connection_string: "" })
        setShowAddForm(false)
        fetchDataSources()
      }
    } catch (error) {
      console.error("Failed to add data source:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this data source?")) return

    try {
      const response = await fetch(`/api/admin/data-sources?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        fetchDataSources()
      }
    } catch (error) {
      console.error("Failed to delete data source:", error)
    }
  }

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch("/api/admin/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, is_active: !isActive }),
      })

      if (response.ok) {
        fetchDataSources()
      }
    } catch (error) {
      console.error("Failed to toggle data source:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Sources</h1>
          <p className="text-muted-foreground mt-1">Manage database connections and file directories</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Data Source
        </Button>
      </div>

      {showAddForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Data Source</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My PostgreSQL Database"
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                required
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="file_directory">File Directory</option>
                <option value="remote_api">Remote API</option>
              </select>
            </div>

            <div>
              <Label htmlFor="connection_string">Connection String / Path</Label>
              <Input
                id="connection_string"
                value={formData.connection_string}
                onChange={(e) => setFormData({ ...formData, connection_string: e.target.value })}
                placeholder={
                  formData.type === "postgresql"
                    ? "postgresql://user:pass@host:5432/dbname"
                    : formData.type === "file_directory"
                      ? "C:\\data\\osint or /data/osint"
                      : "https://api.example.com/search"
                }
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.type === "postgresql" && "Format: postgresql://username:password@host:port/database"}
                {formData.type === "file_directory" && "Absolute path to directory containing data files"}
                {formData.type === "remote_api" && "URL to remote search API endpoint"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Data Source
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {dataSources.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Sources</h3>
            <p className="text-muted-foreground mb-4">Add your first data source to start searching</p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Data Source
            </Button>
          </div>
        ) : (
          dataSources.map((source) => (
            <div key={source.id} className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">{source.name}</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">{source.type}</span>
                    {source.is_active ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono break-all">{source.connection_string}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Added {new Date(source.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={source.is_active ? "outline" : "default"}
                    onClick={() => toggleActive(source.id, source.is_active)}
                  >
                    {source.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(source.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
