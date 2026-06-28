"use client"

// ================================================
// LiveScoreIndicator — connects to the SSE endpoint
// at /api/intel/automation/stream and shows a tiny
// pulsing badge that flips green/yellow based on
// connection state.
// ================================================
import { useEffect, useState } from "react"
import { Radio } from "lucide-react"

export function LiveScoreIndicator() {
  const [connected, setConnected] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let mounted = true
    try {
      es = new EventSource("/api/intel/automation/stream")
      es.addEventListener("score", (event: MessageEvent) => {
        if (!mounted) return
        try {
          const parsed = JSON.parse(event.data)
          if (parsed?.snapshot?.score != null) {
            setScore(Number(parsed.snapshot.score))
          }
          if (parsed?.timestamp) setUpdatedAt(parsed.timestamp)
        } catch {
          // ignore malformed
        }
      })
      es.onopen = () => setConnected(true)
      es.onerror = () => setConnected(false)
    } catch {
      setConnected(false)
    }

    return () => {
      mounted = false
      try {
        es?.close()
      } catch {
        // ignore
      }
    }
  }, [])

  return (
    <span
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
        connected
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
      }`}
      title={
        updatedAt
          ? `SSE last update ${new Date(updatedAt).toLocaleTimeString()}`
          : "Server-Sent Events stream"
      }
    >
      <Radio className={`h-3 w-3 ${connected ? "animate-pulse" : ""}`} />
      {connected ? "Live SSE" : "Reconnecting"}
      {score != null && <span className="font-semibold">· {score}</span>}
    </span>
  )
}
