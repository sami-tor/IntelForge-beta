import Link from "next/link"
import { getDarknetPosts, getDarknetStats } from "@/lib/intel/fetchers/darknet-monitor"
import { Eye, Skull, Users, Building, ExternalLink, Globe, MessageSquare } from "lucide-react"

export const dynamic = "force-dynamic"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-green-400 bg-green-500/10 border-green-500/20",
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-green-500",
}

export default async function DarknetMonitorPage() {
  const [posts, stats] = await Promise.all([
    getDarknetPosts(100),
    getDarknetStats(),
  ])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dark Web Leak Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregated ransomware blog and dark web forum posts — track victim disclosures, data leaks, and threat actor claims
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Posts</p>
          <p className="text-2xl font-bold">{stats.totalPosts}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Critical Leaks</p>
          <p className="text-2xl font-bold text-red-400">{stats.criticalLeaks}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Groups</p>
          <p className="text-2xl font-bold text-purple-400">{stats.activeGroups}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Last 24h</p>
          <p className="text-2xl font-bold text-orange-400">{stats.recent24h}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" /> Ahmia Onions
          </p>
          <p className="text-2xl font-bold text-blue-400">{stats.ahmiaOnions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Telegram
          </p>
          <p className="text-2xl font-bold text-cyan-400">{stats.telegramPosts}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Forum Posts</p>
          <p className="text-2xl font-bold text-green-400">{stats.forumPosts}</p>
        </div>
      </div>

      {/* Top Sectors */}
      {stats.topSectors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Targeted Sectors</p>
          <div className="flex flex-wrap gap-2">
            {stats.topSectors.map((s) => (
              <span key={s.sector} className="text-xs rounded-full px-3 py-1 bg-muted/30 text-muted-foreground">
                {s.sector} ({s.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-2">
        {posts.map((post) => (
          <div key={post.postUid}
            className={`rounded-lg border p-3 hover:border-primary/30 transition-colors ${
              post.severity ? SEVERITY_COLOR[post.severity]?.split(" ")[2] || "border-border" : "border-border"
            } bg-card`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {post.severity && (
                  <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[post.severity] || "bg-muted"}`} />
                )}
                <span className="text-sm font-medium text-foreground truncate">{post.title || post.threatActor || "Unknown"}</span>
              </div>
              <span className={`text-[9px] rounded px-1.5 py-0.5 font-medium ${
                post.severity ? SEVERITY_COLOR[post.severity] || "" : ""
              }`}>
                {post.severity?.toUpperCase() || "MEDIUM"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {post.threatActor && (
                <Link href={`/intelligence/threat-actors?q=${encodeURIComponent(post.threatActor)}`}
                  className="flex items-center gap-0.5 text-[9px] text-purple-400 hover:text-purple-300 hover:underline transition-colors">
                  <Skull className="h-2.5 w-2.5" /> {post.threatActor}
                </Link>
              )}
              {post.victimName && (
                <Link href={`/intelligence/ransomware?q=${encodeURIComponent(post.victimName)}`}
                  className="flex items-center gap-0.5 text-[9px] text-orange-400 hover:text-orange-300 hover:underline transition-colors">
                  <Building className="h-2.5 w-2.5" /> {post.victimName}
                </Link>
              )}
              {post.victimSector && (
                <span className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">{post.victimSector}</span>
              )}
              {post.victimCountry && (
                <span className="text-[9px] text-muted-foreground ml-auto">{post.victimCountry}</span>
              )}
            </div>

            {post.content && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{post.content}</p>
            )}

            <p className="text-[9px] text-muted-foreground mt-2">
              {new Date(post.discoveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No dark web posts cached yet. Run a feed sync to populate.</p>
        </div>
      )}
    </div>
  )
}
