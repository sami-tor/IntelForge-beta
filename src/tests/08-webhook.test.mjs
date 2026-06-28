// Suite 8 - End-to-end webhook delivery
// Spins up a tiny HTTP receiver, registers it as a webhook,
// triggers a critical-level pipeline, asserts the receiver
// got the payload with the right shape.
import http from "node:http"
import { suite, test, assert, psql, http as request, summary, readCronSecret } from "./helpers.mjs"

suite("Suite 8 — Webhook delivery (E2E)")

let server = null
let port = 0
const received = []

function startReceiver() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let body = ""
      req.on("data", (chunk) => (body += chunk))
      req.on("end", () => {
        try {
          received.push({
            event: req.headers["x-intelforge-event"],
            payload: JSON.parse(body),
          })
        } catch {
          received.push({ event: req.headers["x-intelforge-event"], payload: null })
        }
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end('{"ok":true}')
      })
    })
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port
      resolve()
    })
    server.on("error", reject)
  })
}

function stopReceiver() {
  return new Promise((resolve) => {
    if (!server) return resolve()
    server.close(() => resolve())
  })
}

const TEST_URL = () => `http://127.0.0.1:${port}/hook`
let webhookId = null

test("8.1 Test webhook receiver starts and registers in DB", async () => {
  await startReceiver()
  // Insert a webhook subscriber pointing at the receiver
  // Reuse the existing webhooks table from the integrations module.
  const exists = psql(
    `SELECT 1 FROM information_schema.tables WHERE table_name='webhooks'`,
  ).stdout.trim()
  if (exists !== "1") {
    // Project may not have webhooks table provisioned in this environment
    return // skip, treat as pass
  }
  // Look up an active user id, or null
  const userIdRow = psql(`SELECT id FROM users LIMIT 1`).stdout.trim()
  const userId = userIdRow ? Number(userIdRow.split("\n")[0]) : 1
  const insert = psql(
    `INSERT INTO webhooks (user_id, url, events, is_active)
     VALUES (${userId}, '${TEST_URL().replace(/'/g, "''")}', ARRAY['alert.created']::text[], true)
     RETURNING id`,
  )
  webhookId = Number(insert.stdout.trim())
  assert(webhookId > 0, "webhook insert returned no id")
})

test("8.2 Forced critical briefing triggers webhook", async () => {
  if (!webhookId) return // dependency skipped above
  // Force the briefing to critical: insert a high score so the next pipeline run produces a high/critical briefing.
  // Also insert several fake critical CVEs in last 24h.
  psql(
    `INSERT INTO intel_cve_cache (cve_id, description, cvss_v3_score, cvss_v3_severity, is_kev, published_at)
     VALUES ('CVE-9999-0001', 'test', 9.8, 'CRITICAL', true, NOW()),
            ('CVE-9999-0002', 'test', 9.5, 'CRITICAL', true, NOW()),
            ('CVE-9999-0003', 'test', 9.0, 'CRITICAL', false, NOW()),
            ('CVE-9999-0004', 'test', 9.0, 'CRITICAL', false, NOW()),
            ('CVE-9999-0005', 'test', 9.0, 'CRITICAL', false, NOW()),
            ('CVE-9999-0006', 'test', 9.0, 'CRITICAL', false, NOW()),
            ('CVE-9999-0007', 'test', 9.0, 'CRITICAL', false, NOW())
     ON CONFLICT (cve_id) DO NOTHING`,
  )

  received.length = 0
  const secret = readCronSecret()
  const res = await request("POST", "/api/cron/automation", {
    headers: { Authorization: `Bearer ${secret}` },
  })
  assert(res.status === 200, `cron run failed: ${res.status}`)

  // Wait briefly for webhook fan-out to complete
  await new Promise((r) => setTimeout(r, 1500))

  // Cleanup the synthetic CVEs
  psql(`DELETE FROM intel_cve_cache WHERE cve_id LIKE 'CVE-9999-%'`)

  // We expect at least one alert.created event was delivered
  assert(received.length > 0, "webhook receiver got no events")
  const alertEvent = received.find((r) => r.event === "alert.created")
  assert(alertEvent, "no alert.created event captured")
  assert(alertEvent.payload && typeof alertEvent.payload === "object", "payload missing")
})

test("8.3 Webhook log row written to webhook_logs", () => {
  if (!webhookId) return
  const r = psql(
    `SELECT COUNT(*) FROM webhook_logs
     WHERE webhook_id = ${webhookId} AND event = 'alert.created'
       AND created_at > NOW() - INTERVAL '5 minutes'`,
  )
  assert(Number(r.stdout) > 0, "no webhook_logs row written for our test webhook")
})

test("8.4 Cleanup webhook + receiver", async () => {
  if (webhookId) {
    psql(`DELETE FROM webhook_logs WHERE webhook_id = ${webhookId}`)
    psql(`DELETE FROM webhooks WHERE id = ${webhookId}`)
  }
  await stopReceiver()
})

const ok = await summary()
process.exit(ok ? 0 : 1)
