import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caseResult = await query(`SELECT * FROM intel_cases WHERE id = $1`, [id])
  const caseRecord = caseResult.data?.[0]
  const itemsResult = await query(
    `SELECT ci.*, e.entity_type, e.value AS entity_value, f.title AS finding_title, f.risk_score
     FROM intel_case_items ci
     LEFT JOIN intel_entities e ON e.id = ci.entity_id
     LEFT JOIN intel_findings f ON f.id = ci.finding_id
     WHERE ci.case_id = $1
     ORDER BY ci.created_at DESC`,
    [id]
  )

  if (!caseRecord) return <main className="p-8 text-foreground">Case not found.</main>

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Case #{caseRecord.id}</p>
          <h1 className="mt-2 text-3xl font-bold">{caseRecord.title}</h1>
          <p className="mt-3 text-muted-foreground">{caseRecord.summary || "No summary yet."}</p>
          <div className="mt-4 flex gap-3 text-sm"><span>Status: {caseRecord.status}</span><span>Severity: {caseRecord.severity}</span></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Linked Items</h2>
          <div className="mt-4 space-y-3">
            {(itemsResult.data || []).map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <p className="font-medium">{item.finding_title || item.entity_value || `Alert #${item.alert_id}`}</p>
                <p className="text-sm text-muted-foreground">{item.note || "No analyst note."}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
