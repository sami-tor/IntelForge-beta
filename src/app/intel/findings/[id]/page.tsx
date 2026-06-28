import Link from "next/link"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const findingResult = await query(`SELECT * FROM intel_findings WHERE id = $1`, [id])
  const finding = findingResult.data?.[0]

  if (!finding) return <main className="p-8 text-foreground">Finding not found.</main>

  const relationshipsResult = await query(
    `SELECT r.*, se.entity_type AS source_type, se.value AS source_value,
            te.entity_type AS target_type, te.value AS target_value
     FROM intel_relationships r
     LEFT JOIN intel_entities se ON se.id = r.source_entity_id
     LEFT JOIN intel_entities te ON te.id = r.target_entity_id
     WHERE r.finding_id = $1
     ORDER BY r.weight DESC, r.created_at DESC
     LIMIT 100`,
    [id],
  )

  const relationships = relationshipsResult.data || []

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Finding #{finding.id}</p>
              <h1 className="mt-2 text-3xl font-bold">{finding.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{finding.description}</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-sm">{finding.severity} / {finding.risk_score}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Confidence</p><p className="text-2xl font-semibold">{finding.confidence}%</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Source</p><p className="text-lg font-semibold">{finding.source_name || finding.source_type || "Unknown"}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">First seen</p><p className="text-sm font-semibold">{String(finding.first_seen || "Unknown")}</p></div>
            <div className="rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">Last seen</p><p className="text-sm font-semibold">{String(finding.last_seen || "Unknown")}</p></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Linked Entities</h2>
          <div className="mt-4 space-y-3">
            {relationships.length > 0 ? relationships.map((rel: any) => {
              const sourceHref = rel.source_type && rel.source_value ? `/intel/${encodeURIComponent(rel.source_type)}/${encodeURIComponent(rel.source_value)}` : null
              const targetHref = rel.target_type && rel.target_value ? `/intel/${encodeURIComponent(rel.target_type)}/${encodeURIComponent(rel.target_value)}` : null
              return (
                <article key={rel.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold">{rel.relationship_type}</h3>
                    <span className="text-xs text-muted-foreground">Weight {rel.weight}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {sourceHref ? <Link href={sourceHref} className="text-primary hover:underline">{rel.source_type}: {rel.source_value}</Link> : <span>{rel.source_value || "source"}</span>}
                    <span className="text-muted-foreground">→</span>
                    {targetHref ? <Link href={targetHref} className="text-primary hover:underline">{rel.target_type}: {rel.target_value}</Link> : <span>{rel.target_value || "target"}</span>}
                  </div>
                </article>
              )
            }) : <div className="text-sm text-muted-foreground">No relationships linked</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Raw Evidence</h2>
          <pre className="mt-4 overflow-auto rounded-xl bg-muted p-4 text-xs text-muted-foreground">{JSON.stringify({ raw_reference: finding.raw_reference, evidence: finding.evidence, recommended_actions: finding.recommended_actions }, null, 2)}</pre>
        </div>
      </section>
    </main>
  )
}
