// Suite 10 - Action collaboration + hunt builder + rate limit
import { suite, test, assert, psql, http, summary, readCronSecret } from "./helpers.mjs"

suite("Suite 10 — Collaboration, Hunt, Rate-limit")

test("10.1 GET /actions supports search filter", async () => {
  const res = await http("GET", "/api/intel/automation/actions?status=open&search=cve&limit=10")
  assert(res.status === 200)
  assert(Array.isArray(res.body.items))
})

test("10.2 GET /actions supports category filter", async () => {
  const res = await http("GET", "/api/intel/automation/actions?status=all&category=patch&limit=10")
  assert(res.status === 200)
  for (const item of res.body.items) {
    assert(item.category === "patch", `unexpected category ${item.category}`)
  }
})

test("10.3 PATCH /actions/bulk requires auth", async () => {
  const res = await http("PATCH", "/api/intel/automation/actions/bulk", {
    body: { ids: [1], status: "done" },
  })
  assert(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`)
})

test("10.4 POST /comments without auth → 401", async () => {
  const res = await http("POST", "/api/intel/automation/actions/1/comments", {
    body: { body: "test" },
  })
  assert(res.status === 401 || res.status === 403, `expected 401/403 got ${res.status}`)
})

test("10.5 GET /comments is public and returns shape", async () => {
  // Use any existing action id, or 1 if none
  const idRow = psql(`SELECT id FROM intel_action_queue LIMIT 1`).stdout.trim()
  const id = idRow ? Number(idRow.split("\n")[0]) : 1
  const res = await http("GET", `/api/intel/automation/actions/${id}/comments`)
  assert(res.status === 200, `status ${res.status}`)
  assert(Array.isArray(res.body.comments))
  assert(Array.isArray(res.body.audit))
})

test("10.6 POST /hunt with scope=clusters returns rows", async () => {
  const res = await http("POST", "/api/intel/automation/hunt", {
    body: { scope: "clusters", limit: 5 },
  })
  assert(res.status === 200)
  assert(Array.isArray(res.body.items))
})

test("10.7 POST /hunt rejects unknown scope", async () => {
  const res = await http("POST", "/api/intel/automation/hunt", {
    body: { scope: "invalid", limit: 5 },
  })
  assert(res.status === 400, `expected 400 got ${res.status}`)
})

test("10.8 Cron rate-limit triggers 429 at 11th call", async () => {
  const secret = readCronSecret()
  // Fire 12 quick calls; expect at least one 429 once over the cap.
  let saw429 = false
  for (let i = 0; i < 12; i++) {
    const res = await http("POST", "/api/cron/automation", {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (res.status === 429) {
      saw429 = true
      break
    }
  }
  assert(saw429, "expected at least one 429 in 12 rapid calls")
  // Clean the rate-log so subsequent tests aren't poisoned
  psql(`DELETE FROM intel_cron_rate_log WHERE called_at > NOW() - INTERVAL '5 minutes'`)
})

test("10.9 OpenAPI spec is served at /api/openapi.json", async () => {
  const res = await http("GET", "/api/openapi.json")
  assert(res.status === 200, `status ${res.status}`)
  assert(res.body.openapi === "3.1.0", "openapi version mismatch")
  assert(res.body.paths && Object.keys(res.body.paths).length >= 8, "paths missing")
})

const ok = await summary()
process.exit(ok ? 0 : 1)
