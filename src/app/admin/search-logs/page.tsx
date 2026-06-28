"use client"

import { useEffect, useState } from "react"
import { Search, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchLog {
  id: number
  username: string
  user_type: string  // free, premium, api
  search_type: string  // web, api
  search_query: string
  ip_address: string
  results_count: number
  created_at: string
}

export default function SearchLogsPage() {
  const [logs, setLogs] = useState<SearchLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState("")

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/search-logs", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (error) {
      console.error("[v0] Failed to fetch search logs:", error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(
    (log) =>
      log.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.search_query.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.ip_address.includes(searchFilter),
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Search Logs</h1>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by username, query, or IP..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Search Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Search Query
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Results
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-foreground">{log.username}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          log.user_type === 'premium' || log.user_type === 'api' 
                            ? 'bg-green-500/20 text-green-600' 
                            : 'bg-gray-500/20 text-gray-600'
                        }`}>
                          {log.user_type || 'free'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          log.search_type === 'api' 
                            ? 'bg-[var(--sev-info)]/20 text-[var(--sev-info)]' 
                            : 'bg-[var(--sev-critical)]/20 text-[var(--sev-critical)]'
                        }`}>
                          {log.search_type || 'web'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        <span className="font-mono text-sm text-foreground">{log.search_query}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-sm text-muted-foreground">{log.ip_address}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-foreground">{log.results_count}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No search logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredLogs.length} of {logs.length} logs
      </div>
    </div>
  )
}
