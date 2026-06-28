import { NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { getAISettings } from "@/lib/ai-settings"
import { query as dbQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

type AISettings = NonNullable<Awaited<ReturnType<typeof getAISettings>>>

async function safeQuery(sql: string, params: any[] = []) {
  try {
    const result = await dbQuery(sql, params)
    return result.success ? result.data || [] : []
  } catch {
    return []
  }
}

function compactRows(rows: any[], max = 8) {
  return rows.slice(0, max).map((row) => {
    const output: Record<string, any> = {}
    for (const [key, value] of Object.entries(row || {})) {
      if (value === null || value === undefined) continue
      if (typeof value === "string") output[key] = value.slice(0, 700)
      else output[key] = value
    }
    return output
  })
}

function extractTerms(input: string) {
  const terms = new Set<string>()
  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length >= 2 && trimmed.length <= 140) terms.add(trimmed)
  }

  add(input)
  for (const match of input.matchAll(/CVE-\d{4}-\d{4,}/gi)) add(match[0])
  for (const match of input.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) add(match[0])
  for (const match of input.matchAll(/https?:\/\/[^\s"'<>]+/gi)) add(match[0])
  for (const match of input.matchAll(/\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g)) add(match[0])
  for (const match of input.matchAll(/\b[A-Z0-9][A-Z0-9._-]{3,}\b/gi)) add(match[0])

  return Array.from(terms).slice(0, 8)
}

async function collectTermEvidence(term: string) {
  const like = `%${term}%`
  const [
    entities,
    findings,
    relationships,
    alerts,
    cases,
    reports,
    news,
    cves,
    phishing,
    darknet,
    exploits,
    malware,
    aptCampaigns,
    sigma,
    yara,
    githubSecrets,
    demoCorpus,
  ] = await Promise.all([
    safeQuery(`SELECT id, entity_type, value, risk_score, confidence, first_seen, last_seen FROM intel_entities WHERE value ILIKE $1 OR normalized_value ILIKE $1 ORDER BY risk_score DESC, last_seen DESC LIMIT 8`, [like]),
    safeQuery(`SELECT id, title, severity, risk_score, confidence, source_type, source_name, first_seen, last_seen FROM intel_findings WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY risk_score DESC, last_seen DESC LIMIT 8`, [like]),
    safeQuery(`SELECT relationship_type, confidence, weight, source_name, created_at FROM intel_relationships WHERE evidence::text ILIKE $1 OR source_name ILIKE $1 ORDER BY weight DESC, created_at DESC LIMIT 8`, [like]),
    safeQuery(`SELECT id, alert_type, severity, title, status, created_at FROM monitoring_alerts WHERE title ILIKE $1 OR message ILIKE $1 ORDER BY created_at DESC LIMIT 8`, [like]),
    safeQuery(`SELECT id, title, status, priority, created_at, updated_at FROM intel_cases WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY updated_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT id, title, report_type, status, created_at FROM intel_reports WHERE title ILIKE $1 OR executive_summary ILIKE $1 ORDER BY created_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT title, url, category, source, published_at FROM intel_news_cache WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT cve_id, description, cvss_v3_severity, cvss_v3_score, is_kev, vendor, product, published_at FROM intel_cve_cache WHERE cve_id ILIKE $1 OR description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 ORDER BY published_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT phish_id, url, target_brand, phish_type, active, verified, reported_at FROM intel_phishing_cache WHERE url ILIKE $1 OR target_brand ILIKE $1 ORDER BY reported_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT post_uid, source, title, threat_actor, victim_name, victim_sector, severity, leak_type, discovered_at FROM intel_darknet_posts WHERE title ILIKE $1 OR threat_actor ILIKE $1 OR victim_name ILIKE $1 OR content ILIKE $1 ORDER BY discovered_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT exploit_id, title, cve_id, exploit_type, platform, verified, poc_url, published_at FROM intel_exploit_cache WHERE title ILIKE $1 OR cve_id ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 6`, [like]),
    safeQuery(`SELECT sha256, file_name, malware_family, source, first_seen FROM intel_malware_cache WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR file_name ILIKE $1 LIMIT 6`, [like]),
    safeQuery(`SELECT campaign_id, campaign_name, threat_actor, target_sectors, target_countries, is_active, confidence, first_reported, last_updated FROM intel_apt_campaigns WHERE campaign_name ILIKE $1 OR threat_actor ILIKE $1 OR description ILIKE $1 LIMIT 6`, [like]),
    safeQuery(`SELECT rule_id, title, level, logsource_product, technique_id, tactic, status FROM intel_sigma_rules WHERE title ILIKE $1 OR description ILIKE $1 OR technique_id::text ILIKE $1 LIMIT 6`, [like]),
    safeQuery(`SELECT rule_name, category, severity, target_family, mitre_techniques, source_repo FROM intel_yara_rules WHERE rule_name ILIKE $1 OR description ILIKE $1 OR target_family::text ILIKE $1 LIMIT 6`, [like]),
    safeQuery(`SELECT finding_id, repo_name, file_path, secret_type, risk_level, still_exposed, discovered_at FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 OR secret_type ILIKE $1 LIMIT 6`, [like]),
    safeQuery(`SELECT id, timestamp, doc_type, source_name, title, summary, body, severity, risk_score, confidence, tags, entities, iocs, redaction_level FROM intel_demo_corpus WHERE title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1 OR entities::text ILIKE $1 OR iocs::text ILIKE $1 ORDER BY risk_score DESC, timestamp DESC LIMIT 8`, [like]),
  ])

  const sources = { entities, findings, relationships, alerts, cases, reports, news, cves, phishing, darknet, exploits, malware, aptCampaigns, sigma, yara, githubSecrets, demoCorpus }
  return {
    term,
    sources: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, compactRows(value as any[])])),
    counts: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, (value as any[]).length])),
  }
}

