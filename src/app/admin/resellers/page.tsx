"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import {
  Users, TrendingUp, DollarSign, Store, ShieldAlert, ArrowLeft,
  Search, Star
} from "lucide-react"
import Link from "next/link"
import { AdminSidebar } from "@/components/admin-sidebar"

interface ResellerStats {
  totalResellers: number
  activeResellers: number
  totalClients: number
  totalRevenue: number
  totalCommission: number
}

export default function AdminResellersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<ResellerStats>({
    totalResellers: 0, activeResellers: 0, totalClients: 0, totalRevenue: 0, totalCommission: 0,
  })
  const [resellers, setResellers] = useState<any[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) { router.push("/admin"); return }
    if (user?.role === "admin") fetchData()
  }, [user, loading])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/resellers", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setResellers(data.resellers || [])
        setStats(data.stats || stats)
      }
    } catch { /* silent */ }
    setPageLoading(false)
  }

  const filtered = resellers.filter((r: any) =>
    r.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (pageLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user || user.role !== "admin") return null

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-10 overflow-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-bold">Reseller Management</h1>
          <p className="mt-2 text-muted-foreground">Manage reseller partners, track commissions, and monitor client portfolios.</p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: "Total Resellers", value: stats.totalResellers, icon: Store, color: "text-primary" },
            { label: "Active Resellers", value: stats.activeResellers, icon: Star, color: "text-green-500" },
            { label: "Total Clients", value: stats.totalClients, icon: Users, color: "text-[var(--primary)]" },
            { label: "Total Revenue", value: `$${(stats.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "text-amber-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search resellers..."
            className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Resellers Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Reseller</th>
                  <th className="px-5 py-3 font-medium">Clients</th>
                  <th className="px-5 py-3 font-medium">MRR</th>
                  <th className="px-5 py-3 font-medium">Commission Rate</th>
                  <th className="px-5 py-3 font-medium">Total Commission</th>
                  <th className="px-5 py-3 font-medium">Domain</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((reseller: any) => (
                  <tr key={reseller.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{reseller.company_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{reseller.email}</p>
                    </td>
                    <td className="px-5 py-3">{reseller.client_count || 0}</td>
                    <td className="px-5 py-3">${(reseller.total_mrr || 0).toLocaleString()}</td>
                    <td className="px-5 py-3">{reseller.commission_percent || 0}%</td>
                    <td className="px-5 py-3 text-green-600">${(reseller.total_commission || 0).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      {reseller.custom_domain ? (
                        <span className={reseller.domain_verified ? "text-green-600" : "text-amber-500"}>
                          {reseller.custom_domain}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        reseller.is_active ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-600"
                      }`}>
                        {reseller.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No resellers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
