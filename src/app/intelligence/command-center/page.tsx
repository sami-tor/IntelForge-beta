// ================================================
// /intelligence/command-center
// ------------------------------------------------
// Live, server-rendered dashboard:
//   • Global Threat Score gauge + history
//   • Today's executive briefing (with PDF export)
//   • Top correlated threat clusters
//   • Emerging trend cards with sparklines
//   • 7-day forecasts for tracked KPIs
//   • Anomaly alerts
//   • Geographic threat heatmap + sector index
//   • Top of the auto-generated action queue
// All data comes from local cache only.
// ================================================
import Link from "next/link"
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  Cpu,
  Download,
  Factory,
  GitBranch,
  Globe,
  Layers,
  ListChecks,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react"
import { ThreatScoreGauge } from "@/components/intelligence/threat-score-gauge"
import { Sparkline } from "@/components/intelligence/sparkline"
import { ForecastChart } from "@/components/intelligence/forecast-chart"
import { GeoHeatmap } from "@/components/intelligence/geo-heatmap"
import { LiveScoreIndicator } from "@/components/intelligence/live-score-indicator"
import { getLatestThreatScore, getThreatScoreHistory } from "@/lib/intel/automation/threat-score"
import { getTopClusters } from "@/lib/intel/automation/correlator"
import { getTrendSeries } from "@/lib/intel/automation/trends"
import { getLatestBriefing } from "@/lib/intel/automation/briefing-generator"
import { getForecasts, listAnomalies } from "@/lib/intel/automation/forecast"
import { getLatestGeoSnapshot, getLatestSectorSnapshot } from "@/lib/intel/automation/geo-sector"
import { listActions } from "@/lib/intel/automation/action-queue"

export const dynamic = "force-dynamic"
export const revalidate = 0

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

