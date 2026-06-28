// ================================================
// Shared helpers for the IntelForge defence test suite.
// All scripts are plain ESM Node — no test framework
// so the suite runs identically in any environment.
// ================================================
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const PROJECT_ROOT = path.resolve(__dirname, "..")

export const BASE_URL = process.env.DEFENCE_BASE_URL || "http://localhost:3000"
export const PG_CONTAINER = process.env.DEFENCE_PG_CONTAINER || "intelforge-postgres"
export const PG_USER = process.env.DEFENCE_PG_USER || "intelforge"
export const PG_DB = process.env.DEFENCE_PG_DB || "intelforge"

const RESET = "\x1b[0m"
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const DIM = "\x1b[2m"
const BOLD = "\x1b[1m"

const results = []

export function readCronSecret() {
  try {
    const env = fs.readFileSync(path.join(PROJECT_ROOT, ".env.local"), "utf8")
    const m = env.split("\n").find((l) => l.trim().startsWith("CRON_SECRET="))
    if (!m) return ""
    return m.split("=")[1].trim()
  } catch {
    return ""
  }
}

export function psql(sql) {
  const res = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      PG_CONTAINER,
      "psql",
      "-U",
      PG_USER,
      "-d",
      PG_DB,
      "-A", // unaligned
      "-t", // tuples-only
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  )
  if (res.status !== 0) {
    return { ok: false, error: (res.stderr || res.stdout || "").trim(), stdout: "" }
  }
  return { ok: true, error: "", stdout: (res.stdout || "").trim() }
}

export async function http(method, urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`
  const init = {
    method,
    headers: options.headers || {},
  }
  if (options.body !== undefined) {
    init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json"
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body)
  }
  const res = await fetch(url, init)
  const ct = res.headers.get("content-type") || ""
  let body = null
  if (ct.includes("application/json")) {
    try {
      body = await res.json()
    } catch {
      body = null
    }
  } else if (ct.startsWith("application/pdf") || ct.startsWith("application/octet-stream")) {
    const buf = Buffer.from(await res.arrayBuffer())
    body = { __binary: true, length: buf.length, head: buf.slice(0, 8).toString("ascii") }
  } else {
    body = await res.text()
  }
  return { status: res.status, headers: res.headers, body }
}

let suiteName = ""
let suiteCount = 0
let suitePassed = 0
const suiteFailures = []
let serialChain = Promise.resolve() // serialise tests within a suite

export function suite(name) {
  if (suiteName) finishSuite()
  suiteName = name
  suiteCount = 0
  suitePassed = 0
  suiteFailures.length = 0
  console.log(`\n${BOLD}${CYAN}== ${name} ==${RESET}`)
}

export function test(label, fn) {
  // Chain so tests run in declaration order — important for state-mutating
  // tests like "expect count to increase by N".
  serialChain = serialChain.then(async () => {
    suiteCount++
    try {
      await fn()
      suitePassed++
      results.push({ suite: suiteName, label, ok: true })
      console.log(`  ${GREEN}✓${RESET} ${label}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ suite: suiteName, label, ok: false, error: msg })
      suiteFailures.push({ label, msg })
      console.log(`  ${RED}✗${RESET} ${label}\n      ${DIM}${msg}${RESET}`)
    }
  })
  return serialChain
}

export function assert(cond, message) {
  if (!cond) throw new Error(message || "assertion failed")
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "assertion failed"} — expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
    )
  }
}

function finishSuite() {
  if (!suiteName) return
  const ok = suitePassed === suiteCount
  const colour = ok ? GREEN : YELLOW
  console.log(
    `  ${colour}${suitePassed}/${suiteCount} passed${RESET}${
      ok ? "" : ` ${RED}(${suiteCount - suitePassed} failed)${RESET}`
    }`,
  )
  suiteName = ""
}

export async function summary() {
  // Wait for the entire serial chain before reporting
  await serialChain
  finishSuite()
  const total = results.length
  const passed = results.filter((r) => r.ok).length
  const failed = total - passed
  console.log(`\n${BOLD}${"=".repeat(60)}${RESET}`)
  console.log(`${BOLD}Total:${RESET} ${total}`)
  console.log(`${GREEN}${BOLD}Passed:${RESET} ${passed}`)
  if (failed > 0) {
    console.log(`${RED}${BOLD}Failed:${RESET} ${failed}`)
    console.log("")
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ${RED}✗ [${r.suite}] ${r.label}${RESET}`)
      console.log(`    ${DIM}${r.error}${RESET}`)
    }
  }
  console.log(`${BOLD}${"=".repeat(60)}${RESET}\n`)
  return failed === 0
}

export async function ensurePipelineHasRun() {
  const cronSecret = readCronSecret()
  if (!cronSecret) {
    throw new Error("CRON_SECRET missing from .env.local")
  }
  const res = await http("POST", "/api/cron/automation", {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })
  if (res.status !== 200) {
    throw new Error(`Pipeline run failed: HTTP ${res.status}`)
  }
  return res.body
}
