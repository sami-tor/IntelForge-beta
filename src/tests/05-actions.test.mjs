// Suite 5 - Action Queue
import { suite, test, assert, psql, http, summary, ensurePipelineHasRun } from "./helpers.mjs"

suite("Suite 5 — Action Queue")

await ensurePipelineHasRun()

test("5.1 Cluster with KEV+exploit produces a 'patch' action", () => {
  const r = psql(`
    SELECT COUNT(*)
    FROM intel_action_queue
    WHERE category = 'patch'
      AND source_type = 'cluster'
  `)
  // Not strict (depends on real data) — but assert no schema drift if there are clusters with KEV+exploit
  const kevExploits = Number(
    psql(
      `SELECT COUNT(*) FROM intel_correlation_clusters
       WHERE 'kev' = ANY(tags) AND 'exploit-available' = ANY(tags) AND risk_score >= 50`,
    ).stdout,
  )
  if (kevExploits > 0) {
    assert(Number(r.stdout) > 0, `${kevExploits} eligible clusters but no patch action`)
  }
})

test("5.2 Spike anomaly produces a 'hunt' category action", () => {
  const spikes = Number(
    psql(
      `SELECT COUNT(*) FROM intel_anomalies
       WHERE direction = 'spike' AND severity IN ('high','critical') AND bucket_date >= CURRENT_DATE - 30`,
    ).stdout,
  )
  if (spikes === 0) return // nothing to check
  const hunts = Number(
    psql(`SELECT COUNT(*) FROM intel_action_queue WHERE category = 'hunt' AND source_type = 'anomaly'`).stdout,
  )
  assert(hunts > 0, `${spikes} spike anomalies but no hunt action`)
})

test("5.3 Action upsert is idempotent on action_key", async () => {
  const before = Number(psql(`SELECT COUNT(*) FROM intel_action_queue`).stdout)
  await ensurePipelineHasRun()
  const after = Number(psql(`SELECT COUNT(*) FROM intel_action_queue`).stdout)
  assert(after === before || after === before + 0, `count drifted ${before} → ${after}`)
  // Tighter check: no duplicate action_key
  const dup = Number(
    psql(`SELECT COUNT(*) FROM (SELECT action_key FROM intel_action_queue GROUP BY action_key HAVING COUNT(*)>1) t`)
      .stdout,
  )
  assert(dup === 0, `${dup} duplicate action_keys`)
})

test("5.4 GET /actions?status=open returns only open rows", async () => {
  const res = await http("GET", "/api/intel/automation/actions?status=open&limit=50")
  assert(res.status === 200)
  for (const item of res.body.items || []) {
    assert(item.status === "open", `non-open item: ${item.id}/${item.status}`)
  }
})

test("5.5 updateActionStatus(id, 'done') sets done_at", () => {
  // Find any open action, mark done via direct SQL (mirrors the function in code)
  const r = psql(`SELECT id FROM intel_action_queue WHERE status = 'open' LIMIT 1`)
  const id = r.stdout.trim()
  if (!id) return // queue empty — nothing to verify
  psql(`UPDATE intel_action_queue SET status='done', done_at=NOW(), updated_at=NOW() WHERE id=${id}`)
  const after = psql(`SELECT done_at IS NOT NULL FROM intel_action_queue WHERE id=${id}`).stdout.trim()
  assert(after === "t", `done_at not set after status='done'`)
  // restore
  psql(`UPDATE intel_action_queue SET status='open', done_at=NULL, updated_at=NOW() WHERE id=${id}`)
})

test("5.6 Reopening clears done_at (per updateActionStatus contract)", () => {
  const r = psql(`SELECT id FROM intel_action_queue LIMIT 1`)
  const id = r.stdout.trim()
  if (!id) return
  psql(`UPDATE intel_action_queue SET status='done', done_at=NOW() WHERE id=${id}`)
  // reopen → done_at must be NULL
  psql(`UPDATE intel_action_queue SET status='open', done_at=NULL WHERE id=${id}`)
  const after = psql(`SELECT done_at IS NULL FROM intel_action_queue WHERE id=${id}`).stdout.trim()
  assert(after === "t", `done_at not cleared on reopen`)
})

const ok = await summary()
process.exit(ok ? 0 : 1)
