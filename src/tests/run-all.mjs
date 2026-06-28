// ================================================
// Defence test runner — executes all 7 suites
// in order and aggregates a final summary.
// ================================================
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUITES = [
  "01-schema.test.mjs",
  "02-threat-score.test.mjs",
  "03-correlator.test.mjs",
  "04-forecast.test.mjs",
  "05-actions.test.mjs",
  "06-api.test.mjs",
  "07-pdf-sse.test.mjs",
  "08-webhook.test.mjs",
  "09-backtest.test.mjs",
  "10-collab-hunt.test.mjs",
  "11-attribution-events.test.mjs",
  "12-deep-correlator.test.mjs",
  "13-auth-validation.test.mjs",
]

const filter = (process.argv[2] || "").trim()
const suitesToRun = filter
  ? SUITES.filter((s) => s.includes(filter))
  : SUITES

console.log(`\n\x1b[1mIntelForge Defence Test Suite\x1b[0m`)
console.log(`Running ${suitesToRun.length} suite(s)\n`)

let totalPassed = 0
let totalFailed = 0
const suiteResults = []

for (const suiteFile of suitesToRun) {
  const start = Date.now()
  const res = spawnSync("node", [path.join(__dirname, suiteFile)], {
    stdio: "inherit",
  })
  const duration = ((Date.now() - start) / 1000).toFixed(1)
  const ok = res.status === 0
  suiteResults.push({ suite: suiteFile, ok, duration })
  if (ok) totalPassed++
  else totalFailed++
}

console.log(`\n\x1b[1m${"=".repeat(60)}\x1b[0m`)
console.log(`\x1b[1mFinal report\x1b[0m`)
for (const r of suiteResults) {
  const sym = r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"
  console.log(`  ${sym} ${r.suite.padEnd(30)} ${r.duration}s`)
}
console.log(`\n  Suites passed: \x1b[32m${totalPassed}\x1b[0m`)
console.log(`  Suites failed: ${totalFailed > 0 ? "\x1b[31m" : "\x1b[32m"}${totalFailed}\x1b[0m`)
console.log(`\x1b[1m${"=".repeat(60)}\x1b[0m\n`)

process.exit(totalFailed === 0 ? 0 : 1)
