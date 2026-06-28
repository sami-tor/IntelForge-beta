// ================================================
// Sparkline — tiny SVG line chart, no JS, no deps.
// Used inside trend cards on the Command Center.
// ================================================
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "currentColor",
}: SparklineProps) {
  if (!values || values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="No data"
      >
        <title>Sparkline (no data)</title>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  const stepX = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const path = `M ${points.join(" L ")}`

  // Soft fill below the line
  const lastX = (values.length - 1) * stepX
  const fillPath = `${path} L ${lastX.toFixed(2)},${height} L 0,${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Sparkline with ${values.length} data points, range ${min} to ${max}`}
    >
      <title>Sparkline: {values.length} points, range {min} to {max}</title>
      <path d={fillPath} fill={color} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
