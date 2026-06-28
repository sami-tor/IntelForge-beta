// ================================================
// ForecastChart — historical points + predicted
// path with shaded confidence interval. Pure SVG.
// ================================================
interface ForecastPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

interface HistoryPoint {
  date: string
  value: number
}

interface ForecastChartProps {
  history: HistoryPoint[]
  forecast: ForecastPoint[]
  width?: number
  height?: number
}

export function ForecastChart({
  history,
  forecast,
  width = 380,
  height = 110,
}: ForecastChartProps) {
  const all = [
    ...history.map((h) => h.value),
    ...forecast.map((f) => f.upper),
    ...forecast.map((f) => f.lower),
  ]
  if (all.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="hsl(var(--border))"
          strokeDasharray="2 2"
        />
      </svg>
    )
  }
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = Math.max(1, max - min)
  const padTop = 8
  const padBottom = 18
  const padLeft = 4
  const padRight = 4
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const totalPoints = history.length + forecast.length
  const stepX = totalPoints > 1 ? chartW / (totalPoints - 1) : chartW

  const yOf = (v: number) => padTop + chartH - ((v - min) / range) * chartH
  const xOf = (i: number) => padLeft + i * stepX

  // History line
  const histPath = history
    .map((h, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(h.value).toFixed(2)}`)
    .join(" ")

  // Forecast line — starts where history ends
  const transitionX = history.length > 0 ? xOf(history.length - 1) : 0
  const transitionY = history.length > 0 ? yOf(history[history.length - 1].value) : yOf(forecast[0]?.predicted ?? 0)
  const fcPath =
    history.length > 0
      ? `M ${transitionX.toFixed(2)} ${transitionY.toFixed(2)} ` +
        forecast
          .map((f, i) => `L ${xOf(history.length + i).toFixed(2)} ${yOf(f.predicted).toFixed(2)}`)
          .join(" ")
      : forecast
          .map((f, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(f.predicted).toFixed(2)}`)
          .join(" ")

  // Confidence band polygon
  const upperPts = forecast.map((f, i) => `${xOf(history.length + i).toFixed(2)},${yOf(f.upper).toFixed(2)}`)
  const lowerPts = forecast
    .map((f, i) => `${xOf(history.length + i).toFixed(2)},${yOf(f.lower).toFixed(2)}`)
    .reverse()
  const bandPoints = [...upperPts, ...lowerPts].join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Forecast chart with ${history.length} historical and ${forecast.length} predicted points`}
    >
      <title>Forecast chart</title>
      <desc>
        {history.length} historical points followed by {forecast.length} forecasted
        points with a shaded ±1.96σ confidence interval.
      </desc>
      {/* Confidence band */}
      {forecast.length > 0 && (
        <polygon points={bandPoints} fill="hsl(var(--primary))" fillOpacity={0.12} />
      )}
      {/* History line */}
      <path d={histPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
      {/* Forecast line */}
      <path
        d={fcPath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {/* Divider between past and future */}
      {history.length > 0 && forecast.length > 0 && (
        <line
          x1={transitionX}
          y1={padTop}
          x2={transitionX}
          y2={padTop + chartH}
          stroke="hsl(var(--border))"
          strokeDasharray="2 2"
        />
      )}
      {/* Axis labels (sparse) */}
      <text
        x={padLeft}
        y={height - 4}
        fontSize={9}
        fill="hsl(var(--muted-foreground))"
      >
        {history[0]?.date.slice(5) || ""}
      </text>
      <text
        x={width - padRight}
        y={height - 4}
        fontSize={9}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
      >
        {forecast[forecast.length - 1]?.date.slice(5) || history[history.length - 1]?.date.slice(5) || ""}
      </text>
    </svg>
  )
}
