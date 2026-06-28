// ================================================
// /intelligence/briefings
// Archive of auto-generated executive briefings.
// Server-rendered, instant load.
// ================================================
import Link from "next/link"
import { BookOpen, Cpu, Download } from "lucide-react"
import { listBriefings } from "@/lib/intel/automation/briefing-generator"

export const dynamic = "force-dynamic"
export const revalidate = 0

const LEVEL_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-slate-500/15 text-slate-400 border-slate-500/30",
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function BriefingsPage() {
  const briefings = await listBriefings(60)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Cpu className="h-3.5 w-3.5" />
            Automation Layer
          </div>
          <h1 className="text-2xl font-bold mt-1">Executive Briefings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated daily summaries with threat level, key drivers and recommended actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/intel/automation/briefings/export"
            className="text-xs px-3 py-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Latest as PDF
          </a>
          <Link
            href="/intelligence/command-center"
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors"
          >
            ← Back to Command Center
          </Link>
        </div>
      </div>

      {briefings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No briefings generated yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            They appear automatically once the automation cron runs at least once.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b, i) => (
            <article
              key={`${b.briefingType}-${b.periodStart}-${i}`}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                      LEVEL_BADGE[b.threatLevel] || LEVEL_BADGE.medium
                    }`}
                  >
                    {b.threatLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(b.periodEnd)}</span>
                  <span className="text-xs text-muted-foreground">
                    · score <span className="font-semibold text-foreground">{b.threatScore}/100</span>
                  </span>
                </div>
              </div>

              <h2 className="font-semibold text-base mt-2 leading-snug">{b.headline}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{b.summary}</p>

              {b.highlights.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                    Highlights
                  </p>
                  <ul className="space-y-1 text-sm">
                    {b.highlights.slice(0, 4).map((h, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>
                          <span className="font-medium">{h.title}</span>
                          <span className="text-muted-foreground"> — {h.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {b.recommendations.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                    Recommendations
                  </p>
                  <ul className="space-y-1 text-sm list-disc list-inside marker:text-primary">
                    {b.recommendations.slice(0, 3).map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
