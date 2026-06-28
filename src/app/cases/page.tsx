import Link from "next/link"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function CasesPage() {
  const result = await query(`SELECT * FROM intel_cases ORDER BY updated_at DESC LIMIT 100`)
  const cases = result.data || []

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Case management</p>
          <h1 className="text-3xl font-bold">Intelligence Cases</h1>
        </div>
        <div className="grid gap-4">
          {cases.map((caseRecord: any) => (
            <Link key={caseRecord.id} href={`/cases/${caseRecord.id}`} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{caseRecord.title}</h2>
                <span className="rounded-full bg-muted px-3 py-1 text-sm">{caseRecord.status} / {caseRecord.severity}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{caseRecord.summary || "No summary yet."}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
