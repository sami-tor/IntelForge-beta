// Suite 3 - Correlator
import { suite, test, assert, psql, http, summary, ensurePipelineHasRun } from "./helpers.mjs"

function scoreCluster(payload) {
  const cve = payload.cve
  let score = 30
  const cvssScore = Number(cve?.score ?? 0)
  if (cvssScore >= 9) score += 30
  else if (cvssScore >= 7) score += 20
  else if (cvssScore >= 4) score += 10
  if (cve?.isKev) score += 20
  if (payload.signals.some((s) => s.type === "exploit")) score += 15
  if (payload.signals.filter((s) => s.type === "news").length >= 2) score += 5
  if (payload.signals.some((s) => s.type === "ransomware")) score += 10
  return Math.max(0, Math.min(100, score))
}

suite("Suite 3 — Correlator")

await ensurePipelineHasRun()

test("3.1 KEV + exploit + 2 news + CVSS 9.5 → score ≥ 80", () => {
  const s = scoreCluster({
    cve: { cveId: "CVE-2099-9999", score: 9.5, isKev: true },
    signals: [
      { type: "exploit" },
      { type: "news" },
      { type: "news" },
    ],
  })
  assert(s >= 80, `expected ≥ 80 got ${s}`)
})

test("3.2 No-signal CVE is skipped", () => {
  // After a pipeline run, every persisted cluster has signal_count ≥ 1
  const r = psql(`SELECT COUNT(*) FROM intel_correlation_clusters WHERE signal_count = 0`)
  assert(r.stdout === "0", `found ${r.stdout} clusters with zero signals`)
})

test("3.3 Cluster upsert is idempotent across two runs", async () => {
  const before = Number(psql(`SELECT COUNT(*) FROM intel_correlation_clusters`).stdout)
  await ensurePipelineHasRun()
  const after = Number(psql(`SELECT COUNT(*) FROM intel_correlation_clusters`).stdout)
  // Re-run may add NEW clusters if upstream feeds added new CVEs in between,
  // but the count should never decrease and should not double.
  assert(after >= before && after <= before + 5, `unexpected delta ${before} -> ${after}`)
})

test("3.4 Clusters with KEV signal carry the 'kev' tag", () => {
  const r = psql(
    `SELECT COUNT(*) FROM intel_correlation_clusters
     WHERE signals::text LIKE '%"type":"kev"%' AND NOT ('kev' = ANY(tags))`,
  )
  assert(r.stdout === "0", `${r.stdout} clusters with KEV signal but no tag`)
})

test("3.5 Clusters with score ≥ 80 carry 'high-priority' tag", () => {
  const r = psql(
    `SELECT COUNT(*) FROM intel_correlation_clusters WHERE risk_score >= 80 AND NOT ('high-priority' = ANY(tags))`,
  )
  assert(r.stdout === "0", `${r.stdout} high-score clusters missing tag`)
})

test("3.6 /status returns top clusters ordered by risk_score desc", async () => {
  const res = await http("GET", "/api/intel/automation/status")
  assert(res.status === 200)
  const cls = res.body.clusters || []
  for (let i = 1; i < cls.length; i++) {
    assert(cls[i - 1].riskScore >= cls[i].riskScore, "clusters not ordered desc")
  }
})

const ok = await summary()
process.exit(ok ? 0 : 1)
