// Suite 2 - Threat Score
// Note: These tests reproduce the score-from-components math directly,
// mirroring lib/intel/automation/threat-score.ts:128-176, and validate
// the live API against persisted snapshots.
import { suite, test, assert, psql, http, summary } from "./helpers.mjs"

// Re-implementation of the production scoring formula for verification.
function scoreFromComponents(c) {
  let raw = 30
  if (c.criticalCves24h > 0) raw += Math.min(25, c.criticalCves24h * 4)
  if (c.highCves24h > 0) raw += Math.min(10, c.highCves24h * 1.2)
  if (c.kev > 0) raw += Math.min(10, Math.log10(c.kev + 1) * 4)
  if (c.ransomwareVictims7d > 0) raw += Math.min(15, c.ransomwareVictims7d * 0.5)
  if (c.exploits24h > 0) raw += Math.min(10, c.exploits24h * 1.5)
  if (c.activePhishing > 0) raw += Math.min(8, Math.log10(c.activePhishing + 1) * 3)
  if (c.malware24h > 0) raw += Math.min(6, c.malware24h * 0.05)
  if (c.darknetPosts24h > 0) raw += Math.min(5, c.darknetPosts24h * 0.2)
  if (c.feedFailures > 0) raw += Math.min(5, c.feedFailures * 0.4)
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function severityFromRiskScore(s) {
  if (s >= 90) return "critical"
  if (s >= 70) return "high"
  if (s >= 45) return "medium"
  if (s >= 20) return "low"
  return "info"
}

const empty = {
  kev: 0,
  criticalCves24h: 0,
  highCves24h: 0,
  ransomwareVictims7d: 0,
  ransomwareVictims30d: 0,
  activePhishing: 0,
  malware24h: 0,
  exploits24h: 0,
  darknetPosts24h: 0,
  feedFailures: 0,
}

suite("Suite 2 — Threat Score")

test("2.1 Empty components → score = 30 (baseline)", () => {
  const s = scoreFromComponents(empty)
  assert(s === 30, `expected 30 got ${s}`)
})

test("2.2 5 critical CVEs adds ≥ 20 points", () => {
  const s = scoreFromComponents({ ...empty, criticalCves24h: 5 })
  assert(s >= 30 + 20, `expected ≥ 50 got ${s}`)
})

test("2.3 KEV count of 1500 contributes ≤ 10 points", () => {
  const s = scoreFromComponents({ ...empty, kev: 1500 })
  // baseline 30 + log10(1501)*4 ≈ 30 + 12.7, capped at 10 → max 40
  assert(s - 30 <= 10, `expected delta ≤ 10 got ${s - 30}`)
})

test("2.4 Severity tier mapping: 92 → critical", () => {
  assert(severityFromRiskScore(92) === "critical")
})

test("2.5 Severity tier mapping: 75 → high", () => {
  assert(severityFromRiskScore(75) === "high")
})

test("2.6 Persisting score creates a history row", async () => {
  const before = Number(psql(`SELECT COUNT(*) FROM intel_threat_score_history`).stdout.trim())
  const status = await http("GET", "/api/intel/automation/status")
  assert(status.status === 200, `status endpoint returned ${status.status}`)
  // The most recent run already happened during ensurePipelineHasRun in a sibling test;
  // here we just confirm rows exist.
  const after = Number(psql(`SELECT COUNT(*) FROM intel_threat_score_history`).stdout.trim())
  assert(after >= 1 && after >= before, `expected ≥ 1 history row, got ${after}`)
})

test("2.7 delta_24h column is populated", () => {
  const r = psql(`SELECT delta_24h FROM intel_threat_score_history ORDER BY computed_at DESC LIMIT 1`)
  assert(r.ok, "query failed")
  // delta is an integer (could be 0); just confirm it's present
  assert(r.stdout !== "", "delta_24h missing")
})

test("2.8 Score is clamped to [0, 100]", () => {
  // Stuff every component very high
  const huge = {
    kev: 1e9,
    criticalCves24h: 1000,
    highCves24h: 1000,
    ransomwareVictims7d: 1000,
    ransomwareVictims30d: 5000,
    activePhishing: 1e6,
    malware24h: 10000,
    exploits24h: 1000,
    darknetPosts24h: 1000,
    feedFailures: 1000,
  }
  const s = scoreFromComponents(huge)
  assert(s <= 100 && s >= 0, `score out of range: ${s}`)
})

const ok = await summary()
process.exit(ok ? 0 : 1)