function formatRelative(d: string | Date | null) {
  if (!d) return "—"
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function CommandCenterPage() {
  const [score, history, clusters, trends, briefing, forecastMap, anomalies, geo, sectors, actions] =
    await Promise.all([
      getLatestThreatScore(),
      getThreatScoreHistory(168),
      getTopClusters(8),
      getTrendSeries(14),
      getLatestBriefing("daily"),
      getForecasts(),
      listAnomalies(8),
      getLatestGeoSnapshot(15),
      getLatestSectorSnapshot(10),
      listActions("open", 5),
    ])

  const scoreSeries = history.map((h) => h.score)
  const automationFresh = score
    ? Date.now() - new Date(history[history.length - 1]?.computedAt || 0).getTime() < 6 * 60 * 60 * 1000
    : false

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Cpu className="h-3.5 w-3.5" />
            Automation Layer
          </div>
          <h1 className="text-2xl font-bold mt-1">Threat Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-computed every cycle from cached intelligence — no human in the loop.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveScoreIndicator />
          <span
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              automationFresh
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
            }`}
          >
            <Activity className={`h-3 w-3 ${automationFresh ? "animate-pulse" : ""}`} />
            {automationFresh ? "Live" : "Stale"}
            {history.length > 0 && (
              <span className="text-[10px] opacity-75">
                · {formatRelative(history[history.length - 1]?.computedAt)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/intelligence/action-queue"
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Action queue</span>
            </Link>
            <Link
              href="/intelligence/briefings"
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Archive</span>
            </Link>
            <a
              href="/api/intel/automation/briefings/export"
              className="text-xs px-3 py-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </div>
        </div>
      </div>

      {/* Top row: gauge + briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat score gauge */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
          {score ? (
            <>
              <ThreatScoreGauge score={score.score} severity={score.severity} delta24h={score.delta24h} />
              <div className="mt-4 w-full">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 text-center">
                  Score · last 7 days
                </p>
                <div className="flex justify-center text-primary">
                  <Sparkline values={scoreSeries.length ? scoreSeries : [score.score]} width={220} height={36} />
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No score computed yet.
              <br />
              <span className="text-xs">
                Trigger <code>/api/cron/automation</code> or wait for the next cycle.
              </span>
            </div>
          )}
        </div>

        {/* Today's briefing */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Today's executive briefing
              </h2>
            </div>
            {briefing && (
              <span className="text-xs text-muted-foreground">
                {formatRelative(briefing.periodEnd)}
              </span>
            )}
          </div>

          {briefing ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold leading-tight">{briefing.headline}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{briefing.summary}</p>

              {briefing.highlights.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    Key highlights
                  </p>
                  <ul className="space-y-1.5">
                    {briefing.highlights.slice(0, 5).map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                            h.severity === "critical" || h.severity === "high"
                              ? "bg-red-400"
                              : h.severity === "medium"
                                ? "bg-yellow-400"
                                : "bg-green-400"
                          }`}
                        />
                        <span>
                          <span className="font-medium">{h.title}</span>
                          <span className="text-muted-foreground"> — {h.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {briefing.recommendations.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    Recommended actions
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-sm marker:text-primary">
                    {briefing.recommendations.slice(0, 4).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No briefing generated yet. Run the automation pipeline to produce today's report.
            </div>
          )}
        </div>
      </div>

      {/* Score drivers */}
      {score && score.drivers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              What is driving the score
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {score.drivers.map((d, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-md border border-border bg-background"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trends */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Live trend metrics · 14 day window
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {trends.filter((t) => t.isEmerging).length} emerging
          </span>
        </div>

        {trends.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No trend data captured yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {trends.map((t) => (
              <div
                key={t.key}
                className={`rounded-xl border p-4 bg-card transition-colors ${
                  t.isEmerging ? "border-orange-500/40 bg-orange-500/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground leading-tight">
                    {t.label}
                  </p>
                  {t.isEmerging && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-semibold uppercase tracking-wider shrink-0">
                      Emerging
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold mt-1">{t.current.toLocaleString()}</p>
                <div className="flex items-center justify-between mt-2">
                  <span
                    className={`text-xs font-medium ${
                      t.deltaPct > 0
                        ? "text-red-400"
                        : t.deltaPct < 0
                          ? "text-green-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {t.deltaPct > 0 ? "▲" : t.deltaPct < 0 ? "▼" : "—"}{" "}
                    {Math.abs(t.deltaPct).toFixed(1)}%
                  </span>
                  <div className="text-primary">
                    <Sparkline values={t.series.map((p) => p.value)} width={70} height={22} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top correlation clusters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Auto-correlated threat clusters
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{clusters.length} active</span>
        </div>

        {clusters.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No clusters surfaced yet — run the automation pipeline.
          </div>
        ) : (
          <div className="space-y-2.5">
            {clusters.map((c) => {
              const cveId = c.signals?.cve?.cveId
              return (
                <div
                  key={c.clusterKey}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                            SEVERITY_BADGE[c.severity] || SEVERITY_BADGE.medium
                          }`}
                        >
                          {c.severity}
                        </span>
                        {c.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold text-sm mt-1.5 truncate">{c.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {c.signalCount} signals
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatRelative(c.lastSeen)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-3xl font-bold leading-none">{c.riskScore}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                        risk
                      </p>
                      {cveId && (
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${cveId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                        >
                          {cveId}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top action queue preview */}
      {actions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Action queue · top 5 open
              </h2>
            </div>
            <Link
              href="/intelligence/action-queue"
              className="text-xs text-primary hover:underline"
            >
              Open queue →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {actions.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                        SEVERITY_BADGE[a.severity] || SEVERITY_BADGE.medium
                      }`}
                    >
                      {a.severity}
                    </span>
                    <h3 className="text-sm font-medium mt-1.5 line-clamp-2 leading-snug">{a.title}</h3>
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">{a.priority}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                  {a.description}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest">
                  {a.category} · {a.sourceType}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecasts + anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                7-day forecasts
              </h2>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Holt's exponential smoothing
            </span>
          </div>
          {trends.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
              No data series yet. Forecasts appear after a few cycles.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trends.slice(0, 4).map((trend) => {
                const fc = forecastMap.get(trend.key) || []
                if (fc.length === 0) return null
                const lastFc = fc[fc.length - 1]
                const direction = lastFc.predicted > trend.current ? "up" : lastFc.predicted < trend.current ? "down" : "flat"
                return (
                  <div key={trend.key} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{trend.label}</p>
                      <span
                        className={`text-[10px] font-semibold ${
                          direction === "up"
                            ? "text-red-400"
                            : direction === "down"
                              ? "text-green-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {direction === "up" ? "▲" : direction === "down" ? "▼" : "—"} {lastFc.predicted}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ForecastChart history={trend.series} forecast={fc} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                      <span>now: {trend.current.toLocaleString()}</span>
                      <span>+7d: {lastFc.predicted.toLocaleString()} ± {(lastFc.upper - lastFc.predicted)}</span>
                      <span>conf {lastFc.confidence}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Anomalies
            </h2>
          </div>
          {anomalies.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
              Nothing unusual right now.
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                        SEVERITY_BADGE[a.severity] || SEVERITY_BADGE.medium
                      }`}
                    >
                      {a.severity} · {a.direction}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      z = {a.zScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1.5">{a.metricLabel || a.metricKey}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {a.explanation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Geographic + sector risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Geographic threat heatmap
            </h2>
          </div>
          <GeoHeatmap data={geo} limit={12} />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Factory className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Sector risk index
            </h2>
          </div>
          {sectors.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
              No sector data yet.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {sectors.slice(0, 8).map((s) => {
                const color =
                  s.riskScore >= 80
                    ? "#ef4444"
                    : s.riskScore >= 60
                      ? "#f97316"
                      : s.riskScore >= 40
                        ? "#eab308"
                        : "#22c55e"
                return (
                  <div key={s.sector} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.sector}</p>
                      <p className="text-[10px] text-muted-foreground">
                        R: {s.ransomwareVictims} · P: {s.phishingTargets} · D: {s.darknetMentions}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold leading-none" style={{ color }}>
                        {s.riskScore}
                      </p>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        risk
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-3 text-xs text-muted-foreground">
        <Activity className="h-4 w-4 text-primary shrink-0" />
        <span>
          The Command Center re-runs scoring, correlation, trend capture, forecasting,
          anomaly detection, geo/sector indexing, action generation, briefing creation
          and notification dispatch every cycle. All reads served from the local cache.
        </span>
      </div>
    </div>
  )
}
