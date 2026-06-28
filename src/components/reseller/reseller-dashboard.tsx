"use client"

import { useState, useEffect } from "react"
import { Users, TrendingUp, DollarSign, Activity, Plus, BarChart3 } from "lucide-react"

interface ResellerStats {
  total: number
  active: number
  trial: number
  cancelled: number
  total_mrr: number
  total_commission: number
}

interface Client {
  id: number
  client_name: string
  client_email: string
  subscription_plan: string
  monthly_revenue: number
  commission_earned: number
  status: string
  joined_at: string
}

export function ResellerDashboard() {
  const [stats, setStats] = useState<ResellerStats | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [commissionHistory, setCommissionHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newClient, setNewClient] = useState({ client_name: "", client_email: "", subscription_plan: "", monthly_revenue: "" })
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/reseller/dashboard", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setClients(data.clients || [])
        setCommissionHistory(data.commissionHistory || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const addClient = async () => {
    if (!newClient.client_name) return
    setAdding(true)
    try {
      const res = await fetch("/api/reseller/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newClient,
          monthly_revenue: parseFloat(newClient.monthly_revenue) || 0,
        }),
      })
      if (res.ok) {
        setShowAdd(false)
        setNewClient({ client_name: "", client_email: "", subscription_plan: "", monthly_revenue: "" })
        fetchData()
      }
    } catch { /* silent */ }
    setAdding(false)
  }

  const updateStatus = async (clientId: number, status: string) => {
    try {
      await fetch("/api/reseller/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId, status }),
      })
      fetchData()
    } catch { /* silent */ }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading reseller dashboard...</div>

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Clients</span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold">{stats?.total || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.active || 0} active • {stats?.trial || 0} trial</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monthly Revenue</span>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-2 text-3xl font-bold">${(stats?.total_mrr || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">MRR from active clients</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Commission Earned</span>
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold">${(stats?.total_commission || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total to date</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cancelled</span>
            <Activity className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-bold">{stats?.cancelled || 0}</p>
          <p className="text-xs text-muted-foreground">Churned clients</p>
        </div>
      </div>

      {/* Commission History */}
      {commissionHistory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5" /> Commission History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium">New Clients</th>
                  <th className="pb-2 font-medium">Revenue</th>
                  <th className="pb-2 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {commissionHistory.map((row: any) => (
                  <tr key={row.month} className="border-b border-border/50">
                    <td className="py-2 font-medium">{row.month}</td>
                    <td className="py-2">{row.new_clients}</td>
                    <td className="py-2">${parseInt(row.revenue).toLocaleString()}</td>
                    <td className="py-2 text-green-600">${parseInt(row.commission).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Clients
          </h3>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">MRR</th>
                <th className="px-5 py-3 font-medium">Commission</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                  <td className="px-5 py-3">
                    <p className="font-medium">{client.client_name}</p>
                    {client.client_email && <p className="text-xs text-muted-foreground">{client.client_email}</p>}
                  </td>
                  <td className="px-5 py-3">{client.subscription_plan || "—"}</td>
                  <td className="px-5 py-3">${(client.monthly_revenue || 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-green-600">${(client.commission_earned || 0).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      client.status === "active" ? "bg-green-500/20 text-green-600" :
                      client.status === "trial" ? "bg-blue-500/20 text-blue-600" :
                      client.status === "cancelled" ? "bg-red-500/20 text-red-600" :
                      "bg-gray-500/20 text-gray-600"
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(client.joined_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <select
                      value={client.status}
                      onChange={e => updateStatus(client.id, e.target.value)}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="inactive">Inactive</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No clients yet. Add your first client to start earning commissions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold">Add Client</h2>
            <input type="text" value={newClient.client_name}
              onChange={e => setNewClient(p => ({ ...p, client_name: e.target.value }))}
              placeholder="Client / Company name" autoFocus
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="email" value={newClient.client_email}
              onChange={e => setNewClient(p => ({ ...p, client_email: e.target.value }))}
              placeholder="Client email (optional)"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="text" value={newClient.subscription_plan}
              onChange={e => setNewClient(p => ({ ...p, subscription_plan: e.target.value }))}
              placeholder="Subscription plan"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="number" value={newClient.monthly_revenue}
              onChange={e => setNewClient(p => ({ ...p, monthly_revenue: e.target.value }))}
              placeholder="Monthly revenue ($)"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button onClick={addClient} disabled={adding || !newClient.client_name}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {adding ? "Adding..." : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
