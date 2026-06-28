import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { getAISettings } from "@/lib/ai-settings"
import { query as dbQuery } from "@/lib/db"

function compactResult(result: any) {
  if (!result || typeof result !== "object") return result
  return {
    FileName: result.FileName,
    FilePath: result.FilePath,
    LineNum: result.LineNum,
    Content: String(result.Content || result.Preview || "").slice(0, 500),
    Preview: String(result.Preview || "").slice(0, 300),
    fileType: result.fileType,
    displayPath: result.displayPath,
    totalMatchesInFile: result.totalMatchesInFile,
    isBlurred: result.isBlurred,
    face_id: result.face_id || result.id,
    identity_id: result.identity_id,
    score: result.score,
    confidence: result.confidence,
    metadata: result.metadata,
    threads_profile: result.threads_profile,
    intel: result.intel,
    identity: result.identity,
  }
}

function detectQueryType(q: string): string {
  const v = q.trim()
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return "cve"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return "hash"
  if (/^https?:\/\//i.test(v)) return "url"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) && !v.includes(" ")) return "domain"
  return "keyword"
}

function extractCandidateQueries(payload: any) {
  const terms = new Set<string>()
  const add = (value: any) => {
    const text = String(value || "").trim()
    if (text.length >= 2 && text.length <= 120) terms.add(text)
  }

  add(payload.query)
  const selected = payload.selectedResult || {}
  add(selected.FileName)
  add(selected.displayPath)
  add(selected.identity_id)
  add(selected.threads_profile?.username)
  add(selected.identity?.name)

  for (const result of Array.isArray(payload.results) ? payload.results.slice(0, 5) : []) {
    add(result.FileName)
    add(result.displayPath)
    add(result.identity_id)
    add(result.threads_profile?.username)
    add(result.identity?.name)
  }

  const blob = JSON.stringify(payload).slice(0, 8000)
  for (const match of blob.matchAll(/CVE-\d{4}-\d{4,}/gi)) add(match[0])
  for (const match of blob.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) add(match[0])
  for (const match of blob.matchAll(/https?:\/\/[^\s"'<>]+/gi)) add(match[0].slice(0, 120))
  for (const match of blob.matchAll(/\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g)) add(match[0])

  return Array.from(terms).slice(0, 5)
}

async function safeQuery(sql: string, params: any[] = []) {
  try {
    const result = await dbQuery(sql, params)
    return result.success ? result.data || [] : []
  } catch {
    return []
  }
}

async function correlateTerm(term: string) {
  const type = detectQueryType(term)
  const like = `%${term}%`

  const [news, cves, darknet, phishing, actors, exploits, malware, aptCampaigns, githubSecrets, demoCorpus] = await Promise.all([
    safeQuery(`SELECT title, url, category, published_at FROM intel_news_cache WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 4`, [like]),
    safeQuery(`SELECT cve_id, description, cvss_v3_severity, cvss_v3_score, is_kev, vendor, product FROM intel_cve_cache WHERE description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 OR cve_id ILIKE $1 ORDER BY published_at DESC LIMIT 4`, [like]),
    safeQuery(`SELECT post_uid, source, title, threat_actor, victim_name, victim_sector, severity, leak_type, discovered_at FROM intel_darknet_posts WHERE title ILIKE $1 OR threat_actor ILIKE $1 OR victim_name ILIKE $1 OR content ILIKE $1 ORDER BY discovered_at DESC LIMIT 4`, [like]),
    safeQuery(`SELECT phish_id, url, target_brand, phish_type, active, reported_at FROM intel_phishing_cache WHERE url ILIKE $1 OR target_brand ILIKE $1 LIMIT 4`, [like]),
    safeQuery(`SELECT name, group_id, aliases, description, techniques, sectors FROM intel_mitre_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    safeQuery(`SELECT exploit_id, title, cve_id, exploit_type, platform, poc_url, published_at FROM intel_exploit_cache WHERE title ILIKE $1 OR cve_id ILIKE $1 OR description ILIKE $1 ORDER BY published_at DESC LIMIT 3`, [like]),
    safeQuery(`SELECT sha256, file_name, malware_family, tags, source, first_seen FROM intel_malware_cache WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 OR file_name ILIKE $1 LIMIT 3`, [like]),
    safeQuery(`SELECT campaign_id, campaign_name, threat_actor, target_sectors, target_countries, is_active, confidence, description FROM intel_apt_campaigns WHERE campaign_name ILIKE $1 OR threat_actor ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
    safeQuery(`SELECT finding_id, repo_name, file_path, secret_type, risk_level, still_exposed, discovered_at FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 LIMIT 3`, [like]),
    safeQuery(`SELECT id, timestamp, doc_type, source_name, title, summary, severity, risk_score, confidence, tags, entities, iocs, redaction_level FROM intel_demo_corpus WHERE title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1 OR entities::text ILIKE $1 OR iocs::text ILIKE $1 ORDER BY risk_score DESC, timestamp DESC LIMIT 4`, [like]),
  ])

  return {
    term,
    type,
    sources: {
      news,
      cves,
      darknet,
      phishing,
      actors,
      exploits,
      malware,
      aptCampaigns,
      githubSecrets,
    },
    hitCounts: {
      news: news.length,
      cves: cves.length,
      darknet: darknet.length,
      phishing: phishing.length,
      actors: actors.length,
      exploits: exploits.length,
      malware: malware.length,
      aptCampaigns: aptCampaigns.length,
      githubSecrets: githubSecrets.length,
    },
  }
}

async function buildEvidenceBundle(payload: any) {
  const query = String(payload.query || "")
  const mode = String(payload.mode || "text")
  const results = Array.isArray(payload.results) ? payload.results.slice(0, 8).map(compactResult) : []
  const selected = payload.selectedResult ? compactResult(payload.selectedResult) : null
  const candidateQueries = extractCandidateQueries(payload)
  const correlations = await Promise.all(candidateQueries.map(correlateTerm))
  const resultIntel = results
    .map((result: any) => result?.intel)
    .filter(Boolean)
    .slice(0, 5)

  const sourceCoverage = correlations.map((entry) => ({ term: entry.term, type: entry.type, hitCounts: entry.hitCounts }))
  const totalRelatedHits = sourceCoverage.reduce((sum, entry) => sum + Object.values(entry.hitCounts).reduce((a: number, b: any) => a + Number(b || 0), 0), 0)

  return {
    query,
    mode,
    filters: payload.filters || {},
    selected,
    currentResults: results,
    candidateQueries,
    relatedIntel: correlations,
    resultIntel,
    sourceCoverage,
    evidenceSummary: {
      currentResultCount: Array.isArray(payload.results) ? payload.results.length : 0,
      analyzedResultCount: results.length,
      enrichmentTerms: candidateQueries.length,
      totalRelatedHits,
      hasSelectedResult: !!selected,
      hasFaceContext: mode === "face" || results.some((r: any) => r.face_id || r.threads_profile),
    },
  }
}

function buildPrompt(evidence: any) {
  return `You are an OSINT analyst. Make a reasoned judgement from current search results plus related intel sources.

Evidence bundle:
${JSON.stringify(evidence, null, 2)}

Return strict JSON with keys:
- executiveSummary (string)
- shortTitle (string)
- confidenceScore (number 0-100)
- likelyJudgement (string: what is most likely true based on evidence)
- evidenceSummary (array of strings grouped by source)
- crossSourceCorrelations (array of strings)
- sourceCoverage (array of strings)
- keyFindings (array of strings)
- whyItMatters (array of strings)
- entities (array of objects with label, type, confidence, evidence)
- indicators (array of objects with label, type, value, evidence)
- patterns (array of strings)
- risks (array of strings)
- contradictionsOrGaps (array of strings)
- suggestedNextSteps (array of strings)
- bestFollowUpQueries (array of strings)
- pivots (array of strings)
- timeline (array of objects with label, detail)
- confidenceDrivers (array of strings)
- confidenceNotes (string)

Rules:
- judge what evidence supports, but do not invent facts
- cite source types when making claims: search result, news, CVE, darknet, phishing, actor, exploit, malware, APT, GitHub secret, face/social
- explicitly mention gaps and weak evidence
- prefer actionable investigative pivots
- keep concise but analyst-grade.`
}

async function callProvider(settings: NonNullable<Awaited<ReturnType<typeof getAISettings>>>, prompt: string) {
  const baseUrl = settings.baseUrl || undefined
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  switch (settings.provider) {
    case "anthropic": {
      const url = `${baseUrl || "https://api.anthropic.com"}/v1/messages`
      return fetch(url, {
        method: "POST",
        headers: { ...headers, "x-api-key": settings.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: settings.model, max_tokens: 1400, messages: [{ role: "user", content: prompt }] }),
      })
    }
    case "google": {
      const url = `${baseUrl || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`
      return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1400 } }),
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
          max_tokens: 1400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return only valid JSON. Act as a careful OSINT analyst making evidence-backed judgements." },
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

function normalizeValue(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (typeof value === "object") {
    const output: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) {
      output[key] = normalizeValue(entry)
    }
    return output
  }
  return String(value)
}

function normalizeArray(value: any): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => {
      const normalized = normalizeValue(item)
      if (normalized && typeof normalized === "object") return JSON.stringify(normalized)
      return String(normalized)
    })
    .filter(Boolean)
}

function normalizeObjects(value: any): any[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(Boolean)
    .map((item) => {
      const normalized = normalizeValue(item)
      if (normalized && typeof normalized === "object") return normalized
      return { value: String(normalized) }
    })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.authorized) return createAuthResponse(auth.error, auth.status)

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)

    const settings = await getAISettings(auth.user.user_id)
    if (!settings || !settings.enabled) {
      return NextResponse.json({ success: false, error: "AI settings not configured" }, { status: 400 })
    }

    const evidence = await buildEvidenceBundle(body)
    const prompt = buildPrompt(evidence)
    const response = await callProvider(settings, prompt)
    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json({ success: false, error: `AI provider error: ${response.status}`, provider: settings.provider, details: errorText.slice(0, 1000) }, { status: 502 })
    }

    const raw = await response.json()
    const text = parseProviderResponse(settings.provider, raw)
    let parsed: any = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = {
        executiveSummary: text,
        shortTitle: "AI Analysis",
        confidenceScore: 50,
        confidenceNotes: "Provider did not return strict JSON.",
      }
    }

    parsed.executiveSummary = String(parsed.executiveSummary || parsed.summary || "")
    parsed.shortTitle = String(parsed.shortTitle || "AI Analysis")
    parsed.likelyJudgement = String(parsed.likelyJudgement || "")
    parsed.confidenceScore = Number.isFinite(Number(parsed.confidenceScore)) ? Math.max(0, Math.min(100, Number(parsed.confidenceScore))) : 50
    for (const key of ["evidenceSummary", "crossSourceCorrelations", "sourceCoverage", "keyFindings", "whyItMatters", "patterns", "risks", "contradictionsOrGaps", "suggestedNextSteps", "bestFollowUpQueries", "pivots", "confidenceDrivers"]) {
      parsed[key] = normalizeArray(parsed[key])
    }
    parsed.entities = normalizeObjects(parsed.entities)
    parsed.indicators = normalizeObjects(parsed.indicators)
    parsed.timeline = normalizeObjects(parsed.timeline)
    parsed.confidenceNotes = String(parsed.confidenceNotes || "")

    return NextResponse.json({ success: true, analysis: parsed, evidence: { summary: evidence.evidenceSummary, sourceCoverage: evidence.sourceCoverage } })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to generate AI analysis" }, { status: 500 })
  }
}
