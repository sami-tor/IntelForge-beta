// ================================================
// GeoHeatmap — pure-SVG horizontal bar chart per
// country with ISO flag emoji. No deps, server-safe.
// ================================================
import { cn } from "@/lib/utils"

export interface GeoHeatmapEntry {
  country: string
  countryCode: string | null
  ransomware: number
  phishing: number
  darknet: number
  total: number
  riskScore: number
}

interface GeoHeatmapProps {
  data: GeoHeatmapEntry[]
  limit?: number
}

const SEVERITY_COLOR = (score: number): string => {
  if (score >= 80) return "#ef4444"
  if (score >= 60) return "#f97316"
  if (score >= 40) return "#eab308"
  if (score >= 20) return "#22c55e"
  return "#64748b"
}

function flag(code: string | null): string {
  if (!code || code.length !== 2) return "🌐"
  // Convert ISO code to regional indicator emoji
  const A = 0x1f1e6
  const a = "A".charCodeAt(0)
  return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a)
}

export function GeoHeatmap({ data, limit = 12 }: GeoHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No geographic intel captured yet.
      </div>
    )
  }

  const list = data.slice(0, limit)
  const maxTotal = Math.max(1, ...list.map((d) => d.total))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {list.map((entry) => {
          const pct = (entry.total / maxTotal) * 100
          const color = SEVERITY_COLOR(entry.riskScore)
          return (
            <div
              key={entry.country}
              className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <span className="text-lg" aria-hidden>{flag(entry.countryCode)}</span>
                <span className="text-sm font-medium truncate">{entry.country}</span>
              </div>
              <div className="col-span-7">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span>R: {entry.ransomware}</span>
                  <span>P: {entry.phishing}</span>
                  <span>D: {entry.darknet}</span>
                </div>
              </div>
              <div className="col-span-2 text-right">
                <p
                  className={cn("text-lg font-bold leading-none")}
                  style={{ color }}
                >
                  {entry.riskScore}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  risk
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>R: ransomware · P: phishing · D: dark-web</span>
        <span>Snapshot rolling 30 days</span>
      </div>
    </div>
  )
}
