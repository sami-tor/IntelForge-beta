"use client"

// ================================================
// /intelligence/action-queue
// ------------------------------------------------
// Live action queue — auto-generated tasks from
// correlation clusters and anomalies. Analysts
// can mark items in_progress / done / dismissed.
// ================================================
import { useEffect, useState } from "react"
import {
  Loader2,
  CheckCircle2,
  Clock,
  ListChecks,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Filter,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface ActionComment {
  id: number
  authorName: string | null
  body: string
  createdAt: string
}
interface ActionAuditEntry {
  id: number
  actorName: string | null
  event: string
  fromValue: string | null
  toValue: string | null
  createdAt: string
}

interface ActionItem {
  id: number
  actionKey: string
  title: string
  description: string
  category: string
  priority: number
  severity: string
  sourceType: string
  sourceRef: string | null
  suggestedSteps: string[]
  metadata: Record<string, unknown>
  status: string
  assignedTo?: number | null
  createdAt: string
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

const CATEGORY_BADGE: Record<string, string> = {
  patch: "bg-red-500/10 text-red-400",
  hunt: "bg-purple-500/10 text-purple-400",
  block: "bg-orange-500/10 text-orange-400",
  review: "bg-blue-500/10 text-blue-400",
  drill: "bg-green-500/10 text-green-400",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ActionQueuePage() {
  const [filter, setFilter] = useState<"open" | "in_progress" | "done" | "all">("open")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("")
  const [severityFilter, setSeverityFilter] = useState<string>("")
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [commentsOpen, setCommentsOpen] = useState<number | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [commentsByAction, setCommentsByAction] = useState<Record<number, ActionComment[]>>({})
  const [auditByAction, setAuditByAction] = useState<Record<number, ActionAuditEntry[]>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: filter,
        limit: "100",
      })
      if (search.trim()) params.set("search", search.trim())
      if (categoryFilter) params.set("category", categoryFilter)
      if (severityFilter) params.set("severity", severityFilter)
      const res = await fetch(`/api/intel/automation/actions?${params.toString()}`, {
        credentials: "include",
      })
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    setSelected(new Set())
  }, [filter, categoryFilter, severityFilter])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({}) as any)
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""

      const res = await fetch("/api/intel/automation/actions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ id, status, csrfToken }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      // ignore - rely on UI to retry
    } finally {
      setUpdating(null)
    }
  }

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const selectAll = () =>
    setSelected(new Set(items.map((i) => i.id)))
  const clearSelection = () => setSelected(new Set())

  const bulkUpdate = async (status: string) => {
    if (selected.size === 0) return
    setBulkBusy(true)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({}) as any)
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      await fetch("/api/intel/automation/actions/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ ids: [...selected], status, csrfToken }),
      })
      clearSelection()
      await load()
    } finally {
      setBulkBusy(false)
    }
  }

  const openComments = async (id: number) => {
    setCommentsOpen(id)
    setCommentDraft("")
    try {
      const res = await fetch(`/api/intel/automation/actions/${id}/comments`, {
        credentials: "include",
      })
      const data = await res.json()
      setCommentsByAction((p) => ({ ...p, [id]: data.comments || [] }))
      setAuditByAction((p) => ({ ...p, [id]: data.audit || [] }))
    } catch {
      // ignore
    }
  }

  const submitComment = async () => {
    if (commentsOpen === null || !commentDraft.trim()) return
    const id = commentsOpen
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({}) as any)
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""
      const res = await fetch(`/api/intel/automation/actions/${id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ body: commentDraft.trim(), csrfToken }),
      })
      if (res.ok) {
        setCommentDraft("")
        await openComments(id)
      }
    } catch {
      // ignore
    }
  }

  const counts = {
    open: items.filter((i) => i.status === "open").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Automation Layer
          </div>
          <h1 className="text-2xl font-bold mt-1">Action Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated tasks ranked by priority. Triggered by correlation clusters and trend anomalies.
          </p>
        </div>
        <Link
          href="/intelligence/command-center"
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors w-fit"
        >
          ← Command Center
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Filter:
        </div>
        {(
          [
            { v: "open", label: `Open (${counts.open})` },
            { v: "in_progress", label: `In progress (${counts.inProgress})` },
            { v: "done", label: "Done" },
            { v: "all", label: "All" },
          ] as const
        ).map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              filter === f.v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
            aria-pressed={filter === f.v}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground sr-only" htmlFor="aq-search">Search</label>
        <input
          id="aq-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or description…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <label className="text-xs text-muted-foreground sr-only" htmlFor="aq-cat">Category</label>
        <select
          id="aq-cat"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All categories</option>
          <option value="patch">patch</option>
          <option value="hunt">hunt</option>
          <option value="block">block</option>
          <option value="review">review</option>
          <option value="drill">drill</option>
        </select>
        <label className="text-xs text-muted-foreground sr-only" htmlFor="aq-sev">Severity</label>
        <select
          id="aq-sev"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All severities</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
          <option value="info">info</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center gap-2"
        >
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdate("in_progress")} disabled={bulkBusy}>
            Start
          </Button>
          <Button size="sm" onClick={() => bulkUpdate("done")} disabled={bulkBusy}>
            Mark done
          </Button>
          <Button size="sm" variant="ghost" onClick={() => bulkUpdate("dismissed")} disabled={bulkBusy}>
            Dismiss
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy}>
            Clear
          </Button>
          {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} actions in the queue.</p>
          <p className="text-xs text-muted-foreground mt-1">
            New actions appear automatically when the next pipeline cycle runs.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const isExpanded = expanded.has(item.id)
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <label className="pt-1 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary focus:ring-2 focus:ring-primary/40"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select action ${item.id}`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                          SEVERITY_BADGE[item.severity] || SEVERITY_BADGE.medium
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          CATEGORY_BADGE[item.category] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        from {item.sourceType}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mt-2 leading-snug">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.createdAt)}
                      </span>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="text-primary hover:underline"
                      >
                        {isExpanded ? "Hide steps" : `${item.suggestedSteps.length} suggested steps`}
                      </button>
                      <button
                        onClick={() => openComments(item.id)}
                        className="text-primary hover:underline"
                      >
                        Comments
                      </button>
                    </div>

                    {isExpanded && item.suggestedSteps.length > 0 && (
                      <ol className="mt-3 space-y-1.5 text-sm list-decimal list-inside marker:text-primary">
                        {item.suggestedSteps.map((s, i) => (
                          <li key={i} className="text-muted-foreground">
                            {s}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold leading-none">{item.priority}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                        priority
                      </p>
                    </div>
                    {item.status === "open" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(item.id, "in_progress")}
                          disabled={updating === item.id}
                        >
                          {updating === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(item.id, "dismissed")}
                          disabled={updating === item.id}
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {item.status === "in_progress" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatus(item.id, "done")}
                          disabled={updating === item.id}
                        >
                          {updating === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(item.id, "open")}
                          disabled={updating === item.id}
                          title="Reopen"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {(item.status === "done" || item.status === "dismissed") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatus(item.id, "open")}
                        disabled={updating === item.id}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {commentsOpen !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-title"
        >
          <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 id="comments-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Action #{commentsOpen} · comments &amp; audit
              </h2>
              <button
                onClick={() => setCommentsOpen(null)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {(commentsByAction[commentsOpen] || []).length === 0 && (auditByAction[commentsOpen] || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comments yet. Be the first to add one.
                </p>
              )}
              {(commentsByAction[commentsOpen] || []).map((c) => (
                <div key={`c-${c.id}`} className="border-l-2 border-primary pl-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.authorName || "anonymous"}</span>
                    <span className="ml-2">{new Date(c.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              {(auditByAction[commentsOpen] || []).slice(0, 8).map((a) => (
                <div key={`a-${a.id}`} className="text-xs text-muted-foreground border-l-2 border-muted pl-3">
                  <span className="font-medium">{a.actorName || "system"}</span>{" "}
                  {a.event === "status_change" ? `changed status ${a.fromValue || "—"} → ${a.toValue || "—"}` : a.event}
                  <span className="ml-2">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border space-y-2">
              <label className="sr-only" htmlFor="comment-input">Add a comment</label>
              <textarea
                id="comment-input"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCommentsOpen(null)}>Close</Button>
                <Button onClick={submitComment} disabled={!commentDraft.trim()}>
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
