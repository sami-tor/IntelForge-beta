#!/usr/bin/env node
/**
 * Append missing secrets to .env.local without overwriting existing values.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")
const examplePath = path.join(root, ".env.example")

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    writeFileSync(envPath, readFileSync(examplePath, "utf8"))
    console.log("Created .env.local from .env.example")
  } else {
    writeFileSync(envPath, "")
  }
}

const REQUIRED_SECRETS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "SESSION_SECRET",
  "RESPONSE_SIGNING_SECRET",
  "CRON_SECRET",
]

let content = readFileSync(envPath, "utf8")
const lines = content.split("\n")
const existing = new Set(
  lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim())
)

const additions = []
for (const key of REQUIRED_SECRETS) {
  const hasValue = lines.some((l) => {
    const t = l.trim()
    if (!t.startsWith(`${key}=`)) return false
    return t.slice(key.length + 1).trim().length > 0
  })
  if (!hasValue) {
    const val = crypto.randomBytes(32).toString("hex")
    additions.push(`${key}=${val}`)
    console.log(`  + ${key}`)
  }
}

if (additions.length === 0) {
  console.log("All required secrets already set in .env.local")
} else {
  const suffix = content.endsWith("\n") || content.length === 0 ? "" : "\n"
  writeFileSync(envPath, content + suffix + additions.join("\n") + "\n")
  console.log(`Added ${additions.length} secret(s) to .env.local`)
}
