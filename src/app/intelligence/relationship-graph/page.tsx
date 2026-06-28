"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Search, ZoomIn, ZoomOut, Maximize, AlertTriangle, Layers, X, ArrowRight, GitBranch, Info, Filter, ChevronDown, ChevronUp, Link2, Target, Zap } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

const TYPE_LABEL: Record<string, string> = {
  actor: "Threat Actor", campaign: "Campaign", cve: "Vulnerability", exploit: "Exploit (PoC)",
  malware: "Malware", technique: "Technique", sector: "Target Sector", source: "Data Source",
  finding: "Intel Record", alert: "Alert", case: "Case", report: "Report",
  victim: "Victim", ip: "IP Address", stealer: "Stealer Family", product: "Product", domain: "Domain",
}

const TC = {
  actor: { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-300", hex: "#f97316" },
  campaign: { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-300", hex: "#a855f7" },
  cve: { bg: "bg-red-500/10", border: "border-red-500/40", text: "text-red-300", hex: "#ef4444" },
  exploit: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-300", hex: "#f59e0b" },
  malware: { bg: "bg-pink-500/10", border: "border-pink-500/40", text: "text-pink-300", hex: "#ec4899" },
  technique: { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-300", hex: "#3b82f6" },
  sector: { bg: "bg-teal-500/10", border: "border-teal-500/40", text: "text-teal-300", hex: "#14b8a6" },
  source: { bg: "bg-green-500/10", border: "border-green-500/40", text: "text-green-300", hex: "#22c55e" },
  finding: { bg: "bg-sky-500/10", border: "border-sky-500/40", text: "text-sky-300", hex: "#38bdf8" },
  alert: { bg: "bg-yellow-500/10", border: "border-yellow-500/40", text: "text-yellow-300", hex: "#f59e0b" },
  case: { bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-300", hex: "#0ea5e9" },
  report: { bg: "bg-indigo-500/10", border: "border-indigo-500/40", text: "text-indigo-300", hex: "#6366f1" },
  victim: { bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-300", hex: "#0ea5e9" },
  ip: { bg: "bg-green-500/10", border: "border-green-500/40", text: "text-green-300", hex: "#22c55e" },
  stealer: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-300", hex: "#f59e0b" },
  product: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-300", hex: "#f59e0b" },
  domain: { bg: "bg-indigo-500/10", border: "border-indigo-500/40", text: "text-indigo-300", hex: "#6366f1" },
}

const EC: Record<string, string> = {
  exploits: "#ef4444", "exploited by": "#ef4444", "exploited": "#ef4444",
  uses: "#ec4899", deploys: "#ec4899", weaponizes: "#ec4899", infects: "#ec4899",
  targets: "#f97316", "victim of": "#f97316", "associated with": "#f97316", "attributed to": "#f97316",
  "controls C2": "#f97316", "beacons to": "#ec4899", "C2 for": "#22c55e",
  affects: "#ef4444", "targeted by": "#ef4444",
  "compromised by": "#f59e0b", harvest: "#f59e0b", "harvests from": "#f59e0b", "captures from": "#f59e0b",
  "has PoC": "#f59e0b", launched: "#a855f7", mentions: "#64748b",
  demo: "#38bdf8", breach: "#ef4444", ioc: "#f59e0b", vulnerability: "#ef4444",
  stealer: "#f59e0b", apt: "#a855f7", ransomware: "#ef4444", phishing: "#ec4899",
  combolist: "#f59e0b", correlation: "#a855f7", cloud_exposure: "#3b82f6", forum_post: "#64748b",
}

function edgeColor(label: string) {
  for (const key of Object.keys(EC)) {
    if (label.toLowerCase().includes(key)) return EC[key]
  }
  return "#64748b"
}

function getSeverityColor(severity?: string) {
  switch (severity) {
    case "critical": return { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/50" }
    case "high": return { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/50" }
    case "medium": return { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/50" }
    default: return { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/50" }
  }
}

const ALL_TYPES = ["actor", "campaign", "cve", "exploit", "malware", "technique", "sector", "source", "finding", "alert", "case", "report", "victim", "ip", "stealer", "product", "domain"]

interface Node {
  id: string; label: string; type: string; color: string; hex: string
  size: number; severity?: string; riskScore?: number
  x: number; y: number; connections: number
}

interface Edge {
  source: string; target: string; label: string; color: string
}

export default function RelationshipGraphPage() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("focus") || "")
  const [loading, setLoading] = useState(false)
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [error, setError] = useState("")
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [visibleTypes, setVisibleTypes] = useState<string[]>(ALL_TYPES)
  const [showMentions, setShowMentions] = useState(false)
  const [edgeFilter, setEdgeFilter] = useState("")
  const [svgSize, setSvgSize] = useState({ w: 900, h: 600 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panCurrentRef = useRef({ x: 0, y: 0 })

  const fetchGraph = useCallback(async (focus?: string) => {
    setLoading(true); setError("")
    try {
      const url = focus
        ? `/api/intel/relationship-graph?focus=${encodeURIComponent(focus)}&limit=80`
        : `/api/intel/relationship-graph?limit=80`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        setNodes(json.data.nodes || [])
        setEdges(json.data.edges || [])
        setSelectedNode(null)
      } else {
        setError(json.error || "Failed to load graph")
      }
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const focus = searchParams.get("focus") || ""
    if (focus) setQuery(focus)
    fetchGraph(focus)
  }, [searchParams, fetchGraph])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSvgSize({ w: el.clientWidth, h: Math.max(400, el.clientWidth * 0.62) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel listener for zoom (preventDefault requires non-passive)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      setZoom(z => Math.max(0.5, Math.min(3, z + delta)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Compute layout positions for nodes
  const positionedNodes = useMemo(() => {
    const visible = nodes.filter(n => visibleTypes.includes(n.type))
    if (visible.length === 0) return []

    const W = svgSize.w; const H = svgSize.h
    const cx = W / 2; const cy = H / 2

    // Sort: highly-connected nodes first
    const sorted = [...visible].sort((a, b) => {
      const ca = edges.filter(e => e.source === a.id || e.target === a.id).length
      const cb = edges.filter(e => e.source === b.id || e.target === b.id).length
      return cb - ca
    })

    const n = sorted.length

    // Force-directed layout simulation for better spacing
    // Initialize with circular layout, then run simulation
    const minDist = 80 // minimum distance between nodes
    const positions: Map<string, { x: number; y: number; vx: number; vy: number }> = new Map()

    // Initialize: spread in a circle
    sorted.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const radius = n <= 5 ? 80 : n <= 15 ? Math.min(W, H) * 0.2 : Math.min(W, H) * 0.35
      positions.set(node.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0, vy: 0
      })
    })

    // Simple force simulation: repulsion between all nodes, attraction along edges
    for (let iter = 0; iter < 60; iter++) {
      const cooling = 1 - iter / 60 // temperature decreases over time
      const repulsionStrength = 2000 * cooling
      const attractionStrength = 0.01

      // Repulsion: every pair of nodes pushes apart
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = positions.get(sorted[i].id)!
          const b = positions.get(sorted[j].id)!
          let dx = b.x - a.x
          let dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsionStrength / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx -= fx; a.vy -= fy
          b.vx += fx; b.vy += fy
        }
      }

      // Attraction: connected nodes pull together
      for (const edge of edges) {
        const a = positions.get(edge.source)
        const b = positions.get(edge.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = minDist * 2.5
        const force = (dist - idealDist) * attractionStrength
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx; a.vy += fy
        b.vx -= fx; b.vy -= fy
      }

      // Apply velocities with damping
      for (const node of sorted) {
        const p = positions.get(node.id)!
        p.x += p.vx * cooling * 0.5
        p.y += p.vy * cooling * 0.5
        p.vx *= 0.5
        p.vy *= 0.5
        // Keep within bounds
        const margin = 50
        p.x = Math.max(margin, Math.min(W - margin, p.x))
        p.y = Math.max(margin, Math.min(H - margin, p.y))
      }
    }

    const result: Node[] = sorted.map(node => {
      const p = positions.get(node.id)!
      const conns = edges.filter(e => e.source === node.id || e.target === node.id).length
      return {
        ...node,
        hex: TC[node.type as keyof typeof TC]?.hex || "#64748b",
        connections: conns,
        x: p.x,
        y: p.y,
      }
    })

    return result
  }, [nodes, edges, visibleTypes, svgSize])

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(positionedNodes.map(n => n.id))
    return edges.filter(edge => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false
      if (!showMentions && edge.label === "mentions") return false
      const q = edgeFilter.trim().toLowerCase()
      if (q && !edge.label.toLowerCase().includes(q)) return false
      return true
    })
  }, [edges, positionedNodes, showMentions, edgeFilter])

  const nodeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of positionedNodes) counts[n.type] = (counts[n.type] || 0) + 1
    return counts
  }, [positionedNodes])

  const selectedConnections = useMemo(() =>
    selectedNode ? visibleEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id) : [],
    [selectedNode, visibleEdges])

  // Find attack chain paths (actor→exploits→cve, actor→uses→malware, actor→targets→victim)
  const attackPaths = useMemo(() => {
    const paths: Array<{ nodes: Node[]; edges: Edge[]; label: string }> = []
    const seen = new Set<string>()

    for (const edge of visibleEdges) {
      if (!["exploits", "uses", "targets", "deploys", "weaponizes", "infects", "controls C2", "C2 for", "harvests from"].includes(edge.label)) continue
      const src = positionedNodes.find(n => n.id === edge.source)
      const tgt = positionedNodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue

      const key = `${src.label}→${edge.label}→${tgt.label}`
      if (seen.has(key)) continue
      seen.add(key)
      paths.push({ nodes: [src, tgt], edges: [edge], label: edge.label })
    }
    return paths.slice(0, 15)
  }, [visibleEdges, positionedNodes])

  const toggleType = (type: string) => {
    setVisibleTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const getNode = (id: string) => positionedNodes.find(n => n.id === id)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-purple-400" />
            </div>
            Entity Relationship Graph
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {positionedNodes.length} entities · {visibleEdges.length} connections · click nodes to explore
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-semibold">
            {attackPaths.length} attack paths
          </span>
        </div>
      </div>

      {/* Focus Bar */}
      <div className="flex gap-2">
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchGraph(query)}
          placeholder="Focus on actor, CVE, campaign... (e.g., DEMO-APT-01, CVE-2026-99001)"
          className="flex-1 h-10 pl-4 pr-4 rounded-lg border border-[#2c2535] bg-[#0f0c12] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <button onClick={() => fetchGraph(query)} disabled={loading}
          className="h-10 px-5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 disabled:opacity-50 flex items-center gap-2">
          {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
          Focus
        </button>
        <button onClick={() => { setQuery(""); setVisibleTypes(ALL_TYPES); setShowMentions(false); setEdgeFilter(""); fetchGraph() }}
          className="h-10 px-4 rounded-lg border border-[#2c2535] text-sm hover:bg-[#1a1523]">
          Reset
        </button>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filters */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map(type => {
            const cfg = TC[type as keyof typeof TC]
            const count = nodeCounts[type] || 0
            const active = visibleTypes.includes(type)
            if (count === 0 && !active) return null
            return (
              <button key={type} onClick={() => toggleType(type)}
                className={`text-[10px] rounded-full px-2.5 py-0.5 border font-semibold uppercase tracking-wider transition-all ${active ? `${cfg?.bg} ${cfg?.border} ${cfg?.text}` : "border-[#2c2535] text-zinc-600 bg-transparent opacity-40"}`}>
                {TYPE_LABEL[type] || type} {count > 0 && `(${count})`}
              </button>
            )
          })}
        </div>

        {/* Mention edges toggle */}
        <button
          onClick={() => setShowMentions(v => !v)}
          className={`text-[10px] rounded-full px-3 py-1 border font-semibold transition-all ${showMentions ? "bg-zinc-500/20 border-zinc-500/40 text-zinc-300" : "border-[#2c2535] text-zinc-600 bg-transparent opacity-50"}`}>
          <Filter className="w-3 h-3 inline mr-1" />
          {showMentions ? "Showing mentions" : "Hide mentions"}
        </button>

        {/* Edge filter */}
        <input
          type="text" value={edgeFilter}
          onChange={e => setEdgeFilter(e.target.value)}
          placeholder="Filter relations: exploits, targets, uses..."
          className="h-9 px-3 rounded-lg border border-[#2c2535] bg-[#0f0c12] text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500/30 w-56"
        />
        {edgeFilter && <button onClick={() => setEdgeFilter("")} className="h-9 px-3 rounded-lg border border-[#2c2535] text-zinc-500 hover:bg-[#1a1523]"><X className="w-3 h-3" /></button>}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
            <span className="text-sm text-zinc-500" role="status">Loading intelligence graph...</span>
          </div>
        </div>
      )}

      {!loading && positionedNodes.length === 0 && !error && (
        <div className="text-center py-20">
          <GitBranch className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
          <p className="text-lg font-semibold text-zinc-400">No entities found</p>
          <p className="text-sm text-zinc-600 mt-2">Try a different focus query or enable more filters</p>
        </div>
      )}

      {/* ─── MAIN SVG GRAPH ─── */}
      {!loading && positionedNodes.length > 0 && (
        <div className="space-y-4">
          {/* Graph Canvas */}
          <div ref={containerRef} className="relative rounded-2xl border border-[#2c2535] bg-[#0b090f] overflow-hidden">
            {/* Zoom controls */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
              <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} aria-label="Zoom in"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0c12]/90 border border-[#2c2535] text-zinc-400 hover:text-zinc-100 hover:border-purple-500/40 backdrop-blur text-sm font-bold transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="px-2 py-1 text-[10px] text-zinc-500 font-mono bg-[#0f0c12]/90 backdrop-blur rounded border border-[#2c2535] min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} aria-label="Zoom out"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0c12]/90 border border-[#2c2535] text-zinc-400 hover:text-zinc-100 hover:border-purple-500/40 backdrop-blur text-sm font-bold transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} aria-label="Fit to view"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f0c12]/90 border border-[#2c2535] text-zinc-400 hover:text-zinc-100 hover:border-purple-500/40 backdrop-blur text-sm transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>

            <svg
              width={svgSize.w} height={svgSize.h}
              className="w-full cursor-grab active:cursor-grabbing"
              style={{ display: "block" }}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                isPanningRef.current = true
                panStartRef.current = { x: e.clientX, y: e.clientY }
                panCurrentRef.current = { x: pan.x, y: pan.y }
              }}
              onMouseMove={(e) => {
                if (!isPanningRef.current) return
                const dx = e.clientX - panStartRef.current.x
                const dy = e.clientY - panStartRef.current.y
                setPan({ x: panCurrentRef.current.x + dx, y: panCurrentRef.current.y + dy })
              }}
              onMouseUp={() => { isPanningRef.current = false }}
              onMouseLeave={() => { isPanningRef.current = false }}
            >
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e1830" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Edges */}
              {visibleEdges.map((edge, i) => {
                const src = getNode(edge.source)
                const tgt = getNode(edge.target)
                if (!src || !tgt) return null
                const col = edgeColor(edge.label)
                const isSelectedEdge = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id)
                const isPathEdge = attackPaths.some(p => p.edges[0]?.source === edge.source && p.edges[0]?.target === edge.target)
                return (
                  <g key={`e-${i}`} aria-label={`${src.label} ${edge.label} ${tgt.label}`}>
                    {/* Hover area for edge label */}
                    <title>{src.label} → {edge.label} → {tgt.label}</title>
                    <line
                      x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={col} strokeOpacity={isSelectedEdge ? 0.85 : isPathEdge ? 0.6 : 0.35}
                      strokeWidth={isSelectedEdge ? 2.5 : isPathEdge ? 2 : 1}
                      strokeDasharray={isPathEdge && !isSelectedEdge ? "6 3" : undefined}
                    />
                    {/* Midpoint dot */}
                    <circle
                      cx={(src.x + tgt.x) / 2} cy={(src.y + tgt.y) / 2}
                      r={isSelectedEdge ? 4 : isPathEdge ? 3 : 2.5}
                      fill={col}
                      fillOpacity={isSelectedEdge ? 0.9 : isPathEdge ? 0.75 : 0.5}
                    />
                    {/* Edge label on selected/path edges */}
                    {isSelectedEdge && (
                      <text
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 - 6}
                        textAnchor="middle"
                        fill={col}
                        fontSize={8}
                        fontFamily="sans-serif"
                        fontWeight="600"
                        fillOpacity={0.9}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Nodes */}
              {positionedNodes.map((node, i) => {
                const cfg = TC[node.type as keyof typeof TC] || TC.finding
                const sev = getSeverityColor(node.severity)
                const isSelected = selectedNode?.id === node.id
                const isConnected = selectedNode && selectedConnections.some(e => e.source === node.id || e.target === node.id)
                const isProminent = isSelected || isConnected
                const r = isProminent ? (node.size || 7) + 2 : (node.size || 7)

                return (
                  <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(isSelected ? null : node)}>
                    {/* Glow effect for selected */}
                    {isSelected && (
                      <circle cx={node.x} cy={node.y} r={r + 8} fill={cfg.hex} fillOpacity={0.15} />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={node.x} cy={node.y} r={r}
                      fill={cfg.hex + (isSelected ? "FF" : isConnected ? "AA" : "70")}
                      stroke={isSelected ? "#ffffff" : cfg.hex}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />

                    {/* Connection count inside node for non-prominent */}
                    {!isProminent && node.connections > 0 && (
                      <text
                        x={node.x} y={node.y + 3}
                        textAnchor="middle" fill="#fff"
                        fontSize={7} fontWeight="bold"
                      >
                        {node.connections}
                      </text>
                    )}

                    {/* Label - only for prominent nodes or when few nodes */}
                    {isProminent && (
                      <text
                        x={node.x} y={node.y + r + 13}
                        textAnchor="middle"
                        fill={isSelected ? "#fff" : cfg.hex}
                        fontSize={isSelected ? 11 : 9}
                        fontFamily="sans-serif"
                        fontWeight={isSelected ? "bold" : "normal"}
                      >
                        {(node.label || node.id).slice(0, 20)}
                      </text>
                    )}

                    {/* Type badge - only for prominent nodes */}
                    {isProminent && (
                      <rect
                        x={node.x - 22} y={node.y - r - 18}
                        width={44} height={12} rx={4}
                        fill="#0f0c12" fillOpacity={0.9} stroke={cfg.hex} strokeWidth={0.75}
                      />
                    )}
                    {isProminent && (
                      <text
                        x={node.x} y={node.y - r - 9}
                        textAnchor="middle" fill={cfg.hex}
                        fontSize={7} fontFamily="sans-serif" fontWeight="600"
                      >
                        {TYPE_LABEL[node.type] || node.type}
                      </text>
                    )}

                    {/* Severity indicator - only for prominent */}
                    {isProminent && node.severity && (
                      <circle
                        cx={node.x - r - 3} cy={node.y - r - 3}
                        r={4}
                        fill={sev.bg.replace("/20)", "/60)") || "#ef4444"}
                        stroke={sev.border.replace("/50)", "/80)") || "#ef4444"}
                        strokeWidth={1}
                      />
                    )}
                  </g>
                )
              })}
              </g>
            </svg>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 bg-[#0b090f]/90 backdrop-blur rounded-xl p-3 border border-[#2c2535]">
              <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold w-full mb-1">Relationship Types</div>
              {[
                ["exploits", "#ef4444"], ["uses / deploys", "#ec4899"], ["targets", "#f97316"],
                ["controls C2", "#f97316"], ["C2 for", "#22c55e"], ["weaponizes / infects", "#ec4899"],
                ["compromised by", "#f59e0b"], ["launched", "#a855f7"], ["mentions", "#64748b"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-zinc-400 font-mono">{label}</span>
                </div>
              ))}
            </div>

            {/* Attack path count */}
            {attackPaths.length > 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#0b090f]/90 backdrop-blur rounded-xl px-3 py-2 border border-[#2c2535]">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] text-orange-300 font-semibold">{attackPaths.length} attack paths</span>
              </div>
            )}

            {/* Selected node info overlay */}
            {selectedNode && (
              <div className="absolute top-3 left-3 bg-[#0f0c12]/95 backdrop-blur rounded-xl p-3 border border-[#2c2535] max-w-xs">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TC[selectedNode.type as keyof typeof TC]?.hex }} />
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: TC[selectedNode.type as keyof typeof TC]?.hex }}>
                    {TYPE_LABEL[selectedNode.type] || selectedNode.type}
                  </span>
                </div>
                <div className="text-sm font-bold text-zinc-100">{selectedNode.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{selectedConnections.length} connections</div>
              </div>
            )}
          </div>

          {/* Node Detail Table */}
          <div className="rounded-2xl border border-[#2c2535] bg-[#141018] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#2c2535]">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-200">All Connections ({visibleEdges.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2c2535]">
                    <th className="text-left py-2.5 px-4 text-zinc-500 font-semibold text-[10px]">Source</th>
                    <th className="text-left py-2.5 px-4 text-zinc-500 font-semibold text-[10px]">Relation</th>
                    <th className="text-left py-2.5 px-4 text-zinc-500 font-semibold text-[10px]">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEdges.slice(0, 60).map((edge, i) => {
                    const src = getNode(edge.source)
                    const tgt = getNode(edge.target)
                    if (!src || !tgt) return null
                    const srcCfg = TC[src.type as keyof typeof TC] || TC.finding
                    const tgtCfg = TC[tgt.type as keyof typeof TC] || TC.finding
                    const col = edgeColor(edge.label)
                    const isPath = attackPaths.some(p => p.edges[0]?.source === edge.source && p.edges[0]?.target === edge.target)
                    return (
                      <tr key={`${edge.source}-${edge.target}-${i}`}
                        className={`border-b border-[#2c2535]/50 hover:bg-white/5 ${i % 2 === 0 ? "bg-black/10" : ""} ${isPath ? "bg-orange-500/5" : ""}`}>
                        <td className="py-2.5 px-4">
                          <button onClick={() => setSelectedNode(src)}
                            className={`flex items-center gap-2 hover:underline font-semibold ${srcCfg.text}`}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: srcCfg.hex }} />
                            {src.label}
                          </button>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border"
                            style={{ backgroundColor: `${col}20`, borderColor: `${col}50`, color: col }}>
                            <ArrowRight className="w-2.5 h-2.5" />
                            {edge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <button onClick={() => setSelectedNode(tgt)}
                            className={`flex items-center gap-2 hover:underline font-semibold ${tgtCfg.text}`}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tgtCfg.hex }} />
                            {tgt.label}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visibleEdges.length > 60 && (
                <div className="px-4 py-3 text-xs text-zinc-500 text-center border-t border-[#2c2535]">
                  Showing 60 of {visibleEdges.length} connections — filter or toggle types to narrow results
                </div>
              )}
            </div>
          </div>

          {/* Attack Chain Paths */}
          {attackPaths.length > 0 && (
            <div className="rounded-2xl border border-orange-500/30 bg-[#141018] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[#2c2535] bg-orange-500/5">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-semibold text-orange-300">Attack Chain Paths ({attackPaths.length})</span>
                <span className="text-xs text-zinc-500">actor → exploits → cve → affects product → targets victim</span>
              </div>
              <div className="p-4 flex flex-wrap gap-3">
                {attackPaths.map((path, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#2c2535] bg-[#0f0c12] hover:border-orange-500/30 transition-colors">
                    <button
                      onClick={() => setSelectedNode(path.nodes[0])}
                      className="text-[11px] font-bold text-orange-300 hover:underline">
                      {path.nodes[0].label}
                    </button>
                    <span className="text-[10px] px-2 py-0.5 rounded border font-semibold"
                      style={{ backgroundColor: `${edgeColor(path.label)}20`, borderColor: `${edgeColor(path.label)}50`, color: edgeColor(path.label) }}>
                      {path.label}
                    </span>
                    <button
                      onClick={() => setSelectedNode(path.nodes[1])}
                      className="text-[11px] font-bold text-zinc-200 hover:underline">
                      {path.nodes[1].label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Node Detail Panel — right sidebar */}
      {selectedNode && (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-[#0f0c12]/95 backdrop-blur border-l border-[#2c2535] p-5 overflow-y-auto">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              {(() => {
                const cfg = TC[selectedNode.type as keyof typeof TC] || TC.finding
                const sev = getSeverityColor(selectedNode.severity)
                return (
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center`}>
                      <div className={`w-4 h-4 rounded-full ${cfg.text.replace("text-", "bg-")}`} />
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-wider ${cfg.text} font-bold`}>{TYPE_LABEL[selectedNode.type] || selectedNode.type}</div>
                      <h2 className="text-xl font-bold text-zinc-100">{selectedNode.label}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        {selectedNode.severity && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${sev.bg} ${sev.border} ${sev.text}`}>
                            {selectedNode.severity.toUpperCase()}
                          </span>
                        )}
                        {selectedNode.riskScore && (
                          <span className="text-[10px] text-zinc-500">Risk Score: <span className="text-zinc-300 font-semibold">{selectedNode.riskScore}/100</span></span>
                        )}
                        <span className="text-xs text-zinc-500">{selectedConnections.length} connections</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <button onClick={() => setSelectedNode(null)}
                aria-label="Close details panel"
                className="p-2 rounded-lg border border-[#2c2535] hover:bg-[#1a1523] text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Connections */}
              <div className="md:col-span-2 rounded-xl border border-[#2c2535] bg-[#16111f] p-4 max-h-72 overflow-auto">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">Connections ({selectedConnections.length})</div>
                {selectedConnections.length > 0 ? (
                  <div className="space-y-2">
                    {selectedConnections.map((edge, i) => {
                      const other = edge.source === selectedNode.id
                        ? getNode(edge.target)
                        : getNode(edge.source)
                      if (!other) return null
                      const cfg = TC[other.type as keyof typeof TC] || TC.finding
                      const col = edgeColor(edge.label)
                      const isSource = edge.source === selectedNode.id
                      return (
                        <button key={i} onClick={() => setSelectedNode(other)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-[#2c2535] hover:border-[#2c2535]/80 bg-[#0f0c12] hover:bg-[#1a1523] transition-colors text-left">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${isSource ? "bg-orange-500/10 border-orange-500/30 text-orange-300" : "bg-sky-500/10 border-sky-500/30 text-sky-300"}`}>
                            {isSource ? "→ OUT" : "← IN"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0"
                            style={{ backgroundColor: `${col}20`, borderColor: `${col}50`, color: col }}>
                            {edge.label}
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.hex }} />
                            <span className="text-xs font-semibold text-zinc-200 truncate">{other.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.border} ${cfg.bg} ${cfg.text}`}>
                              {TYPE_LABEL[other.type] || other.type}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-600 py-6 text-center">No visible connections</div>
                )}
              </div>

              {/* Actions */}
              <div className="rounded-xl border border-[#2c2535] bg-[#16111f] p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Actions</div>
                {selectedNode.type === "actor" && (
                  <Link href={`/intelligence/actor-report?q=${encodeURIComponent(selectedNode.label)}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-500/20 transition-colors">
                    <Target className="w-3 h-3" /> View Actor Report
                  </Link>
                )}
                {selectedNode.type === "cve" && (
                  <Link href={`/intelligence/cve?q=${selectedNode.label}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition-colors">
                    View CVE Details
                  </Link>
                )}
                {selectedNode.id.startsWith("finding:demo:") && (
                  <Link href="/admin/demo-corpus"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/20 transition-colors">
                    Open Demo Corpus
                  </Link>
                )}
                <button onClick={() => fetchGraph(selectedNode.label)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition-colors w-full">
                  <Search className="w-3 h-3" /> Focus graph on &quot;{selectedNode.label}&quot;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
