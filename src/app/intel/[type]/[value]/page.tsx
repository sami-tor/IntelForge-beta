import Link from "next/link"
import { query } from "@/lib/db"
import { normalizeEntityValue, type EntityType } from "@/lib/intel/entity-extractor"
import TimelineActions from "./timeline-actions"

export const dynamic = "force-dynamic"

function buildTimeline(entity: any, findings: any[], relationships: any[], caseItems: any[], reports: any[], range: string) {
  const timeline: Array<Record<string, any>> = []
  const cutoff =
    range === "7d" ? Date.now() - 7 * 24 * 60 * 60 * 1000
    : range === "30d" ? Date.now() - 30 * 24 * 60 * 60 * 1000
    : range === "90d" ? Date.now() - 90 * 24 * 60 * 60 * 1000
    : 0
  const withinRange = (dateValue: any) => {
    if (!cutoff) return true
    const time = new Date(String(dateValue || 0)).getTime()
    return time >= cutoff
  }

  if (entity?.first_seen && withinRange(entity.first_seen)) {
    timeline.push({ date: entity.first_seen, label: "First seen", detail: `${entity.entity_type}: ${entity.value}`, href: null, kind: "entity" })
  }
  if (entity?.last_seen && withinRange(entity.last_seen)) {
    timeline.push({ date: entity.last_seen, label: "Last seen", detail: `${entity.entity_type}: ${entity.value}`, href: null, kind: "entity" })
  }

  for (const finding of findings.slice(0, 20)) {
    const date = finding.last_seen || finding.first_seen || finding.created_at
    if (!withinRange(date)) continue
    timeline.push({
      date,
      label: finding.title,
      detail: `${finding.severity || "unknown"} · ${finding.source_type || finding.source_name || "finding"}`,
      href: `/intel/findings/${encodeURIComponent(String(finding.id))}`,
      kind: "finding",
    })
  }

  for (const rel of relationships.slice(0, 20)) {
    if (!withinRange(rel.created_at)) continue
    timeline.push({
      date: rel.created_at,
      label: `Relationship ${rel.relationship_type}`,
      detail: `${rel.source_value || rel.source_type || "source"} → ${rel.target_value || rel.target_type || "target"}; weight ${rel.weight}`,
      href: `/intelligence/relationship-graph?focus=${encodeURIComponent(String(entity?.value || ""))}`,
      kind: "relationship",
    })
  }

  for (const item of caseItems.slice(0, 20)) {
    if (!withinRange(item.created_at)) continue
    timeline.push({
      date: item.created_at,
      label: `Case item: ${item.case_title || item.case_id}`,
      detail: item.note || item.case_status || "Case link",
      href: item.case_id ? `/cases/${item.case_id}` : "/cases",
      kind: "case",
    })
  }

  for (const report of reports.slice(0, 20)) {
    if (!withinRange(report.created_at)) continue
    timeline.push({
      date: report.created_at,
      label: report.title,
      detail: `${report.report_type || "report"} · ${report.status || "created"}`,
      href: "/reports",
      kind: "report",
    })
  }

  return timeline
    .filter((item) => item.date || item.label || item.detail)
    .sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime())
    .slice(0, 50)
}

