"use client"

import { useEffect, useState } from "react"
import { Clock, Trash2, Search, X, Loader2, Image } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HistoryEntry {
  id: number
  image_hash: string
  image_thumbnail: string | null
  query_url: string | null
  results_count: number
  top_matches: any
  search_time_ms: number
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onReSearch?: (entry: HistoryEntry) => void
}

export function FaceSearchHistoryPanel({ isOpen, onClose, onReSearch }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/search/face/history", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load history")
      const data = await res.json()
      setHistory(data.history || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await fetch(`/api/search/face/history?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      setHistory(prev => prev.filter(h => h.id !== id))
    } catch (err) {
      console.error("Failed to delete history entry:", err)
    } finally {
      setDeleting(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm("Delete all face search history?")) return
    try {
      await fetch("/api/search/face/history", {
        method: "DELETE",
        credentials: "include",
      })
      setHistory([])
    } catch (err) {
      console.error("Failed to clear history:", err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[#0f0c12] border-l border-[#2c2535] h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0f0c12]/95 backdrop-blur border-b border-[#2c2535] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Face Search History</h2>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <Button
                onClick={handleClearAll}
                variant="ghost"
                size="sm"
                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Clear All
              </Button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No face search history yet</p>
            </div>
          )}

          {!loading && history.map((entry) => {
            const topMatch = entry.top_matches?.[0]
            const date = new Date(entry.created_at)

            return (
              <div
                key={entry.id}
                className="mb-3 bg-[#16111f] border border-[#2d2636] rounded-lg overflow-hidden hover:border-purple-500/30 transition-all"
              >
                <div className="flex gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-[#0f0c12] border border-[#2c2535] flex items-center justify-center overflow-hidden shrink-0">
                    {entry.image_thumbnail ? (
                      <img
                        src={entry.image_thumbnail}
                        alt="Search thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image className="w-6 h-6 text-zinc-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {entry.search_time_ms}ms
                      </span>
                    </div>

                    {entry.query_url && (
                      <p className="text-xs text-zinc-500 truncate mb-1" title={entry.query_url}>
                        URL: {entry.query_url.substring(0, 50)}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-purple-400 font-semibold">
                        {entry.results_count} result{entry.results_count !== 1 ? "s" : ""}
                      </span>
                      {topMatch && (
                        <span className="text-zinc-500 truncate">
                          Top: {(topMatch.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-[#2c2535]">
                  <button
                    onClick={() => onReSearch?.(entry)}
                    className="flex-1 py-2 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-1"
                  >
                    <Search className="w-3 h-3" /> Re-search
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                    className="flex-1 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1 border-l border-[#2c2535] disabled:opacity-50"
                  >
                    {deleting === entry.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
