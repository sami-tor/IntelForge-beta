"use client"

import { useState } from "react"

export default function DemoCorpusActions() {
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  const run = async (method: "POST" | "DELETE") => {
    setLoading(true)
    setStatus("")
    try {
      const res = await fetch("/api/admin/demo-corpus", { method })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Request failed")
      setStatus(method === "POST" ? `Seeded ${json.seeded || 0} demo docs` : "Demo corpus cleared")
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button disabled={loading} onClick={() => run("POST")} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? "Working..." : "Seed safe demo corpus"}
        </button>
        <button disabled={loading} onClick={() => run("DELETE")} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
          Clear demo corpus
        </button>
        <a href="/api/admin/demo-corpus" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">View corpus JSON</a>
      </div>
      {status && <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{status}</div>}
    </div>
  )
}