function groupTimeline(timeline: Array<Record<string, any>>) {
  const groups: Record<string, Array<Record<string, any>>> = {}
  for (const item of timeline) {
    const key = String(item.kind || "other")
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

export default async function EntityIntelPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; value: string }>
  searchParams?: Promise<{ range?: string }>
}) {
  const { type, value } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const range = resolvedSearchParams.range || "all"
  const decodedValue = decodeURIComponent(value)
  const normalizedValue = normalizeEntityValue(type as EntityType, decodedValue)
  const entityResult = await query(
    `SELECT * FROM intel_entities WHERE entity_type = $1 AND normalized_value = $2`,
    [type, normalizedValue]
  )
  const entity = entityResult.data?.[0]

  const findingsResult = entity
    ? await query(
        `SELECT f.* FROM intel_findings f
         JOIN intel_relationships r ON r.finding_id = f.id
         WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
         ORDER BY f.risk_score DESC, f.last_seen DESC
         LIMIT 50`,
        [entity.id]
      )
    : { data: [] }

  const relationshipsResult = entity
    ? await query(
        `SELECT r.*, se.entity_type AS source_type, se.value AS source_value,
                te.entity_type AS target_type, te.value AS target_value
         FROM intel_relationships r
         LEFT JOIN intel_entities se ON se.id = r.source_entity_id
         LEFT JOIN intel_entities te ON te.id = r.target_entity_id
         WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
         ORDER BY r.weight DESC, r.created_at DESC
         LIMIT 50`,
        [entity.id]
      )
    : { data: [] }

  const caseItemsResult = entity
    ? await query(
        `SELECT ci.created_at, ci.note, c.id AS case_id, c.title AS case_title, c.status AS case_status
         FROM intel_case_items ci
         JOIN intel_cases c ON c.id = ci.case_id
         WHERE ci.entity_id = $1
         ORDER BY ci.created_at DESC
         LIMIT 30`,
        [entity.id]
      )
    : { data: [] }

  const reportsResult = entity
    ? await query(
        `SELECT id, title, report_type, created_at, 'created' AS status
         FROM intel_reports
         WHERE entity_id = $1
         ORDER BY created_at DESC
         LIMIT 30`,
        [entity.id]
      )
    : { data: [] }

  const demoCorpusResult = entity
    ? await query(
        `SELECT id, timestamp AS created_at, doc_type, source_name, title, summary, body, severity, risk_score
         FROM intel_demo_corpus
         WHERE title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1 OR entities::text ILIKE $1 OR iocs::text ILIKE $1
         ORDER BY risk_score DESC, timestamp DESC
         LIMIT 20`,
        [`%${decodedValue}%`]
      )
    : { data: [] }

  if (!entity) {
    return <main className="p-8 text-foreground">Entity not found.</main>
  }

  const findings = findingsResult.data || []
  const relationships = relationshipsResult.data || []
  const caseItems = caseItemsResult.data || []
  const reports = reportsResult.data || []
  const demoCorpus = demoCorpusResult.data || []
  const timeline = buildTimeline(entity, findings, relationships, caseItems, reports, range)
  const groupedTimeline = groupTimeline(timeline)
  const timelineExport = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ entity: { type, value: decodedValue }, range, timeline }, null, 2))}`
  const shareUrl = `/intel/${encodeURIComponent(type)}/${encodeURIComponent(decodedValue)}?range=${encodeURIComponent(range)}`

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">{entity.entity_type}</p>
              <h1 className="mt-2 text-3xl font-bold">{entity.value}</h1>
            </div>
            <TimelineActions timelineExport={timelineExport} shareUrl={shareUrl} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Risk</p><p className="text-2xl font-semibold">{entity.risk_score}/100</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Confidence</p><p className="text-2xl font-semibold">{entity.confidence}%</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">First seen</p><p className="text-lg font-semibold">{String(entity.first_seen || "Unknown")}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Last seen</p><p className="text-lg font-semibold">{String(entity.last_seen || "Unknown")}</p></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Entity Timeline</h2>
            <div className="mt-4 space-y-5">
              {Object.entries(groupedTimeline).map(([kind, items]) => (
                <div key={kind} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{kind}</h3>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((entry, index) => (
                      <article key={`${kind}-${index}`} className="rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <h4 className="font-semibold">{entry.label}</h4>
                          <span className="text-xs text-muted-foreground">{entry.date ? new Date(entry.date).toLocaleString() : "Unknown"}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{entry.detail}</p>
                        {entry.href && (
                          <Link href={entry.href} className="mt-2 inline-block text-xs text-primary hover:underline">
                            Open linked object →
                          </Link>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Entity Summary</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Linked Findings</p><p className="text-2xl font-semibold">{findings.length}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Relationships</p><p className="text-2xl font-semibold">{relationships.length}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Case Links</p><p className="text-2xl font-semibold">{caseItems.length}</p></div>
              <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Reports</p><p className="text-2xl font-semibold">{reports.length}</p></div>
            </div>
          </div>
        </div>

        {demoCorpus.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Demo Corpus Matches</h2>
              <Link href="/admin/demo-corpus" className="text-xs text-primary hover:underline">Manage demo corpus →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {demoCorpus.map((item: any) => (
                <article key={item.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold">{item.title}</h3>
                    <span className="text-xs text-muted-foreground">{item.doc_type} · {item.severity}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Linked Findings</h2>
          <div className="mt-4 space-y-3">
            {findings.map((finding: any) => (
              <article key={finding.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{finding.title}</h3>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm">{finding.severity} / {finding.risk_score}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{finding.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
