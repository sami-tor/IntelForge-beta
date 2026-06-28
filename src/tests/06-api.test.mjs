// Suite 6 - API endpoints
import { suite, test, assert, http, summary, readCronSecret, psql } from "./helpers.mjs"

suite("Suite 6 — API endpoints")

test("6.1 GET /status returns 200 and required keys", async () => {
  const res = await http("GET", "/api/intel/automation/status")
  assert(res.status === 200, `status was ${res.status}`)
  for (const k of ["success", "threatScore", "history", "clusters", "trends", "briefing"]) {
    assert(k in (res.body || {}), `missing key ${k}`)
  }
})

test("6.2 GET /forecasts returns 200 with forecasts array", async () => {
  const res = await http("GET", "/api/intel/automation/forecasts")
  assert(res.status === 200)
  assert(Array.isArray(res.body.forecasts), "forecasts not array")
  assert(Array.isArray(res.body.anomalies), "anomalies not array")
})

test("6.3 GET /geo returns 200 with geo + sectors", async () => {
  const res = await http("GET", "/api/intel/automation/geo")
  assert(res.status === 200)
  assert(Array.isArray(res.body.geo), "geo not array")
  assert(Array.isArray(res.body.sectors), "sectors not array")
})

test("6.4 GET /actions?status=open returns 200 with items[]", async () => {
  const res = await http("GET", "/api/intel/automation/actions?status=open&limit=10")
  assert(res.status === 200)
  assert(Array.isArray(res.body.items), "items not array")
})

test("6.5 POST /api/cron/automation without secret → 401", async () => {
  // Send wrong secret to force 401 even when CRON_SECRET is set
  const res = await http("POST", "/api/cron/automation", {
    headers: { Authorization: "Bearer not-the-real-secret" },
  })
  assert(res.status === 401, `expected 401 got ${res.status}`)
})

test("6.6 POST /api/cron/automation with secret → 200 + 8 stages", async () => {
  const secret = readCronSecret()
  assert(secret, "CRON_SECRET missing")
  const res = await http("POST", "/api/cron/automation", {
    headers: { Authorization: `Bearer ${secret}` },
  })
  assert(res.status === 200, `expected 200 got ${res.status}`)
  const r = res.body.result || {}
  for (const k of ["threatScore", "correlation", "trends", "briefing", "forecasts", "actions", "geoSector", "notifications"]) {
    assert(k in r, `missing stage ${k}`)
  }
})

test("6.7 PATCH /actions without auth → 401", async () => {
  const res = await http("PATCH", "/api/intel/automation/actions", {
    body: { id: 1, status: "done" },
  })
  assert(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`)
})

test("6.8 Each cron call logs an automation_runs row", async () => {
  const before = Number(psql(`SELECT COUNT(*) FROM intel_automation_runs`).stdout)
  const secret = readCronSecret()
  await http("POST", "/api/cron/automation", {
    headers: { Authorization: `Bearer ${secret}` },
  })
  // Allow brief time for the row to commit
  await new Promise((r) => setTimeout(r, 500))
  const after = Number(psql(`SELECT COUNT(*) FROM intel_automation_runs`).stdout)
  // Other tests may also fire the cron in parallel; require strict monotonic increase only
  assert(after > before, `expected count to increase, got ${before} → ${after}`)
})

test("6.9 GET /api/admin/automation/run without admin → 401", async () => {
  const res = await http("GET", "/api/admin/automation/run")
  assert(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`)
})

const ok = await summary()
process.exit(ok ? 0 : 1)
