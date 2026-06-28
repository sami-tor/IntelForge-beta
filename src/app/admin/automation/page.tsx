"use client"

// ================================================
// /admin/automation
// Admin control panel for the automation layer.
// Lets admins trigger:
//   • The new full automation pipeline
//     (scoring + correlation + trends + briefing)
//   • Existing feed-sync flows (intel-sync,
//     darkweb-sync, monitoring) via the legacy
//     /api/admin/automation endpoint.
// ================================================
import { useEffect, useState } from "react"
import { Loader2, Play, RefreshCcw, CheckCircle2, XCircle, Clock, Cpu, Rss, Eye, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface AutomationRun {
  id: number
  runType: string
  status: string
  durationMs: number
  output: any
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export default function AdminAutomationPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRuns = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/automation/run", { credentials: "include" })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      setRuns(data.runs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [])

  const triggerRun = async () => {
    setRunning(true)
    setMessage(null)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""

      const res = await fetch("/api/admin/automation/run", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ csrfToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Run failed")
      setMessage(
        `Pipeline complete · score ${data.result?.threatScore?.score ?? "?"} · ${
          data.result?.correlation?.persisted ?? 0
        } clusters · ${data.result?.briefing?.headline ? "briefing generated" : "no briefing"}`,
      )
      loadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed")
    } finally {
      setRunning(false)
    }
  }

  // Legacy feed-sync controls (intel-sync / darkweb-sync / monitoring)
  const [feedAction, setFeedAction] = useState<string | null>(null)
  const triggerFeedAction = async (action: "intel-sync" | "darkweb-sync" | "monitoring") => {
    setFeedAction(action)
    setMessage(null)
    setError(null)
    try {
      const csrfRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Cache-Control": "no-cache" },
      })
      const csrfJson = await csrfRes.json().catch(() => ({} as any))
      const csrfToken = csrfJson?.csrfToken || csrfRes.headers.get("X-CSRF-Token") || ""

      const res = await fetch("/api/admin/automation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ action, csrfToken }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error || `Action ${action} failed`)
      setMessage(`Triggered ${action} successfully.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Action ${action} failed`)
    } finally {
      setFeedAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Cpu className="h-3.5 w-3.5" />
            Admin Tools
          </div>
          <h1 className="text-2xl font-bold mt-1">Automation Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Re-run threat scoring, correlation, trend capture and briefing generation on demand.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={triggerRun} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run pipeline now
          </Button>
        </div>
      </div>

      {(message || error) && (
        <Card className={`p-4 ${error ? "border-destructive" : "border-green-500"}`}>
          <p className={`text-sm ${error ? "text-destructive" : "text-green-600"}`}>
            {error ?? message}
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          What runs in a pipeline cycle
        </h2>
        <ol className="space-y-2 text-sm">
          <li className="flex items-start gap-3">
            <span className="rounded-full bg-primary/10 text-primary text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <p className="font-medium">Compute global threat score</p>
              <p className="text-xs text-muted-foreground">
                Aggregates KEV count, fresh CVEs, ransomware victims, exploits, phishing, malware and
                feed health into a 0–100 composite. Persisted as a snapshot.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="rounded-full bg-primary/10 text-primary text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <p className="font-medium">Cross-source correlation</p>
              <p className="text-xs text-muted-foreground">
                Walks recent CVEs and merges any matching exploits, news mentions and KEV flags into
                a single cluster row. Re-runnable, upserts on cluster key.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="rounded-full bg-primary/10 text-primary text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <p className="font-medium">Capture trend metrics</p>
              <p className="text-xs text-muted-foreground">
                Snapshots seven daily KPI counters and flags any metric whose delta crosses the
                emerging-threshold for that key.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="rounded-full bg-primary/10 text-primary text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">
              4
            </span>
            <div>
              <p className="font-medium">Generate executive briefing</p>
              <p className="text-xs text-muted-foreground">
                Produces a deterministic narrative + structured payload from steps 1–3 and stores it
                under the day's bucket. Surfaced on the user-facing Command Center.
              </p>
            </div>
          </li>
        </ol>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Manual feed-sync triggers
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Force-refresh the underlying intelligence feeds, dark-web sources or monitoring sweep.
          The full pipeline above already runs after the standard cron schedule.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={feedAction !== null}
            onClick={() => triggerFeedAction("intel-sync")}
          >
            {feedAction === "intel-sync" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Rss className="h-4 w-4 mr-1" />
            )}
            Sync all intel feeds
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={feedAction !== null}
            onClick={() => triggerFeedAction("darkweb-sync")}
          >
            {feedAction === "darkweb-sync" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            Sync dark-web sources
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={feedAction !== null}
            onClick={() => triggerFeedAction("monitoring")}
          >
            {feedAction === "monitoring" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Bell className="h-4 w-4 mr-1" />
            )}
            Run monitoring sweep
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recent runs
          </h2>
          <span className="text-xs text-muted-foreground">{runs.length} entries</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No runs yet. Trigger a pipeline run above or schedule the cron at{" "}
            <code className="bg-muted px-1 rounded">/api/cron/automation</code>.
          </p>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const isSuccess = r.status === "success"
              const isRunning = r.status === "running"
              return (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {isSuccess ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    ) : isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.runType}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            isSuccess
                              ? "border-green-500/30 bg-green-500/10 text-green-400"
                              : isRunning
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-red-500/30 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      {r.output?.threatScore && (
                        <p className="text-xs text-muted-foreground mt-1">
                          score {r.output.threatScore.score} ({r.output.threatScore.severity}) ·{" "}
                          {r.output.correlation?.persisted ?? 0} clusters ·{" "}
                          {r.output.trends?.captured ?? 0} trends ·{" "}
                          {r.output.briefing ? "briefing OK" : "no briefing"}
                        </p>
                      )}
                      {r.error && (
                        <p className="text-xs text-destructive mt-1 line-clamp-2">{r.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {new Date(r.startedAt).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
