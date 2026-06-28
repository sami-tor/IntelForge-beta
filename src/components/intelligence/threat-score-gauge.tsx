// ================================================
// ThreatScoreGauge — pure SVG, no client JS needed.
// Renders a 0-100 semi-circular dial with the score
// number, severity label and 24h delta arrow.
// ================================================
import { cn } from "@/lib/utils"

interface ThreatScoreGaugeProps {
  score: number
  severity: string
  delta24h?: number
  size?: number
}

const SEVERITY_COLORS: Record<string, { stroke: string; text: string; bg: string }> = {
  critical: { stroke: "#ef4444", text: "text-red-400",    bg: "bg-red-500/10" },
  high:     { stroke: "#f97316", text: "text-orange-400", bg: "bg-orange-500/10" },
  medium:   { stroke: "#eab308", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  low:      { stroke: "#22c55e", text: "text-green-400",  bg: "bg-green-500/10" },
  info:     { stroke: "#64748b", text: "text-slate-400",  bg: "bg-slate-500/10" },
}

export function ThreatScoreGauge({
  score,
  severity,
  delta24h = 0,
  size = 220,
}: ThreatScoreGaugeProps) {
  const palette = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0))

  // Semi-circle geometry
  const cx = size / 2
  const cy = size * 0.66
  const radius = size * 0.42
  const strokeWidth = size * 0.07

  // Arc path: 180° -> 360° (left to right semi-circle)
  const startAngle = Math.PI
  const endAngle = startAngle + Math.PI * (safeScore / 100)
  const arcEndX = cx + radius * Math.cos(endAngle)
  const arcEndY = cy + radius * Math.sin(endAngle)
  const trackEndX = cx + radius
  const trackEndY = cy

  const arcLargeFlag = safeScore > 50 ? 1 : 0

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.78}
        viewBox={`0 0 ${size} ${size * 0.78}`}
        role="img"
        aria-label={`Threat score ${safeScore} out of 100, severity ${severity}${
          delta24h !== 0 ? `, ${delta24h > 0 ? "up" : "down"} ${Math.abs(delta24h)} points vs 24 hours ago` : ""
        }`}
      >
        <title>Threat score: {safeScore}/100 ({severity})</title>
        <desc>
          Semi-circle gauge showing the global threat score on a 0 to 100 scale.
          Current value is {safeScore}, severity tier {severity}
          {delta24h !== 0 ? `, change of ${delta24h} points vs 24 hours ago` : ""}.
        </desc>
        {/* Background track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${trackEndX} ${trackEndY}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${arcLargeFlag} 1 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke={palette.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize={size * 0.26}
          fontWeight={700}
          fill="currentColor"
          className="fill-foreground"
        >
          {safeScore}
        </text>
        <text
          x={cx}
          y={cy + size * 0.08}
          textAnchor="middle"
          fontSize={size * 0.07}
          className="fill-muted-foreground uppercase tracking-widest"
        >
          /100
        </text>
      </svg>

      <div className="-mt-4 flex flex-col items-center gap-1">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
            palette.bg,
            palette.text,
          )}
          aria-hidden="true"
        >
          {severity}
        </span>
        {delta24h !== 0 && (
          <span
            className={cn(
              "text-xs font-medium",
              delta24h > 0 ? "text-red-400" : "text-green-400",
            )}
          >
            {delta24h > 0 ? "▲" : "▼"} {Math.abs(delta24h)} pts vs 24h ago
          </span>
        )}
        {delta24h === 0 && (
          <span className="text-xs text-muted-foreground">no change vs 24h ago</span>
        )}
      </div>
    </div>
  )
}
