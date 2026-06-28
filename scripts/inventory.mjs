// Quick file/line inventory for the docs.
import fs from "node:fs"
import path from "node:path"

function lineCount(p) {
  try { return fs.readFileSync(p, "utf8").split("\n").length } catch { return 0 }
}
function walk(dir) {
  const out = []
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const ROOTS = [
  "lib/intel/automation",
  "app/api/intel/automation",
  "app/api/admin/automation",
  "app/api/cron/automation",
  "app/intelligence",
  "components/intelligence",
  "tests",
  "docs/defence",
  "scripts",
]

function bucket(p) {
  const n = p.replace(/\\/g, "/")
  if (n.startsWith("lib/intel/automation/")) return "lib/intel/automation"
  if (n.startsWith("app/api/intel/automation/")) return "app/api/intel/automation"
  if (n.startsWith("app/api/admin/automation/")) return "app/api/admin/automation"
  if (n.startsWith("app/api/cron/automation/")) return "app/api/cron/automation"
  if (n.startsWith("app/intelligence/clusters/") || n.startsWith("app/intelligence/command-center/") || n.startsWith("app/intelligence/action-queue/") || n.startsWith("app/intelligence/hunt/") || n.startsWith("app/intelligence/briefings/")) return "app/intelligence (automation pages)"
  if (n.startsWith("components/intelligence/")) {
    const f = n.split("/").pop()
    if (["threat-score-gauge.tsx","sparkline.tsx","forecast-chart.tsx","geo-heatmap.tsx","live-score-indicator.tsx"].includes(f)) return "components/intelligence (automation)"
  }
  if (n.startsWith("tests/") && n.endsWith(".mjs")) return "tests"
  if (n.startsWith("docs/defence/diagrams/svg/")) return "docs/defence/diagrams/svg"
  if (n.startsWith("docs/defence/diagrams/")) return "docs/defence/diagrams"
  if (n.startsWith("docs/defence/")) return "docs/defence"
  if (n.startsWith("scripts/intel-automation") || n.startsWith("scripts/seed-correlation") || n.startsWith("scripts/seed-trend")) return "scripts (automation sql)"
  if (n.startsWith("scripts/build-defence-pdf") || n.startsWith("scripts/demo.ps1") || n.startsWith("scripts/inventory.mjs")) return "scripts (defence tooling)"
  return null
}

const all = []
for (const r of ROOTS) all.push(...walk(r))
const tally = new Map()
let totalLines = 0, totalFiles = 0, allFiles = []
for (const p of all) {
  if (!p.match(/\.(ts|tsx|mjs|md|sql|svg|ps1|yml)$/)) continue
  const b = bucket(p)
  if (!b) continue
  const lines = lineCount(p)
  const cur = tally.get(b) || { c: 0, l: 0 }
  cur.c++; cur.l += lines
  tally.set(b, cur)
  totalLines += lines
  totalFiles++
  allFiles.push({ p: p.replace(/\\/g, "/"), lines })
}
const rows = [...tally.entries()].sort()
console.log(`${"Bucket".padEnd(40)}${"Files".padStart(7)}${"Lines".padStart(8)}`)
for (const [k, v] of rows) {
  console.log(k.padEnd(40) + String(v.c).padStart(7) + String(v.l).padStart(8))
}
console.log(`${"TOTAL".padEnd(40)}${String(totalFiles).padStart(7)}${String(totalLines).padStart(8)}`)
console.log("\n--- Largest files ---")
for (const f of allFiles.sort((a, b) => b.lines - a.lines).slice(0, 12)) {
  console.log(`  ${String(f.lines).padStart(5)}  ${f.p}`)
}
