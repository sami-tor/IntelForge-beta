// Suite 12 - Deep correlator v2 + new artifact tables
import { suite, test, assert, psql, http, summary } from "./helpers.mjs"

suite("Suite 12 — Deep correlator v2")

test("12.1 New artifact tables exist", () => {
  const tables = [
    "intel_paste_posts",
    "intel_stealer_logs",
    "intel_combolist_drops",
    "intel_compromised_hosts",
    "intel_actor_cve_links",
    "intel_actor_breach_links",
  ]
  for (const t of tables) {
    const r = psql(
      `SELECT 1 FROM information_schema.tables WHERE table_name='${t}'`,
    )
    assert(r.stdout.trim() === "1", `table ${t} missing`)
  }
})

test("12.2 Demo seed produced anchor data", () => {
  const cves = Number(
    psql(`SELECT COUNT(*) FROM intel_actor_cve_links`).stdout,
  )
  const breaches = Number(
    psql(`SELECT COUNT(*) FROM intel_actor_breach_links`).stdout,
  )
  const pastes = Number(
    psql(`SELECT COUNT(*) FROM intel_paste_posts`).stdout,
  )
  const stealer = Number(
    psql(`SELECT COUNT(*) FROM intel_stealer_logs`).stdout,
  )
  assert(cves >= 5, `expected ≥5 actor-CVE links, got ${cves}`)
  assert(breaches >= 5, `expected ≥5 actor-breach links, got ${breaches}`)
  assert(pastes >= 5, `expected ≥5 paste posts, got ${pastes}`)
  assert(stealer >= 5, `expected ≥5 stealer logs, got ${stealer}`)
})

test("12.3 Pipeline produces multiple cluster types", () => {
  const types = psql(
    `SELECT DISTINCT cluster_type FROM intel_correlation_clusters ORDER BY 1`,
  ).stdout.trim().split("\n").filter(Boolean)
  assert(types.length >= 2, `expected ≥2 cluster types, got ${types.join(",")}`)
  assert(types.includes("cve"), "missing cve clusters")
  assert(
    types.includes("ransomware") || types.includes("actor"),
    "missing ransomware or actor clusters — deep correlator not running",
  )
})

test("12.4 Top clusters carry rich signals (avg ≥ 4)", () => {
  const r = psql(
    `SELECT AVG(signal_count)::numeric(6,2) FROM (
       SELECT signal_count FROM intel_correlation_clusters
       ORDER BY risk_score DESC LIMIT 10
     ) t`,
  )
  const avg = Number(r.stdout)
  assert(avg >= 4, `top-10 avg signals = ${avg}, expected ≥ 4`)
})

test("12.5 Signal types span beyond just KEV", () => {
  const r = psql(
    `SELECT COUNT(DISTINCT s->>'type')
     FROM intel_correlation_clusters c,
          jsonb_array_elements(c.signals->'signals') s`,
  )
  const distinct = Number(r.stdout)
  assert(
    distinct >= 5,
    `expected ≥5 distinct signal types in clusters, got ${distinct}`,
  )
})

test("12.6 Each signal has a confidence score 0..100", () => {
  const r = psql(
    `SELECT COUNT(*)
     FROM intel_correlation_clusters c,
          jsonb_array_elements(c.signals->'signals') s
     WHERE (s->>'confidence')::numeric NOT BETWEEN 0 AND 100`,
  )
  assert(Number(r.stdout) === 0, `${r.stdout} signals with out-of-range confidence`)
})

test("12.7 Cluster confidence column is populated and bounded", () => {
  const r = psql(
    `SELECT COUNT(*) FROM intel_correlation_clusters
     WHERE confidence < 20 OR confidence > 99`,
  )
  assert(Number(r.stdout) === 0, `${r.stdout} clusters with bad confidence`)
})

test("12.8 GET /api/intel/automation/clusters returns deep clusters", async () => {
  const res = await http("GET", "/api/intel/automation/clusters?limit=20")
  assert(res.status === 200)
  assert(Array.isArray(res.body.items))
  assert(res.body.items.length > 0, "no clusters returned")
  const first = res.body.items[0]
  assert(typeof first.confidence === "number", "missing confidence")
  assert(Array.isArray(first.relatedCves), "missing relatedCves")
})

test("12.9 GET /clusters?type=ransomware returns only ransomware-anchored clusters", async () => {
  const res = await http("GET", "/api/intel/automation/clusters?type=ransomware&limit=10")
  assert(res.status === 200)
  if (res.body.items.length === 0) return // not enough data
  for (const c of res.body.items) {
    assert(c.clusterType === "ransomware", `unexpected type ${c.clusterType}`)
  }
})

test("12.10 Top CVE cluster references at least one actor", async () => {
  const r = psql(
    `SELECT signals->'actors' FROM intel_correlation_clusters
     WHERE cluster_type='cve' ORDER BY risk_score DESC LIMIT 5`,
  )
  // Look for non-empty actor arrays
  const lines = r.stdout.trim().split("\n").filter(Boolean)
  const withActors = lines.filter((l) => l.includes("Cl0p") || l.includes("LockBit") || l.includes("APT") || l.includes("Akira") || l.includes("Mustang"))
  assert(
    withActors.length > 0,
    `no top-5 CVE cluster has linked actors: ${lines.join(" | ")}`,
  )
})

const ok = await summary()
process.exit(ok ? 0 : 1)
