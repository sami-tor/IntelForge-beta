import Link from "next/link"
import DemoCorpusActions from "./actions"

export default function DemoCorpusAdminPage() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo corpus</p>
          <h1 className="mt-2 text-3xl font-bold">Safe synthetic CTI corpus</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Seed synthetic phishing, redacted credential, malware, CVE, forum, scan, cloud exposure, and schema-only records.
            No real secrets, no live stolen data.
          </p>
          <DemoCorpusActions />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Types seeded</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Phishing</li>
              <li>ULP redacted</li>
              <li>Stealer redacted</li>
              <li>Database schema-only</li>
              <li>CVE</li>
              <li>Malware</li>
              <li>Ransomware post</li>
              <li>Forum post</li>
              <li>Cloud exposure</li>
              <li>Scan output</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Demo flows</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Search by organization, CVE, malware, or domain</li>
              <li>Open entity timeline with provenance</li>
              <li>Focus graph on DEMO-APT-01</li>
              <li>Generate AI summary with citations</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/search" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Go search</Link>
          <Link href="/intelligence/relationship-graph" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Open graph</Link>
        </div>
      </section>
    </main>
  )
}
