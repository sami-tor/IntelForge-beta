#!/usr/bin/env node
/**
 * Apply all SQL migrations in order (idempotent CREATE IF NOT EXISTS).
 * Usage: node scripts/apply-migrations.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    const k = t.slice(0, i)
    const v = t.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const MIGRATIONS = [
  "intel-feeds-migration.sql",
  "intel-advanced-feeds-migration.sql",
  "intel-automation-migration.sql",
  "intel-automation-v2-migration.sql",
  "intel-automation-v3-migration.sql",
  "intel-automation-v4-migration.sql",
  "organizations-migration.sql",
  "integrations-migration.sql",
  "white-label-migration.sql",
  "face-identities-migration.sql",
  "face-search-history-migration.sql",
  "watchlist-migration.sql",
  "face-watchlist-migration.sql",
  "ahmia-scraper-migration.sql",
]

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local")
  process.exit(1)
}

console.log("Applying migrations via DATABASE_URL...\n")

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

let failed = 0
for (const file of MIGRATIONS) {
  const full = path.join(root, "scripts", file)
  if (!existsSync(full)) {
    console.log(`  skip ${file} (not found)`)
    continue
  }
  try {
    const sql = readFileSync(full, "utf8")
    await client.query(sql)
    console.log(`  ✓ ${file}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${file} — ${e instanceof Error ? e.message : String(e)}`)
  }
}

await client.end()
console.log(failed === 0 ? "\nAll migrations applied." : `\n${failed} migration(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
