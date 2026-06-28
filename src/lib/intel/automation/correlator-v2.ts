// ================================================
// IntelForge Automation - Deep Correlator (v2)
// ------------------------------------------------
// Multi-anchor, multi-table correlation engine.
//
// Anchors supported:
//   • cve        → exploits, KEV, news, paste posts, stealer logs,
//                  ransomware victims, darknet, actors, related CVEs
//   • actor      → CVEs they exploit, victims they hit, paste posts,
//                  ransomware blog mentions
//   • ransomware → group's CVEs (transitively), victims, sectors,
//                  geographic spread, stealer-log overlap
//
// Each signal has an explicit confidence (0-100) and the cluster
// score is a weighted sum, not a flat count. Time-decay is applied
// so a 2-day-old signal counts more than a 200-day-old one.
//
// Re-runnable: upserts on cluster_key.
// ================================================
import { query } from "@/lib/db"
import { severityFromRiskScore, type FindingSeverity } from "@/lib/intel/risk-scoring"
import { findAliasMatches, findFuzzyDescriptionMatches, VULN_ALIASES } from "./correlator-nlp"
import { emitAutomationEvent } from "./events"

export type SignalType =
  | "kev"
  | "exploit"
  | "news"
  | "paste"
  | "stealer_log"
  | "compromised_host"
  | "combolist"
  | "ransomware_victim"
  | "darknet_post"
  | "actor_link"
  | "related_cve"

export interface CorrelationSignal {
  type: SignalType
  source?: string          // anonymised label, never raw provider name
  ref?: string             // stable id of the underlying record
  title?: string
  detail?: string
  severity?: string
  confidence: number       // 0-100
  publishedAt?: string
}


export interface ClusterPayload {
  cve?: {
    cveId: string
    score?: number
    severity?: string
    isKev?: boolean
    description?: string
    vendor?: string
    product?: string
    publishedAt?: string
  }
  actor?: { name: string; aliases?: string[]; description?: string }
  ransomware?: { name: string; aliases?: string[]; victimCount?: number }
  signals: CorrelationSignal[]
  iocs?: string[]
  actors?: string[]
  relatedCves?: string[]
}

export type ClusterType = "cve" | "actor" | "ransomware" | "malware"

export interface DeepCluster {
  clusterKey: string
  clusterType: ClusterType
  title: string
  summary: string
  riskScore: number
  confidence: number
  severity: FindingSeverity
  signalCount: number
  signals: ClusterPayload
  tags: string[]
  relatedCves: string[]
  anchorActor?: string | null
  anchorRansomware?: string | null
  firstSeen: string
  lastSeen: string
}

interface CveRow {
  cve_id: string
  description: string | null
  cvss_v3_score: number | null
  cvss_v3_severity: string | null
  epss_score: number | null
  is_kev: boolean | null
  vendor: string | null
  product: string | null
  published_at: Date | null
}

// ---- Signal-type weights (multiplied by per-signal confidence) ----
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  kev:                12,
  exploit:            14,
  news:                4,
  paste:               6,
  stealer_log:         8,
  compromised_host:    9,
  combolist:           7,
  ransomware_victim:  13,
  darknet_post:        9,
  actor_link:         11,
  related_cve:         3,
}

const TIME_DECAY_DAYS = 60

function ageDays(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, (Date.now() - t) / (24 * 60 * 60 * 1000))
}


/** Multiplicative decay: a fresh signal keeps full weight, very old ones approach 0.5. */
function decayFactor(iso?: string): number {
  const days = ageDays(iso)
  if (days === null) return 1
  // Half-life of TIME_DECAY_DAYS days, never below 0.4
  return Math.max(0.4, Math.exp(-Math.LN2 * (days / TIME_DECAY_DAYS)))
}

// ---- 1. Anchor fetch helpers --------------------------------------