async function buildEvidence(question: string) {
  const terms = extractTerms(question)
  const [termEvidence, feedHealth, sourceRuns] = await Promise.all([
    Promise.all(terms.map(collectTermEvidence)),
    safeQuery(`SELECT source_key, source_name, source_type, enabled, trust_score, last_success_at, last_error FROM intel_sources ORDER BY source_key LIMIT 30`, []),
    safeQuery(`SELECT source_key, status, started_at, fetched_count, stored_count, error_message, duration_ms FROM intel_scraper_runs ORDER BY started_at DESC LIMIT 30`, []),
  ])

  return {
    question,
    terms,
    termEvidence,
    platformEvidence: {
      sourceRegistry: compactRows(feedHealth, 30),
      recentScraperRuns: compactRows(sourceRuns, 30),
    },
    evidenceRules: [
      "Use only cited stored platform evidence.",
      "If evidence is missing, state gap clearly.",
      "Use CTI analyst framing, not generic OSINT framing.",
    ],
  }
}

function buildPrompt(evidence: any) {
  return `You are a senior CTI analyst inside an enterprise intelligence SaaS platform. Answer with evidence-backed judgement from stored platform intelligence only.

Evidence bundle:
${JSON.stringify(evidence, null, 2)}

Return strict JSON with keys:
- executiveSummary (string)
- answer (string)
- confidenceScore (number 0-100)
- keyFindings (array of strings)
- evidenceCitations (array of objects with claim, sourceType, sourceId, evidence, confidence)
- correlations (array of strings)
- affectedEntities (array of objects with label, type, risk, evidence)
- indicators (array of objects with type, value, risk, evidence)
- timeline (array of objects with date, event, sourceType)
- operationalImpact (array of strings)
- recommendedActions (array of strings)
- investigationPivots (array of strings)
- gapsAndLimitations (array of strings)
- sourceHealthNotes (array of strings)
- analystNotes (string)

Rules:
- no invented facts
- cite sourceType and sourceId for every strong claim when possible
- distinguish confirmed, likely, possible, and unknown
- keep answer useful for SOC, threat intel, and executive workflows
- do not call it demo
- do not frame platform as only OSINT.`
}

async function callProvider(settings: AISettings, prompt: string) {
  const baseUrl = settings.baseUrl || undefined
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  switch (settings.provider) {
    case "anthropic": {
      const url = `${baseUrl || "https://api.anthropic.com"}/v1/messages`
      return fetch(url, {
        method: "POST",
        headers: { ...headers, "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: settings.model, max_tokens: 1800, messages: [{ role: "user", content: prompt }] }),
      })
    }
    case "google": {
      const url = `${baseUrl || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`
      return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1800 } }),
      })
    }
    case "deepseek":
    case "openai":
    case "custom":
    default: {
      const url = `${baseUrl || (settings.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com")}/v1/chat/completions`
      return fetch(url, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.2,
          max_tokens: 1800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return only valid JSON. Act as a careful CTI analyst using cited platform evidence." },
            { role: "user", content: prompt },
          ],
        }),
      })
    }
  }
}

function parseProviderResponse(provider: string, raw: any) {
  if (provider === "anthropic") return raw?.content?.[0]?.text || ""
  if (provider === "google") return raw?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""
  return raw?.choices?.[0]?.message?.content || ""
}

function normalizeArray(value: any): any[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== "") : []
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return createAuthResponse(auth.error, auth.status)

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)

    const question = String(body.question || "").trim()
    if (!question) return NextResponse.json({ success: false, error: "Question is required" }, { status: 400 })

    const settings = await getAISettings(auth.user.user_id)
    if (!settings || !settings.enabled) {
      return NextResponse.json({ success: false, error: "AI settings not configured" }, { status: 400 })
    }

    const evidence = await buildEvidence(question)
    const response = await callProvider(settings, buildPrompt(evidence))
    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json({ success: false, error: `AI provider error: ${response.status}`, provider: settings.provider, details: errorText.slice(0, 1000) }, { status: 502 })
    }

    const raw = await response.json()
    const text = parseProviderResponse(settings.provider, raw)
    let answer: any
    try {
      answer = JSON.parse(text)
    } catch {
      answer = { executiveSummary: text, answer: text, confidenceScore: 50, gapsAndLimitations: ["Provider did not return strict JSON."] }
    }

    answer.executiveSummary = String(answer.executiveSummary || answer.summary || "")
    answer.answer = String(answer.answer || answer.executiveSummary || "")
    answer.confidenceScore = Number.isFinite(Number(answer.confidenceScore)) ? Math.max(0, Math.min(100, Number(answer.confidenceScore))) : 50
    for (const key of ["keyFindings", "evidenceCitations", "correlations", "affectedEntities", "indicators", "timeline", "operationalImpact", "recommendedActions", "investigationPivots", "gapsAndLimitations", "sourceHealthNotes"]) {
      answer[key] = normalizeArray(answer[key])
    }
    answer.analystNotes = String(answer.analystNotes || "")

    return NextResponse.json({ success: true, answer, evidence: { terms: evidence.terms, sourceCoverage: evidence.termEvidence.map((entry) => ({ term: entry.term, counts: entry.counts })) } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to run AI analyst" }, { status: 500 })
  }
}
