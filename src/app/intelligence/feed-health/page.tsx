import { getFeedHealth } from "@/lib/intel/feed-health"
import { Database, CheckCircle, Clock, AlertTriangle, HardDrive } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  healthy: "text-green-400 bg-green-500/10",
  stale: "text-yellow-400 bg-yellow-500/10",
  empty: "text-red-400 bg-red-500/10",
}

function timeAgo(d: string | null): string {
  if (!d) return "Never"
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h > 720) return `${Math.floor(h / 720)}mo ago`
  if (h > 48) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60000)}m ago`
}

const ICON_MAP: Record<string, React.ReactNode> = {}
// icons rendered inline via lucide names

export default async function FeedHealthPage() {
  const { feeds, summary } = await getFeedHealth()

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Intel Feed Health</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor data freshness and record counts across all {feeds.length} intelligence feeds
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-xs text-muted-foreground">Healthy Feeds</p>
          <p className="text-2xl font-bold text-green-400">{summary.healthy}</p>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-xs text-muted-foreground">Stale</p>
          <p className="text-2xl font-bold text-yellow-400">{summary.stale}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Empty</p>
          <p className="text-2xl font-bold text-red-400">{summary.empty}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold">{summary.totalRecords.toLocaleString()}</p>
        </div>
      </div>

      {/* Feed table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Feed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Records</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Newest Entry</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Last Sync</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {feeds.map((f) => (
                <tr key={f.feed} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{f.label}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground ml-5.5">{f.tableName}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-mono ${f.recordCount === 0 ? "text-red-400" : "text-foreground"}`}>
                      {f.recordCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] text-muted-foreground">
                    {timeAgo(f.newestEntry)}
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] text-muted-foreground">
                    {timeAgo(f.lastSync)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[9px] rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[f.status]}`}>
                      {f.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
