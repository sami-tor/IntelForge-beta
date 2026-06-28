import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const result = await query(`SELECT * FROM intel_reports ORDER BY created_at DESC LIMIT 100`)
  const reports = result.data || []

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Analyst outputs</p>
          <h1 className="text-3xl font-bold">Intelligence Reports</h1>
        </div>
        <div className="grid gap-4">
          {reports.map((report: any) => (
            <article key={report.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{report.title}</h2>
                <span className="rounded-full bg-muted px-3 py-1 text-sm">{report.report_type}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Generated {String(report.created_at)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
