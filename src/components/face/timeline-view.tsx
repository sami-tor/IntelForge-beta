"use client"

import { useMemo } from "react"
import { Calendar, User, MapPin } from "lucide-react"

interface TimelineResult {
  face_id: string
  identity_id?: string
  image_id: string
  score: number
  url?: string
  thumbnail_url?: string
  metadata?: {
    timestamp?: number
    country?: string
    source?: string
  }
  identity?: { id: number; name: string }
  threads_profile?: {
    username?: string
    full_name?: string
    profile_pic_url?: string
  }
}

interface Props {
  results: TimelineResult[]
  onSelectResult: (result: TimelineResult) => void
  sortMode: "score" | "timeline"
}

export function TimelineView({ results, onSelectResult, sortMode }: Props) {
  const sortedResults = useMemo(() => {
    if (sortMode !== "timeline") return results
    return [...results].sort((a, b) => {
      const aTs = a.metadata?.timestamp || 0
      const bTs = b.metadata?.timestamp || 0
      return bTs - aTs
    })
  }, [results, sortMode])

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, TimelineResult[]>()
    for (const r of sortedResults) {
      const ts = r.metadata?.timestamp
      const key = ts
        ? new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "Unknown Date"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries())
  }, [sortedResults])

  if (sortMode !== "timeline") return null

  return (
    <div className="mb-8">
      <div className="bg-[#141018] border border-[var(--mode-face)]/30 rounded-2xl p-6 mb-6">
        <h2 className="text-2xl font-semibold text-zinc-100 mb-2">Timeline View</h2>
        <p className="text-sm text-zinc-400">
          {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""} chronologically
        </p>
      </div>

      <div className="relative pl-8 border-l-2 border-[var(--mode-face)]/30 space-y-6">
        {grouped.map(([date, items]) => (
          <div key={date} className="relative">
            {/* Timeline dot + date */}
            <div className="absolute -left-[2.15rem] top-0 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-[#0b090f]" />
            </div>
            <div className="flex items-center gap-2 mb-3 -mt-1">
              <Calendar className="w-3.5 h-3.5 text-[var(--mode-face)]" />
              <span className="text-sm font-semibold text-[var(--mode-face)]">{date}</span>
              <span className="text-xs text-zinc-500">({items.length} result{items.length !== 1 ? "s" : ""})</span>
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((result, idx) => (
                <div
                  key={`${date}-${idx}`}
                  className="bg-[#16111f] border border-[#2d2636] rounded-lg overflow-hidden hover:border-[var(--mode-face)]/50 transition-all cursor-pointer group"
                  onClick={() => onSelectResult(result)}
                >
                  {/* Thumbnail */}
                  <div className="relative overflow-hidden h-32">
                    {result.thumbnail_url || result.url ? (
                      <img
                        src={result.thumbnail_url || result.url}
                        alt={result.face_id}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0f0c12] flex items-center justify-center">
                        <User className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-[var(--mode-face)]/90 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                      {(result.score * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2 space-y-1">
                    {result.identity && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-[var(--mode-face)] border border-purple-500/25 inline-block">
                        {result.identity.name}
                      </span>
                    )}
                    <p className="text-[10px] text-zinc-400 truncate">
                      {result.threads_profile?.username
                        ? `@${result.threads_profile.username}`
                        : result.identity_id || result.face_id?.substring(0, 16)}
                    </p>
                    {result.metadata?.country && (
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {result.metadata.country}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