async function fetchAnchorCves(limit = 80): Promise<CveRow[]> {
  const r = await query(
    `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity,
            epss_score, is_kev, vendor, product, published_at
     FROM intel_cve_cache
     WHERE published_at > NOW() - INTERVAL '14 days'
        OR is_kev = true
     ORDER BY
       (CASE WHEN is_kev THEN 1 ELSE 0 END) DESC,
       cvss_v3_score DESC NULLS LAST,
       published_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  )
  return ((r.success && r.data) || []) as CveRow[]
}

async function fetchExploitsForCves(cveIds: string[]) {
  if (cveIds.length === 0) return new Map<string, Array<Record<string, unknown>>>()
  const r = await query(
    `SELECT exploit_id, cve_id, title, exploit_type, published_at, verified
     FROM intel_exploit_cache
     WHERE cve_id = ANY($1::text[])
     ORDER BY published_at DESC NULLS LAST`,
    [cveIds],
  )
  const out = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const cve = String(row.cve_id || "")
    if (!cve) continue
    const list = out.get(cve) ?? []
    list.push(row)
    out.set(cve, list)
  }
  return out
}

async function fetchNewsForCves(cveIds: string[]) {
  if (cveIds.length === 0) return new Map<string, Array<Record<string, unknown>>>()
  const conditions = cveIds
    .map((_, i) => `(title ILIKE $${i + 1} OR description ILIKE $${i + 1})`)
    .join(" OR ")
  const params = cveIds.map((id) => `%${id}%`)
  const r = await query(
    `SELECT guid, title, category, published_at, description
     FROM intel_news_cache
     WHERE published_at > NOW() - INTERVAL '21 days'
       AND (${conditions})
     ORDER BY published_at DESC
     LIMIT 300`,
    params,
  )
  const out = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const haystack = `${row.title} ${row.description ?? ""}`
    for (const id of cveIds) {
      if (haystack.includes(id)) {
        const list = out.get(id) ?? []
        list.push(row)
        out.set(id, list)
        break
      }
    }
  }
  return out
}

async function fetchPasteForCves(cveIds: string[]) {
  if (cveIds.length === 0) return new Map<string, Array<Record<string, unknown>>>()
  const r = await query(
    `SELECT post_uid, source, title, excerpt, threat_actor,
            severity, discovered_at, matched_cves, matched_brands
     FROM intel_paste_posts
     WHERE matched_cves && $1::text[]
        OR EXISTS (
          SELECT 1 FROM unnest($1::text[]) cve
          WHERE excerpt ILIKE '%' || cve || '%' OR title ILIKE '%' || cve || '%'
        )
     ORDER BY discovered_at DESC
     LIMIT 200`,
    [cveIds],
  )
  const out = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const matched = (row.matched_cves as string[]) || []
    const haystack = `${row.title || ""} ${row.excerpt || ""}`
    for (const id of cveIds) {
      if (matched.includes(id) || haystack.includes(id)) {
        const list = out.get(id) ?? []
        list.push(row)
        out.set(id, list)
      }
    }
  }
  return out
}


async function fetchActorsForCves(cveIds: string[]) {
  if (cveIds.length === 0) return new Map<string, Array<Record<string, unknown>>>()
  const r = await query(
    `SELECT actor_name, cve_id, relationship, confidence, first_seen, last_seen
     FROM intel_actor_cve_links
     WHERE cve_id = ANY($1::text[])
     ORDER BY confidence DESC`,
    [cveIds],
  )
  const out = new Map<string, Array<Record<string, unknown>>>()
  for (const row of (r.data || []) as Array<Record<string, unknown>>) {
    const cve = String(row.cve_id)
    const list = out.get(cve) ?? []
    list.push(row)
    out.set(cve, list)
  }
  return out
}

async function fetchRelatedCves(productKey: string | null, vendorKey: string | null, excludeId: string) {
  if (!productKey && !vendorKey) return []
  const r = await query(
    `SELECT cve_id FROM intel_cve_cache
     WHERE cve_id <> $1
       AND (
         ($2::text IS NOT NULL AND product = $2)
         OR ($3::text IS NOT NULL AND vendor = $3)
       )
     ORDER BY cvss_v3_score DESC NULLS LAST, published_at DESC NULLS LAST
     LIMIT 5`,
    [excludeId, productKey, vendorKey],
  )
  return ((r.data || []) as Array<{ cve_id: string }>).map((row) => row.cve_id)
}

async function fetchStealerLogsForBrand(brand: string) {
  // Match brand against captured domain or url
  const r = await query(
    `SELECT log_uid, stealer_family, machine_id, country, captured_url, domain,
            login_user, password_redacted, captured_at, severity
     FROM intel_stealer_logs
     WHERE domain ILIKE $1 OR captured_url ILIKE $1
     ORDER BY captured_at DESC
     LIMIT 25`,
    [`%${brand}%`],
  )
  return (r.data || []) as Array<Record<string, unknown>>
}

async function fetchRansomwareVictimsForCveOrActor(cve: CveRow, actorNames: string[]) {
  // Strategy: any victim claimed by an actor that exploits this CVE.
  const params: unknown[] = []
  const conds: string[] = []
  if (actorNames.length > 0) {
    params.push(actorNames)
    conds.push(`actor_name = ANY($${params.length}::text[])`)
  }
  if (conds.length === 0) return []
  const r = await query(
    `SELECT victim_name, sector, country, breach_date, breach_type,
            record_count, confidence, severity, actor_name
     FROM intel_actor_breach_links
     WHERE ${conds.join(" AND ")}
     ORDER BY breach_date DESC NULLS LAST
     LIMIT 25`,
    params,
  )
  return (r.data || []) as Array<Record<string, unknown>>
}

async function fetchDarknetForActor(actorNames: string[]) {
  if (actorNames.length === 0) return []
  const r = await query(
    `SELECT post_uid, source, title, content, threat_actor, victim_name,
            victim_sector, victim_country, leak_type, severity, discovered_at
     FROM intel_darknet_posts
     WHERE threat_actor = ANY($1::text[])
     ORDER BY discovered_at DESC
     LIMIT 30`,
    [actorNames],
  )
  return (r.data || []) as Array<Record<string, unknown>>
}


// ---- 2. Cluster scoring with confidence + decay --------------------

function buildBaseScore(cve?: ClusterPayload["cve"]): number {
  if (!cve) return 25
  let score = 25
  const cvss = Number(cve.score ?? 0)
  if (cvss >= 9) score += 30
  else if (cvss >= 7) score += 20
  else if (cvss >= 4) score += 10
  if (cve.isKev) score += 15
  return score
}

function scoreCluster(payload: ClusterPayload): { score: number; confidence: number } {
  let raw = buildBaseScore(payload.cve)
  let conf = 50
  let confSamples = 1

  for (const signal of payload.signals) {
    const w = SIGNAL_WEIGHTS[signal.type] ?? 2
    const decay = decayFactor(signal.publishedAt)
    const c = Math.max(0, Math.min(100, signal.confidence ?? 50))
    raw += w * (c / 100) * decay
    conf += c
    confSamples++
  }

  if ((payload.relatedCves?.length ?? 0) > 0) {
    raw += Math.min(8, (payload.relatedCves!.length) * 1.5)
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(raw)))
  const finalConfidence = Math.max(20, Math.min(99, Math.round(conf / confSamples)))
  return { score: finalScore, confidence: finalConfidence }
}

function buildSummary(payload: ClusterPayload): string {
  const parts: string[] = []
  if (payload.cve) {
    const sev = payload.cve.severity ? payload.cve.severity.toLowerCase() : "unrated"
    parts.push(`${payload.cve.cveId} (${sev}, CVSS ${payload.cve.score ?? "n/a"})`)
    if (payload.cve.isKev) parts.push("KEV listed")
  }
  if (payload.actor) parts.push(`actor: ${payload.actor.name}`)
  if (payload.ransomware) parts.push(`ransomware: ${payload.ransomware.name}`)

  const groups = new Map<SignalType, number>()
  for (const s of payload.signals) groups.set(s.type, (groups.get(s.type) ?? 0) + 1)
  for (const [type, count] of groups) {
    if (type === "kev" || type === "actor_link") continue
    parts.push(`${count}× ${type.replace("_", " ")}`)
  }
  if ((payload.actors?.length ?? 0) > 0) parts.push(`linked actors: ${payload.actors!.slice(0, 3).join(", ")}`)
  if ((payload.relatedCves?.length ?? 0) > 0) parts.push(`${payload.relatedCves!.length} related CVE(s)`)
  return parts.join(" · ")
}

function buildTags(payload: ClusterPayload, score: number): string[] {
  const tags: string[] = []
  if (payload.cve?.isKev) tags.push("kev")
  if (payload.signals.some((s) => s.type === "exploit")) tags.push("exploit-available")
  if (payload.signals.some((s) => s.type === "stealer_log")) tags.push("stealer-active")
  if (payload.signals.some((s) => s.type === "ransomware_victim")) tags.push("ransomware-active")
  if (payload.signals.some((s) => s.type === "paste")) tags.push("paste-leak")
  if (payload.signals.some((s) => s.type === "darknet_post")) tags.push("darknet")
  if (payload.signals.filter((s) => s.type === "news").length >= 3) tags.push("media-spike")
  if (score >= 80) tags.push("high-priority")
  return tags
}

function alphabeticalCveAliasGuess(cveId: string): string | null {
  for (const [alias, id] of Object.entries(VULN_ALIASES)) {
    if (id === cveId) return alias
  }
  return null
}


// ---- 3. CVE-anchored pass -----------------------------------------

async function runCvePass(): Promise<{ scanned: number; persisted: number }> {
  const cves = await fetchAnchorCves(80)
  if (cves.length === 0) return { scanned: 0, persisted: 0 }
  const ids = cves.map((c) => c.cve_id)

  const [exploits, news, pastes, actors, aliasNews, fuzzyNews] = await Promise.all([
    fetchExploitsForCves(ids),
    fetchNewsForCves(ids),
    fetchPasteForCves(ids),
    fetchActorsForCves(ids),
    findAliasMatches(ids),
    findFuzzyDescriptionMatches(cves.map((c) => ({ cveId: c.cve_id, description: c.description }))),
  ])

  let persisted = 0

  for (const cve of cves) {
    const exploitRows = exploits.get(cve.cve_id) || []
    const newsRows = [...(news.get(cve.cve_id) || [])]
    const pasteRows = pastes.get(cve.cve_id) || []
    const actorRows = actors.get(cve.cve_id) || []
    const actorNames = actorRows.map((a) => String(a.actor_name))

    // Merge alias + fuzzy news
    const seen = new Set(newsRows.map((r) => String(r.guid)))
    for (const list of [aliasNews.get(cve.cve_id) || [], fuzzyNews.get(cve.cve_id) || []]) {
      for (const r of list) {
        if (!seen.has(r.guid)) {
          newsRows.push(r as unknown as Record<string, unknown>)
          seen.add(r.guid)
        }
      }
    }

    // Dependent fetches
    const breaches = await fetchRansomwareVictimsForCveOrActor(cve, actorNames)
    const darknet = await fetchDarknetForActor(actorNames)
    const relatedCves = await fetchRelatedCves(cve.product, cve.vendor, cve.cve_id)
    const aliasName = alphabeticalCveAliasGuess(cve.cve_id)
    const stealerLogs = aliasName ? await fetchStealerLogsForBrand(aliasName) : []

    if (
      !cve.is_kev &&
      exploitRows.length === 0 &&
      newsRows.length === 0 &&
      pasteRows.length === 0 &&
      actorRows.length === 0
    ) {
      continue
    }

    const signals: CorrelationSignal[] = []
    if (cve.is_kev) {
      signals.push({
        type: "kev",
        ref: cve.cve_id,
        title: "Known Exploited Vulnerability",
        detail: "Listed in CISA KEV catalog",
        confidence: 100,
      })
    }
    for (const ex of exploitRows.slice(0, 5)) {
      signals.push({
        type: "exploit",
        ref: String(ex.exploit_id),
        title: (ex.title as string) || `Exploit ${ex.exploit_id}`,
        detail: (ex.exploit_type as string) || undefined,
        confidence: ex.verified ? 95 : 80,
        publishedAt: (ex.published_at as Date | null)?.toISOString(),
      })
    }
    for (const n of newsRows.slice(0, 4)) {
      signals.push({
        type: "news",
        ref: String(n.guid),
        title: String(n.title || ""),
        detail: (n.category as string) || undefined,
        confidence: 80,
        publishedAt: (n.published_at as Date | null)?.toISOString(),
      })
    }
    for (const p of pasteRows.slice(0, 5)) {
      signals.push({
        type: "paste",
        ref: String(p.post_uid),
        title: String(p.title || `Paste ${p.post_uid}`),
        detail: (p.threat_actor as string) || undefined,
        severity: (p.severity as string) || undefined,
        confidence: 85,
        publishedAt: (p.discovered_at as Date | null)?.toISOString(),
      })
    }
    for (const a of actorRows.slice(0, 4)) {
      signals.push({
        type: "actor_link",
        ref: String(a.actor_name),
        title: `Linked actor: ${a.actor_name}`,
        detail: String(a.relationship || "exploits"),
        confidence: Number(a.confidence ?? 70),
      })
    }
    for (const b of breaches.slice(0, 5)) {
      signals.push({
        type: "ransomware_victim",
        ref: String(b.victim_name),
        title: `${b.actor_name} → ${b.victim_name}`,
        detail: `${b.sector || "?"} · ${b.country || "?"}`,
        severity: (b.severity as string) || undefined,
        confidence: Number(b.confidence ?? 80),
        publishedAt: (b.breach_date as Date | null)?.toISOString(),
      })
    }
    for (const d of darknet.slice(0, 4)) {
      signals.push({
        type: "darknet_post",
        ref: String(d.post_uid),
        title: String(d.title || `Dark-web post ${d.post_uid}`),
        detail: String(d.leak_type || ""),
        severity: (d.severity as string) || undefined,
        confidence: 75,
        publishedAt: (d.discovered_at as Date | null)?.toISOString(),
      })
    }
    for (const s of stealerLogs.slice(0, 4)) {
      signals.push({
        type: "stealer_log",
        ref: String(s.log_uid),
        title: `Stealer log · ${s.stealer_family}`,
        detail: `${s.domain} · ${s.country || "?"}`,
        confidence: 70,
        publishedAt: (s.captured_at as Date | null)?.toISOString(),
      })
    }
    for (const rc of relatedCves) {
      signals.push({
        type: "related_cve",
        ref: rc,
        title: `Related: ${rc}`,
        detail: cve.product || cve.vendor || undefined,
        confidence: 55,
      })
    }

    const payload: ClusterPayload = {
      cve: {
        cveId: cve.cve_id,
        score: cve.cvss_v3_score === null ? undefined : Number(cve.cvss_v3_score),
        severity: cve.cvss_v3_severity || undefined,
        isKev: !!cve.is_kev,
        description: cve.description ?? undefined,
        vendor: cve.vendor ?? undefined,
        product: cve.product ?? undefined,
        publishedAt: cve.published_at?.toISOString(),
      },
      signals,
      actors: actorNames,
      relatedCves,
    }
    const { score, confidence } = scoreCluster(payload)
    const severity = severityFromRiskScore(score)
    const summary = buildSummary(payload)
    const tags = buildTags(payload, score)

    await query(
      `INSERT INTO intel_correlation_clusters
        (cluster_key, cluster_type, title, summary, risk_score, confidence, severity,
         signal_count, signals, tags, related_cves, anchor_actor, anchor_ransomware,
         first_seen, last_seen, auto_generated, updated_at)
       VALUES ($1, 'cve', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NULL, NULL,
               NOW(), NOW(), true, NOW())
       ON CONFLICT (cluster_key) DO UPDATE SET
         title       = EXCLUDED.title,
         summary     = EXCLUDED.summary,
         risk_score  = GREATEST(intel_correlation_clusters.risk_score, EXCLUDED.risk_score),
         confidence  = EXCLUDED.confidence,
         severity    = EXCLUDED.severity,
         signal_count= EXCLUDED.signal_count,
         signals     = EXCLUDED.signals,
         tags        = EXCLUDED.tags,
         related_cves= EXCLUDED.related_cves,
         last_seen   = NOW(),
         updated_at  = NOW()`,
      [
        `cve:${cve.cve_id}`,
        cve.cve_id,
        summary,
        score,
        confidence,
        severity,
        signals.length + 1, // +1 for the CVE anchor
        JSON.stringify(payload),
        tags,
        relatedCves,
      ],
    )
    persisted++
  }
  return { scanned: cves.length, persisted }
}


// ---- 4. Actor-anchored pass ----------------------------------------

async function runActorPass(): Promise<{ scanned: number; persisted: number }> {
  const actorRows = (await query(
    `SELECT actor_name, COUNT(*) AS cve_count
     FROM intel_actor_cve_links
     GROUP BY actor_name
     ORDER BY cve_count DESC
     LIMIT 25`,
    [],
  )).data || []
  const actors = (actorRows as Array<Record<string, unknown>>).map((r) => String(r.actor_name))
  if (actors.length === 0) return { scanned: 0, persisted: 0 }

  let persisted = 0
  for (const actor of actors) {
    const [cveLinks, breaches, darknet, paste] = await Promise.all([
      query(
        `SELECT cve_id, relationship, confidence, last_seen FROM intel_actor_cve_links
         WHERE actor_name = $1 ORDER BY confidence DESC`,
        [actor],
      ),
      query(
        `SELECT victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity
         FROM intel_actor_breach_links WHERE actor_name = $1 ORDER BY breach_date DESC NULLS LAST`,
        [actor],
      ),
      query(
        `SELECT post_uid, title, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at
         FROM intel_darknet_posts WHERE threat_actor = $1 ORDER BY discovered_at DESC LIMIT 20`,
        [actor],
      ),
      query(
        `SELECT post_uid, title, severity, discovered_at, matched_cves
         FROM intel_paste_posts WHERE threat_actor = $1 ORDER BY discovered_at DESC LIMIT 20`,
        [actor],
      ),
    ])

    const cves = ((cveLinks.data || []) as Array<Record<string, unknown>>).map((r) => String(r.cve_id))
    const breachRows = (breaches.data || []) as Array<Record<string, unknown>>
    const darknetRows = (darknet.data || []) as Array<Record<string, unknown>>
    const pasteRows = (paste.data || []) as Array<Record<string, unknown>>

    if (cves.length === 0 && breachRows.length === 0 && darknetRows.length === 0 && pasteRows.length === 0) {
      continue
    }

    // Pull MITRE description for the actor (best-effort)
    const meta = await query(
      `SELECT name, aliases, description FROM intel_mitre_groups
       WHERE name = $1 OR $1 = ANY(aliases) LIMIT 1`,
      [actor],
    )
    const metaRow = ((meta.data as Array<Record<string, unknown>>) || [])[0]

    const signals: CorrelationSignal[] = []
    for (const link of (cveLinks.data || []) as Array<Record<string, unknown>>) {
      signals.push({
        type: "actor_link",
        ref: String(link.cve_id),
        title: `${actor} ${link.relationship || "exploits"} ${link.cve_id}`,
        confidence: Number(link.confidence ?? 70),
        publishedAt: (link.last_seen as Date | null)?.toISOString(),
      })
    }
    for (const b of breachRows.slice(0, 8)) {
      signals.push({
        type: "ransomware_victim",
        ref: String(b.victim_name),
        title: `${b.victim_name} (${b.sector || "?"}, ${b.country || "?"})`,
        detail: String(b.breach_type || "data_leak"),
        severity: (b.severity as string) || undefined,
        confidence: Number(b.confidence ?? 80),
        publishedAt: (b.breach_date as Date | null)?.toISOString(),
      })
    }
    for (const d of darknetRows.slice(0, 6)) {
      signals.push({
        type: "darknet_post",
        ref: String(d.post_uid),
        title: String(d.title || ""),
        detail: `${d.victim_name || ""} · ${d.leak_type || ""}`,
        severity: (d.severity as string) || undefined,
        confidence: 80,
        publishedAt: (d.discovered_at as Date | null)?.toISOString(),
      })
    }
    for (const p of pasteRows.slice(0, 6)) {
      signals.push({
        type: "paste",
        ref: String(p.post_uid),
        title: String(p.title || ""),
        severity: (p.severity as string) || undefined,
        confidence: 80,
        publishedAt: (p.discovered_at as Date | null)?.toISOString(),
      })
    }

    const aliases = (metaRow?.aliases as string[]) || []
    const payload: ClusterPayload = {
      actor: {
        name: actor,
        aliases,
        description: metaRow?.description as string | undefined,
      },
      signals,
      relatedCves: cves,
      actors: [actor],
    }
    const { score, confidence } = scoreCluster(payload)
    const severity = severityFromRiskScore(score)
    const tags = buildTags(payload, score)
    tags.push("anchor:actor")
    const summary = `${actor} · ${cves.length} CVE link(s) · ${breachRows.length} breach(es) · ${darknetRows.length} dark-web post(s)`

    await query(
      `INSERT INTO intel_correlation_clusters
        (cluster_key, cluster_type, title, summary, risk_score, confidence, severity,
         signal_count, signals, tags, related_cves, anchor_actor, anchor_ransomware,
         first_seen, last_seen, auto_generated, updated_at)
       VALUES ($1, 'actor', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, NULL,
               NOW(), NOW(), true, NOW())
       ON CONFLICT (cluster_key) DO UPDATE SET
         title=EXCLUDED.title, summary=EXCLUDED.summary,
         risk_score=GREATEST(intel_correlation_clusters.risk_score, EXCLUDED.risk_score),
         confidence=EXCLUDED.confidence, severity=EXCLUDED.severity,
         signal_count=EXCLUDED.signal_count, signals=EXCLUDED.signals,
         tags=EXCLUDED.tags, related_cves=EXCLUDED.related_cves,
         anchor_actor=EXCLUDED.anchor_actor,
         last_seen=NOW(), updated_at=NOW()`,
      [
        `actor:${actor.toLowerCase()}`,
        `${actor} threat profile`,
        summary,
        score,
        confidence,
        severity,
        signals.length + 1,
        JSON.stringify(payload),
        tags,
        cves,
        actor,
      ],
    )
    persisted++
  }
  return { scanned: actors.length, persisted }
}


// ---- 5. Ransomware-anchored pass -----------------------------------

async function runRansomwarePass(): Promise<{ scanned: number; persisted: number }> {
  const groups = (await query(
    `SELECT slug, name, aliases, victim_count, sectors
     FROM intel_ransomware_groups
     WHERE active = true
       AND EXISTS (
         SELECT 1 FROM intel_ransomware_victims v
         WHERE v.group_name = intel_ransomware_groups.slug
           AND v.discovered_at > NOW() - INTERVAL '60 days'
       )
     ORDER BY victim_count DESC NULLS LAST
     LIMIT 20`,
    [],
  )).data || []

  let persisted = 0
  for (const g of groups as Array<Record<string, unknown>>) {
    const slug = String(g.slug)
    const name = String(g.name)

    const [victims, breaches, darknet, cveLinks] = await Promise.all([
      query(
        `SELECT victim_name, country, sector, discovered_at
         FROM intel_ransomware_victims
         WHERE group_name = $1
         ORDER BY discovered_at DESC NULLS LAST
         LIMIT 25`,
        [slug],
      ),
      query(
        `SELECT victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity
         FROM intel_actor_breach_links
         WHERE actor_name = $1 OR actor_name = $2
         ORDER BY breach_date DESC NULLS LAST
         LIMIT 25`,
        [name, slug],
      ),
      query(
        `SELECT post_uid, title, victim_name, victim_sector, victim_country, severity, discovered_at, leak_type
         FROM intel_darknet_posts
         WHERE threat_actor = $1 OR source LIKE $2
         ORDER BY discovered_at DESC LIMIT 30`,
        [name, `${slug}_%`],
      ),
      query(
        `SELECT cve_id, relationship, confidence FROM intel_actor_cve_links
         WHERE actor_name = $1 OR actor_name = $2
         ORDER BY confidence DESC LIMIT 25`,
        [name, slug],
      ),
    ])

    const victimRows = (victims.data || []) as Array<Record<string, unknown>>
    const breachRows = (breaches.data || []) as Array<Record<string, unknown>>
    const darkRows = (darknet.data || []) as Array<Record<string, unknown>>
    const cveRows = (cveLinks.data || []) as Array<Record<string, unknown>>

    if (victimRows.length === 0 && breachRows.length === 0 && darkRows.length === 0) continue

    const cves = cveRows.map((r) => String(r.cve_id))
    const signals: CorrelationSignal[] = []
    for (const v of victimRows.slice(0, 10)) {
      signals.push({
        type: "ransomware_victim",
        ref: String(v.victim_name),
        title: `${v.victim_name}`,
        detail: `${v.sector || "?"} · ${v.country || "?"}`,
        confidence: 75,
        publishedAt: (v.discovered_at as Date | null)?.toISOString(),
      })
    }
    for (const b of breachRows.slice(0, 6)) {
      signals.push({
        type: "ransomware_victim",
        ref: `breach:${b.victim_name}`,
        title: `Breach: ${b.victim_name}`,
        detail: `${b.breach_type || "data_leak"} · approx ${(b.record_count as number) ?? "?"} records`,
        severity: (b.severity as string) || undefined,
        confidence: Number(b.confidence ?? 80),
        publishedAt: (b.breach_date as Date | null)?.toISOString(),
      })
    }
    for (const d of darkRows.slice(0, 6)) {
      signals.push({
        type: "darknet_post",
        ref: String(d.post_uid),
        title: String(d.title || ""),
        detail: `${d.victim_name || ""} · ${d.leak_type || ""}`,
        severity: (d.severity as string) || undefined,
        confidence: 80,
        publishedAt: (d.discovered_at as Date | null)?.toISOString(),
      })
    }
    for (const c of cveRows.slice(0, 6)) {
      signals.push({
        type: "actor_link",
        ref: String(c.cve_id),
        title: `${name} ${c.relationship || "exploits"} ${c.cve_id}`,
        confidence: Number(c.confidence ?? 70),
      })
    }

    const aliases = (g.aliases as string[]) || []
    const payload: ClusterPayload = {
      ransomware: {
        name,
        aliases,
        victimCount: Number(g.victim_count ?? 0),
      },
      signals,
      relatedCves: cves,
      actors: [name],
    }
    const { score, confidence } = scoreCluster(payload)
    const severity = severityFromRiskScore(score)
    const tags = buildTags(payload, score)
    tags.push("anchor:ransomware")

    const sectors = (g.sectors as string[]) || []
    const summary = `${name} · ${victimRows.length} recent victim(s) · sectors: ${sectors.slice(0, 3).join(", ") || "n/a"}`

    await query(
      `INSERT INTO intel_correlation_clusters
        (cluster_key, cluster_type, title, summary, risk_score, confidence, severity,
         signal_count, signals, tags, related_cves, anchor_actor, anchor_ransomware,
         first_seen, last_seen, auto_generated, updated_at)
       VALUES ($1, 'ransomware', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NULL, $11,
               NOW(), NOW(), true, NOW())
       ON CONFLICT (cluster_key) DO UPDATE SET
         title=EXCLUDED.title, summary=EXCLUDED.summary,
         risk_score=GREATEST(intel_correlation_clusters.risk_score, EXCLUDED.risk_score),
         confidence=EXCLUDED.confidence, severity=EXCLUDED.severity,
         signal_count=EXCLUDED.signal_count, signals=EXCLUDED.signals,
         tags=EXCLUDED.tags, related_cves=EXCLUDED.related_cves,
         anchor_ransomware=EXCLUDED.anchor_ransomware,
         last_seen=NOW(), updated_at=NOW()`,
      [
        `rans:${slug}`,
        `${name} active campaign`,
        summary,
        score,
        confidence,
        severity,
        signals.length + 1,
        JSON.stringify(payload),
        tags,
        cves,
        name,
      ],
    )
    persisted++
  }
  return { scanned: groups.length, persisted }
}


// ---- 6. Public API -------------------------------------------------

export async function runDeepCorrelationPass(): Promise<{
  scanned: number
  persisted: number
  byAnchor: { cve: number; actor: number; ransomware: number }
}> {
  const [cvePass, actorPass, ransPass] = await Promise.all([
    runCvePass(),
    runActorPass(),
    runRansomwarePass(),
  ])

  const persisted = cvePass.persisted + actorPass.persisted + ransPass.persisted
  const scanned = cvePass.scanned + actorPass.scanned + ransPass.scanned

  if (persisted > 0) {
    await emitAutomationEvent("cluster.upserted", {
      count: persisted,
      byAnchor: {
        cve: cvePass.persisted,
        actor: actorPass.persisted,
        ransomware: ransPass.persisted,
      },
    })
  }

  return {
    scanned,
    persisted,
    byAnchor: {
      cve: cvePass.persisted,
      actor: actorPass.persisted,
      ransomware: ransPass.persisted,
    },
  }
}

export async function getDeepClusters(
  limit = 30,
  type?: ClusterType,
): Promise<DeepCluster[]> {
  const params: unknown[] = []
  let where = ""
  if (type) {
    params.push(type)
    where = `WHERE cluster_type = $${params.length}`
  }
  params.push(limit)
  const r = await query(
    `SELECT cluster_key, cluster_type, title, summary, risk_score, confidence, severity,
            signal_count, signals, tags, related_cves, anchor_actor, anchor_ransomware,
            first_seen, last_seen
     FROM intel_correlation_clusters
     ${where}
     ORDER BY risk_score DESC, last_seen DESC
     LIMIT $${params.length}`,
    params,
  )
  if (!r.success) return []
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    clusterKey: String(row.cluster_key),
    clusterType: String(row.cluster_type) as ClusterType,
    title: String(row.title),
    summary: String(row.summary || ""),
    riskScore: Number(row.risk_score),
    confidence: Number(row.confidence ?? 50),
    severity: String(row.severity) as FindingSeverity,
    signalCount: Number(row.signal_count),
    signals: (row.signals as ClusterPayload) || { signals: [] },
    tags: (row.tags as string[]) || [],
    relatedCves: (row.related_cves as string[]) || [],
    anchorActor: (row.anchor_actor as string | null) ?? null,
    anchorRansomware: (row.anchor_ransomware as string | null) ?? null,
    firstSeen: (row.first_seen as Date).toISOString(),
    lastSeen: (row.last_seen as Date).toISOString(),
  }))
}
