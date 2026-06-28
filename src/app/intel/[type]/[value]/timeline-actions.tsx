"use client"

import { useState } from "react"

export default function TimelineActions({ timelineExport, shareUrl }: { timelineExport: string; shareUrl: string }) {
  const [copied, setCopied] = useState(false)

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={timelineExport}
        download="entity-timeline.json"
        className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted"
      >
        Export timeline JSON
      </a>
      <button onClick={copyShareLink} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
        {copied ? "Link copied" : "Copy share link"}
      </button>
    </div>
  )
}
