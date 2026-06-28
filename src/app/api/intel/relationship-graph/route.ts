import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

interface GraphNode {
  id: string
  label: string
  type: "actor" | "campaign" | "cve" | "exploit" | "malware" | "technique" | "sector" | "source" | "finding" | "alert" | "case" | "report" | "victim" | "ip" | "stealer" | "product" | "domain"
  color: string
  size: number
  severity?: string
  riskScore?: number
}

interface GraphEdge {
  source: string
  target: string
  label: string
  color: string
}

const TYPE_COLORS: Record<string, string> = {
  actor: "#f97316",
  campaign: "#a855f7",
  cve: "#ef4444",
  exploit: "#f59e0b",
  malware: "#ec4899",
  technique: "#3b82f6",
  sector: "#14b8a6",
  source: "#22c55e",
  finding: "#38bdf8",
  alert: "#f59e0b",
  case: "#0ea5e9",
  report: "#6366f1",
  victim: "#0ea5e9",
  ip: "#22c55e",
  stealer: "#f59e0b",
  product: "#f59e0b",
  domain: "#6366f1",
}

// Relationship types that create entity-to-entity cross-links (not just finding-to-entity)
const CROSS_LINK_RELATIONSHIPS: Record<string, { label: string; color: string; fromType?: string; toType?: string }> = {
  exploited_by: { label: "exploits", color: "#ef4444" },
  exploits_cve: { label: "exploits", color: "#ef4444" },
  victim_of: { label: "victim of", color: "#f97316" },
  compromised_by: { label: "compromised by", color: "#f59e0b" },
  c2_for: { label: "C2 for", color: "#22c55e" },
  harvested_credentials_for: { label: "harvests from", color: "#f59e0b" },
  captured_credentials_from: { label: "captures from", color: "#f59e0b" },
  attributed_to: { label: "attributed to", color: "#f97316" },
  exploited_by_ransom: { label: "deploys", color: "#ec4899" },
}

const ENTITY_LINKABLE = new Set(["actor", "cve", "malware", "sector", "victim", "ip", "stealer", "product", "domain"])

// Relationship types that should only create edge labels, NOT entity nodes
const EDGE_ONLY_TYPES = new Set([
  "exploited_by", "exploits_cve", "targets", "attributed_to", "compromised_by",
  "c2_for", "harvested_credentials_for", "captured_credentials_from",
  "victim_of", "linked_to", "exposes", "used_in", "impersonates",
  "attack_chain_for", "source", "exposed_on",
])

function addNode(nodes: GraphNode[], nodeIds: Set<string>, id: string, label: string, type: GraphNode["type"], color: string, size = 8, severity?: string, riskScore?: number) {
  if (nodeIds.has(id)) {
    const existing = nodes.find(n => n.id === id)
    if (existing && riskScore !== undefined && existing.riskScore === undefined) {
      existing.riskScore = riskScore
      existing.severity = severity
    }
    return
  }
  nodeIds.add(id)
  nodes.push({ id, label: label.slice(0, 40), type, color, size, severity, riskScore })
}

function addEdge(edges: GraphEdge[], source: string, target: string, label: string, color: string) {
  if (!source || !target || source === target) return
  const exists = edges.some(e => e.source === source && e.target === target && e.label === label)
  if (!exists) edges.push({ source, target, label, color })
}

export async function GET(request: NextRequest) {
  const focus = request.nextUrl.searchParams.get("focus")?.trim() || ""
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "80"), 200)

  try {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeIds = new Set<string>()

    // ─── APT Campaigns ───
    const campaigns = await query(
      `SELECT campaign_id, campaign_name, threat_actor, techniques, malware_families, cves, target_sectors
       FROM intel_apt_campaigns
       ${focus ? `WHERE campaign_name ILIKE $1 OR threat_actor ILIKE $1` : ""}
       LIMIT ${focus ? 30 : limit}`,
      focus ? [`%${focus}%`] : [],
    )

    for (const row of campaigns.data || []) {
      const cid = `campaign:${row.campaign_id}`
      const actorId = `actor:${row.threat_actor}`
      addNode(nodes, nodeIds, cid, String(row.campaign_name), "campaign", "#a855f7", 10)
      if (row.threat_actor) {
        addNode(nodes, nodeIds, actorId, String(row.threat_actor), "actor", "#f97316", 12)
        addEdge(edges, actorId, cid, "launched", "#a855f7")
      }
      for (const cve of (row.cves || []).slice(0, 10)) {
        const cveId = `cve:${cve.toUpperCase()}`
        addNode(nodes, nodeIds, cveId, cve.toUpperCase(), "cve", "#ef4444", 6)
        addEdge(edges, cid, cveId, "exploited", "#ef4444")
      }
      for (const t of (row.techniques || []).slice(0, 8)) {
        addNode(nodes, nodeIds, `technique:${t}`, t, "technique", "#3b82f6", 5)
        if (row.threat_actor) addEdge(edges, `actor:${row.threat_actor}`, `technique:${t}`, "uses", "#3b82f6")
      }
      for (const sector of (row.target_sectors || []).slice(0, 6)) {
        addNode(nodes, nodeIds, `sector:${sector}`, sector, "sector", "#14b8a6", 5)
        addEdge(edges, cid, `sector:${sector}`, "targets", "#14b8a6")
      }
      for (const fam of (row.malware_families || []).slice(0, 6)) {
        addNode(nodes, nodeIds, `malware:${fam}`, fam, "malware", "#ec4899", 5)
        if (row.threat_actor) addEdge(edges, `actor:${row.threat_actor}`, `malware:${fam}`, "deploys", "#ec4899")
      }
    }

    // ─── Demo CTI Corpus ───
    const demoCorpus = await query(
      `SELECT id, doc_type, source_name, title, severity, risk_score, entities, iocs, relationships, timestamp
       FROM intel_demo_corpus
       ${focus ? `WHERE title ILIKE $1 OR body ILIKE $1 OR entities::text ILIKE $1 OR iocs::text ILIKE $1` : ""}
       ORDER BY risk_score DESC, timestamp DESC
       LIMIT ${focus ? 60 : 80}`,
      focus ? [`%${focus}%`] : [],
    ).catch(() => ({ data: [] }))

    addNode(nodes, nodeIds, "source:demo-corpus", "IntelForge Demo Corpus", "source", "#22c55e", 9)

    for (const row of demoCorpus.data || []) {
      const docId = `finding:demo:${row.id}`
      const severityColor = row.severity === "critical" ? "#ef4444" : row.severity === "high" ? "#f97316" : row.severity === "medium" ? "#f59e0b" : "#38bdf8"
      addNode(nodes, nodeIds, docId, String(row.title || row.id).slice(0, 50), "finding", severityColor, 6, row.severity, row.risk_score)
      addEdge(edges, "source:demo-corpus", docId, String(row.doc_type || "demo"), "#38bdf8")

      const entities = Array.isArray(row.entities) ? row.entities : []
      const entityMap = new Map<string, { id: string; type: string; value: string }>()

      // Extract and register all entities from this record
      for (const entity of entities) {
        const type = String(entity.type || "").toLowerCase()
        const value = String(entity.value || "")
        if (!value || !ENTITY_LINKABLE.has(type)) continue

        const entityId = `${type}:${value}`
        entityMap.set(entityId, { id: entityId, type, value })
        const color = TYPE_COLORS[type] || "#94a3b8"
        const size = type === "actor" ? 11 : type === "cve" ? 7 : 6
        addNode(nodes, nodeIds, entityId, value, type as GraphNode["type"], color, size, row.severity, row.risk_score)
        addEdge(edges, docId, entityId, "mentions", color)
      }

      // ─── Smart cross-linking via entities ───
      // actor ↔ cve
      const actors = [...entityMap.values()].filter(e => e.type === "actor")
      const cves = [...entityMap.values()].filter(e => e.type === "cve")
      const malware = [...entityMap.values()].filter(e => e.type === "malware")
      const victims = [...entityMap.values()].filter(e => e.type === "victim" || e.type === "domain")
      const ips = [...entityMap.values()].filter(e => e.type === "ip")
      const stealers = [...entityMap.values()].filter(e => e.type === "stealer")

      for (const actor of actors) {
        for (const cve of cves) addEdge(edges, actor.id, cve.id, "exploits", "#ef4444")
        for (const mal of malware) addEdge(edges, actor.id, mal.id, "uses", "#ec4899")
        for (const vic of victims) addEdge(edges, actor.id, vic.id, "targets", "#f97316")
        for (const ip of ips) addEdge(edges, actor.id, ip.id, "controls C2", "#f97316")
        for (const stealer of stealers) addEdge(edges, actor.id, stealer.id, "deploys", "#ec4899")
      }

      // malware ↔ victim/cve/ip
      for (const mal of malware) {
        for (const cve of cves) addEdge(edges, mal.id, cve.id, "weaponizes", "#ec4899")
        for (const vic of victims) addEdge(edges, mal.id, vic.id, "infects", "#ec4899")
        for (const ip of ips) addEdge(edges, mal.id, ip.id, "beacons to", "#ec4899")
      }

      // cve ↔ product
      const products = [...entityMap.values()].filter(e => e.type === "product")
      for (const cve of cves) {
        for (const prod of products) addEdge(edges, cve.id, prod.id, "affects", "#ef4444")
      }

      // ip ↔ domain
      for (const ip of ips) {
        for (const vic of victims) addEdge(edges, ip.id, vic.id, "C2 for", "#22c55e")
      }

      // ─── Process explicit relationships field ───
      const relationships = Array.isArray(row.relationships) ? row.relationships : []
      for (const rel of relationships) {
        const relType = String(rel.type || "")
        const relValue = String(rel.value || "").trim()
        if (!relType || !relValue) continue

        // Handle exploited_by → create actor→cve exploit links
        if (relType === "exploited_by") {
          const actorId = `actor:${relValue}`
          addNode(nodes, nodeIds, actorId, relValue, "actor", "#f97316", 11, row.severity, row.risk_score)
          for (const cve of cves) addEdge(edges, actorId, cve.id, "exploits", "#ef4444")
          addEdge(edges, docId, actorId, "exploited by", "#f97316")
          continue
        }

        // Handle victim_of → create victim→actor link
        if (relType === "victim_of") {
          const actorId = `actor:${relValue}`
          addNode(nodes, nodeIds, actorId, relValue, "actor", "#f97316", 11, row.severity, row.risk_score)
          for (const vic of victims) addEdge(edges, vic.id, actorId, "victim of", "#f97316")
          addEdge(edges, docId, actorId, "attributed to", "#f97316")
          continue
        }

        // Handle compromised_by → create victim→actor link
        if (relType === "compromised_by") {
          const actorId = `actor:${relValue}`
          addNode(nodes, nodeIds, actorId, relValue, "actor", "#f97316", 11, row.severity, row.risk_score)
          for (const vic of victims) addEdge(edges, vic.id, actorId, "compromised by", "#f59e0b")
          addEdge(edges, docId, actorId, "attributed to", "#f59e0b")
          continue
        }

        // Handle c2_for → create ip→domain link
        if (relType === "c2_for") {
          const domainId = `domain:${relValue}`
          addNode(nodes, nodeIds, domainId, relValue, "domain", "#6366f1", 6, row.severity, row.risk_score)
          for (const ip of ips) addEdge(edges, ip.id, domainId, "C2 for", "#22c55e")
          continue
        }

        // Handle harvested_credentials_for / captured_credentials_from → stealer→victim
        if (relType === "harvested_credentials_for" || relType === "captured_credentials_from") {
          const domainId = `domain:${relValue}`
          addNode(nodes, nodeIds, domainId, relValue, "domain", "#6366f1", 6, row.severity, row.risk_score)
          for (const stealer of stealers) addEdge(edges, stealer.id, domainId, "harvests from", "#f59e0b")
          continue
        }

        // Handle exploits_cve → actor→cve
        if (relType === "exploits_cve") {
          const cveId = `cve:${relValue.toUpperCase()}`
          addNode(nodes, nodeIds, cveId, relValue.toUpperCase(), "cve", "#ef4444", 7, row.severity, row.risk_score)
          for (const actor of actors) addEdge(edges, actor.id, cveId, "exploits", "#ef4444")
          continue
        }

        // Handle attributed_to → finding→actor
        if (relType === "attributed_to") {
          const actorId = `actor:${relValue}`
          addNode(nodes, nodeIds, actorId, relValue, "actor", "#f97316", 11, row.severity, row.risk_score)
          addEdge(edges, docId, actorId, "attributed to", "#f97316")
          continue
        }

        // Generic relationship to any entity type
        if (ENTITY_LINKABLE.has(relType)) {
          const targetId = `${relType}:${relValue}`
          const color = TYPE_COLORS[relType] || "#94a3b8"
          addNode(nodes, nodeIds, targetId, relValue, relType as GraphNode["type"], color, relType === "actor" ? 11 : 6, row.severity, row.risk_score)
          addEdge(edges, docId, targetId, relType.replace(/_/g, " "), color)
        } else if (!EDGE_ONLY_TYPES.has(relType)) {
          // Non-entity, non-edge-only type → create a generic node
          const targetId = `${relType}:${relValue}`
          addEdge(edges, docId, targetId, relType.replace(/_/g, " "), "#64748b")
        }
        // EDGE_ONLY_TYPES: no node, no edge target needed — attribute of the finding only
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nodes: nodes.slice(0, limit * 3),
        edges: edges.slice(0, limit * 4),
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
