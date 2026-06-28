import { NextRequest } from "next/server"
import { validateSearchInput } from "@/lib/validation"
import { query as dbQuery } from "@/lib/db"
import { authenticateRequest } from "@/lib/jwt"

const severityColorMap: Record<string, string> = {
  critical: "red", CRITICAL: "red",
  high: "orange", HIGH: "orange",
  medium: "yellow", MEDIUM: "yellow",
  low: "blue", LOW: "blue",
}

function getSeverityColor(s?: string): string {
  return severityColorMap[s || ""] || "gray"
}

function blur(text: string, limit = 200): string {
  return text.length > limit ? text.substring(0, limit) + "..." : text
}

const BLURRED_DARK = `[PREMIUM CONTENT - Dark Web Intelligence]

This data is only available for premium users.
Upgrade to unlock access to dark web threat intelligence.`

const BLURRED_STEALER = `[PREMIUM CONTENT - Stealer Logs]

Credential data available for premium users only.`

const BLURRED_PHISH = `[PREMIUM CONTENT - Phishing Data]

Phishing intelligence available for premium users only.`

const BLURRED_PASTE = `[PREMIUM CONTENT - Paste Site Data]

Paste site intelligence available for premium users only.`

interface SearchResult {
  source: string
  sourceLabel: string
  sourceIcon: string
  FilePath: string
  FileName: string
  LineNum: number
  Content: string
  Preview: string
  fileType: string
  isBlurred: boolean
  displayPath: string
  category: string
  severity?: string
  severityColor?: string
  [key: string]: any
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.trim() || ""
  const type = searchParams.get("type")?.trim() || ""

  const validation = validateSearchInput(query)
  if (!validation.valid || !validation.sanitized) {
    return new Response(
      JSON.stringify({ type: "error", error: validation.errors[0] || "Invalid query" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const sanitizedQuery = validation.sanitized

  const authResult = await authenticateRequest(request)
  const sessionUser = authResult?.isValid && authResult?.user
    ? { id: authResult.user.userId }
    : null

  const isGuest = !sessionUser?.id
  let isAdmin = false
  let maxResults = 8
  let shouldBlur = true
  let guestOnly = isGuest

  if (!isGuest) {
    const userResult = await dbQuery(
      `SELECT subscription_type, is_lifetime, search_limit, search_count, role
       FROM users WHERE id = $1`,
      [sessionUser!.id]
    )

    if (!userResult.success || !userResult.data?.length) {
      return new Response(JSON.stringify({ type: "error", error: "User not found" }), { status: 404 })
    }

    const user = userResult.data[0]
    isAdmin = user.role === "admin"
    const subType = (user.subscription_type || "").toLowerCase()

    if (!isAdmin && user.search_count >= user.search_limit) {
      return new Response(
        JSON.stringify({ type: "error", error: "Search limit exceeded", searches_used: user.search_count, searches_limit: user.search_limit }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    maxResults = 10
    shouldBlur = true
    if (isAdmin || user.is_lifetime || subType === "enterprise" || subType === "api_access") {
      maxResults = 500
      shouldBlur = false
    } else if (subType === "professional") {
      maxResults = 200
      shouldBlur = false
    } else if (subType === "starter") {
      maxResults = 50
      shouldBlur = false
    }
    guestOnly = false
  }

  const clientLimit = Math.min(parseInt(searchParams.get("limit") || "50", 10), maxResults)
  const searchLike = `%${sanitizedQuery}%`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendResult = (result: SearchResult) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "result", data: result }) + "\n"))
      }
      const sendStatus = (status: string, message: string) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "status", status, message }) + "\n"))
      }

      const sources: string[] = []
      let count = 0

      try {
        // ─── SOURCE 1: Full-text index on search_index_lines ───
        if (!guestOnly && (!type || type === "all" || type === "index" || type === "files")) {
          sendStatus("searching", "Searching indexed files...")
          const res = await dbQuery(
            `SELECT
               f.file_path, f.file_name, f.file_type, f.file_size, f.category,
               l.line_number, l.content, l.country,
               ts_headline('english', l.content, plainto_tsquery('english', $1),
                 'MaxWords=30, MinWords=10, MaxFragments=2, StartSel=<mark>, StopSel=</mark>') AS highlighted,
               ts_rank(l.search_vector, plainto_tsquery('english', $1)) AS rank
             FROM search_index_lines l
             JOIN search_index f ON f.file_path = l.file_path AND f.file_name = l.file_name
             WHERE l.search_vector @@ plainto_tsquery('english', $1)
             ORDER BY rank DESC, l.line_number ASC
             LIMIT $2`,
            [sanitizedQuery, clientLimit]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("indexed files")
            for (const row of res.data) {
              if (count >= clientLimit) break
              const fileType = (row.file_type || "txt").toLowerCase()
              const isPremiumType = ["rar", "zip", "7z", "sql", "json", "xml", "csv"].includes(fileType)
              const blurred = shouldBlur && isPremiumType && !isAdmin
              const plain = (row.highlighted?.replace(/<\/?mark>/g, "") || row.content || "").substring(0, 250)

              sendResult({
                source: "index",
                sourceLabel: "Indexed Files",
                sourceIcon: "database",
                FilePath: row.file_path || "",
                FileName: row.file_name || "",
                LineNum: row.line_number || 0,
                Content: blurred ? "[Premium File Content]" : row.content || "",
                Preview: blurred ? "[Premium File Content]" : blur(plain),
                highlightedContent: blurred ? "" : row.highlighted || "",
                fileType,
                fileSize: row.file_size || 0,
                isBlurred: blurred,
                displayPath: (row.file_path || "").replace(/\\/g, "/").replace(/^\/data\//, ""),
                country: row.country || "",
                category: row.category || fileType,
                rank: row.rank,
              })
              count++
            }
          }
        }

        // ─── SOURCE 2: Dark Web Posts ───
        if (!guestOnly && count < clientLimit && (!type || type === "all" || type === "darkweb" || type === "darkweb_market")) {
          sendStatus("searching", "Searching dark web intelligence...")
          const res = await dbQuery(
            `SELECT post_uid, source, source_type, title, content, url, threat_actor, victim_name,
                    victim_sector, victim_country, leak_type, severity, discovered_at
             FROM intel_darknet_posts
             WHERE title ILIKE $1 OR content ILIKE $1 OR threat_actor ILIKE $1
                OR victim_name ILIKE $1 OR source ILIKE $1 OR leak_type ILIKE $1
             ORDER BY discovered_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 50)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("dark web")
            const blurred = shouldBlur && !isAdmin
            for (const row of res.data) {
              if (count >= clientLimit) break
              sendResult({
                source: "darkweb",
                sourceLabel: "Dark Web",
                sourceIcon: "globe",
                FilePath: row.url || `darkweb://${row.post_uid}`,
                FileName: row.title || row.victim_name || row.source || "Dark Web Record",
                LineNum: 0,
                Content: [blurred ? BLURRED_DARK : row.content, row.threat_actor ? `Threat Actor: ${row.threat_actor}` : "", row.victim_name ? `Victim: ${row.victim_name}` : "", row.victim_sector ? `Sector: ${row.victim_sector}` : "", row.victim_country ? `Country: ${row.victim_country}` : "", row.severity ? `Severity: ${row.severity}` : "", row.leak_type ? `Leak Type: ${row.leak_type}` : ""].filter(Boolean).join("\n"),
                Preview: blurred ? "[Dark Web Intelligence - Premium]" : blur(row.content || row.title || "", 250),
                fileType: "darkweb",
                isBlurred: blurred,
                displayPath: `Dark Web / ${row.source || "Market"}`,
                category: row.source_type || "darkweb_market",
                threatActor: row.threat_actor,
                victimName: row.victim_name,
                victimSector: row.victim_sector,
                victimCountry: row.victim_country,
                leakType: row.leak_type,
                severity: row.severity,
                severityColor: getSeverityColor(row.severity),
                discoveredAt: row.discovered_at,
              })
              count++
            }
          }
        }

        // ─── SOURCE 3: Demo CTI Corpus ───
        if (count < clientLimit && (!type || type === "all" || type === "demo" || type === "cti")) {
          sendStatus("searching", "Searching CTI corpus...")
          const res = await dbQuery(
            `SELECT id, timestamp, doc_type, source_name, title, summary, body, severity,
                    risk_score, confidence, tags, entities, iocs, redaction_level
             FROM intel_demo_corpus
             WHERE title ILIKE $1 OR summary ILIKE $1 OR body ILIKE $1 OR source_name ILIKE $1
                OR COALESCE(entities::text, '') ILIKE $1
                OR COALESCE(iocs::text, '') ILIKE $1
             ORDER BY risk_score DESC, timestamp DESC
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 50)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("CTI corpus")
            for (const row of res.data) {
              if (count >= clientLimit) break
              const tags = Array.isArray(row.tags) ? row.tags.join(", ") : ""
              sendResult({
                source: "demo",
                sourceLabel: "CTI Corpus",
                sourceIcon: "shield",
                FilePath: `demo://${row.id}`,
                FileName: row.title || row.id,
                LineNum: 0,
                Content: [row.body, `Severity: ${row.severity}`, `Risk Score: ${row.risk_score}/100`, `Confidence: ${row.confidence}%`, `Doc Type: ${row.doc_type}`, tags ? `Tags: ${tags}` : ""].filter(Boolean).join("\n"),
                Preview: blur(row.summary || row.body || "", 250),
                fileType: row.doc_type || "cti",
                isBlurred: false,
                displayPath: `CTI / ${row.source_name || "IntelForge"}`,
                category: row.doc_type || "cti",
                severity: row.severity,
                riskScore: row.risk_score,
                confidence: row.confidence,
                tags: row.tags || [],
                entities: row.entities || [],
                iocs: row.iocs || [],
                redactionLevel: row.redaction_level,
                safeDemo: true,
                severityColor: getSeverityColor(row.severity),
              })
              count++
            }
          }
        }

        // ─── SOURCE 4: Stealer Logs ───
        if (!guestOnly && count < clientLimit && (!type || type === "all" || type === "stealer" || type === "stealer_logs")) {
          sendStatus("searching", "Searching stealer logs...")
          const res = await dbQuery(
            `SELECT log_uid, stealer_family, machine_id, country, captured_url, domain,
                    login_user, password_redacted, record_type, captured_at
             FROM intel_stealer_logs
             WHERE domain ILIKE $1 OR login_user ILIKE $1 OR captured_url ILIKE $1
                OR stealer_family ILIKE $1 OR machine_id ILIKE $1
             ORDER BY captured_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 50)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("stealer logs")
            const blurred = shouldBlur && !isAdmin
            for (const row of res.data) {
              if (count >= clientLimit) break
              sendResult({
                source: "stealer",
                sourceLabel: "Stealer Logs",
                sourceIcon: "key",
                FilePath: row.captured_url || `stealer://${row.log_uid}`,
                FileName: `${row.stealer_family} | ${row.domain || "unknown"} | ${row.machine_id}`,
                LineNum: 0,
                Content: [blurred ? BLURRED_STEALER : `URL: ${row.captured_url}`, blurred ? "" : `Domain: ${row.domain}`, blurred ? "" : `Username: ${row.login_user}`, `Stealer: ${row.stealer_family}`, `Machine: ${row.machine_id}`, `Country: ${row.country}`, `Captured: ${row.captured_at}`].filter(Boolean).join("\n"),
                Preview: blurred ? "[Stealer Logs - Premium Content]" : `${row.stealer_family}: ${row.login_user} @ ${row.domain}`,
                fileType: "stealer_log",
                isBlurred: blurred,
                displayPath: `Stealer / ${row.stealer_family}`,
                category: "stealer",
                stealerFamily: row.stealer_family,
                machineId: row.machine_id,
                domain: row.domain,
                loginUser: row.login_user,
                country: row.country,
                capturedAt: row.captured_at,
                severityColor: "red",
              })
              count++
            }
          }
        }

        // ─── SOURCE 5: CVE Cache ───
        if (count < clientLimit && (!type || type === "all" || type === "cve" || type === "vulnerability")) {
          sendStatus("searching", "Searching CVE database...")
          const res = await dbQuery(
            `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, is_kev,
                    vendor, product, published_at
             FROM intel_cve_cache
             WHERE cve_id ILIKE $1 OR description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1
             ORDER BY cvss_v3_score DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 30)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("CVE database")
            for (const row of res.data) {
              if (count >= clientLimit) break
              const kevBadge = row.is_kev ? " [CISA KEV]" : ""
              sendResult({
                source: "cve",
                sourceLabel: "CVE Database",
                sourceIcon: "alert-triangle",
                FilePath: `cve://${row.cve_id}`,
                FileName: `${row.cve_id} — ${row.vendor} ${row.product}`,
                LineNum: 0,
                Content: [row.description, `CVSS: ${row.cvss_v3_score}/10 (${row.cvss_v3_severity})${kevBadge}`, `EPSS: ${row.epss_score}`, `Vendor: ${row.vendor}`, `Product: ${row.product}`, `Published: ${row.published_at}`].filter(Boolean).join("\n"),
                Preview: blur(row.description || "", 250),
                fileType: "cve",
                isBlurred: false,
                displayPath: `CVE / ${row.cve_id}`,
                category: "vulnerability",
                cveId: row.cve_id,
                cvssScore: row.cvss_v3_score,
                cvssSeverity: row.cvss_v3_severity,
                epssScore: row.epss_score,
                isKev: row.is_kev,
                vendor: row.vendor,
                product: row.product,
                severityColor: getSeverityColor(row.cvss_v3_severity),
              })
              count++
            }
          }
        }

        // ─── SOURCE 6: Malware Cache ───
        if (count < clientLimit && (!type || type === "all" || type === "malware")) {
          sendStatus("searching", "Searching malware database...")
          const res = await dbQuery(
            `SELECT sha256, file_name, file_type, malware_family, tags, source, iocs, last_seen
             FROM intel_malware_cache
             WHERE malware_family ILIKE $1 OR file_name ILIKE $1 OR source ILIKE $1
             ORDER BY last_seen DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 30)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("malware DB")
            for (const row of res.data) {
              if (count >= clientLimit) break
              const tags = Array.isArray(row.tags) ? row.tags.join(", ") : ""
              sendResult({
                source: "malware",
                sourceLabel: "Malware DB",
                sourceIcon: "bug",
                FilePath: `malware://${(row.sha256 || "").substring(0, 16)}`,
                FileName: `${row.malware_family} | ${row.file_name}`,
                LineNum: 0,
                Content: [row.description || `Malware Family: ${row.malware_family}`, `File Name: ${row.file_name}`, `File Type: ${row.file_type}`, tags ? `Tags: ${tags}` : "", `SHA256: ${(row.sha256 || "").substring(0, 32)}...`, `Last Seen: ${row.last_seen}`].filter(Boolean).join("\n"),
                Preview: `Family: ${row.malware_family} | File: ${row.file_name}`,
                fileType: row.file_type || "malware",
                isBlurred: false,
                displayPath: `Malware / ${row.malware_family}`,
                category: "malware",
                sha256: row.sha256,
                malwareFamily: row.malware_family,
                tags: row.tags,
                severityColor: "orange",
              })
              count++
            }
          }
        }

        // ─── SOURCE 7: Phishing Cache ───
        if (count < clientLimit && (!type || type === "all" || type === "phishing")) {
          sendStatus("searching", "Searching phishing database...")
          const res = await dbQuery(
            `SELECT phish_id, url, target_brand, phish_type, ip_address, country, active, reported_at, source
             FROM intel_phishing_cache
             WHERE url ILIKE $1 OR target_brand ILIKE $1 OR source ILIKE $1
             ORDER BY reported_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 30)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("phishing DB")
            const blurred = shouldBlur && !isAdmin
            for (const row of res.data) {
              if (count >= clientLimit) break
              sendResult({
                source: "phishing",
                sourceLabel: "Phishing DB",
                sourceIcon: "link",
                FilePath: row.url,
                FileName: `${row.target_brand} phishing | ${(row.url || "").substring(0, 50)}`,
                LineNum: 0,
                Content: [blurred ? BLURRED_PHISH : `URL: ${row.url}`, blurred ? "" : `Target Brand: ${row.target_brand}`, `Phish Type: ${row.phish_type}`, blurred ? "" : `IP: ${row.ip_address}`, `Country: ${row.country}`, `Active: ${row.active ? "Yes" : "No"}`, `Source: ${row.source}`].filter(Boolean).join("\n"),
                Preview: blurred ? "[Phishing URL - Premium]" : `${row.target_brand}: ${row.url}`,
                fileType: "phishing",
                isBlurred: blurred,
                displayPath: `Phishing / ${row.target_brand}`,
                category: "phishing",
                targetBrand: row.target_brand,
                phishType: row.phish_type,
                ipAddress: row.ip_address,
                country: row.country,
                active: row.active,
                severityColor: "orange",
              })
              count++
            }
          }
        }

        // ─── SOURCE 8: Intel News ───
        if (count < clientLimit && (!type || type === "all" || type === "news")) {
          sendStatus("searching", "Searching CTI news...")
          const res = await dbQuery(
            `SELECT guid, title, description, url, source, source_label, category, published_at
             FROM intel_news_cache
             WHERE title ILIKE $1 OR description ILIKE $1 OR source ILIKE $1 OR category ILIKE $1
             ORDER BY published_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 30)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("CTI news")
            for (const row of res.data) {
              if (count >= clientLimit) break
              sendResult({
                source: "news",
                sourceLabel: "CTI News",
                sourceIcon: "newspaper",
                FilePath: row.url || `news://${row.guid}`,
                FileName: row.title || "News Article",
                LineNum: 0,
                Content: [row.description, `Source: ${row.source_label || row.source}`, `Category: ${row.category}`, `Published: ${row.published_at}`].filter(Boolean).join("\n"),
                Preview: blur(row.description || "", 250),
                fileType: "news",
                isBlurred: false,
                displayPath: `News / ${row.source_label || row.source}`,
                category: row.category || "news",
                publishedAt: row.published_at,
                severityColor: "blue",
              })
              count++
            }
          }
        }

        // ─── SOURCE 9: Paste Posts ───
        if (!guestOnly && count < clientLimit && (!type || type === "all" || type === "paste" || type === "pastebin")) {
          sendStatus("searching", "Searching paste sites...")
          const res = await dbQuery(
            `SELECT post_uid, source, title, excerpt, matched_brands, threat_actor, severity, discovered_at
             FROM intel_paste_posts
             WHERE title ILIKE $1 OR excerpt ILIKE $1 OR source ILIKE $1
                OR COALESCE(matched_brands::text, '') ILIKE $1
                OR threat_actor ILIKE $1
             ORDER BY discovered_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 30)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("paste sites")
            const blurred = shouldBlur && !isAdmin
            for (const row of res.data) {
              if (count >= clientLimit) break
              const brands = Array.isArray(row.matched_brands) ? row.matched_brands.join(", ") : ""
              sendResult({
                source: "paste",
                sourceLabel: "Paste Sites",
                sourceIcon: "file-text",
                FilePath: `paste://${row.post_uid}`,
                FileName: row.title || "Paste Post",
                LineNum: 0,
                Content: [blurred ? BLURRED_PASTE : row.excerpt, brands ? `Brands: ${brands}` : "", row.threat_actor ? `Actor: ${row.threat_actor}` : "", `Severity: ${row.severity}`, `Source: ${row.source}`, `Discovered: ${row.discovered_at}`].filter(Boolean).join("\n"),
                Preview: blurred ? "[Paste Content - Premium]" : blur(row.excerpt || "", 250),
                fileType: "paste",
                isBlurred: blurred,
                displayPath: `Paste / ${row.source}`,
                category: "paste",
                matchedBrands: row.matched_brands,
                threatActor: row.threat_actor,
                severity: row.severity,
                severityColor: getSeverityColor(row.severity),
              })
              count++
            }
          }
        }

        // ─── SOURCE 10: MITRE Groups ───
        if (count < clientLimit && (!type || type === "all" || type === "actors" || type === "apt")) {
          sendStatus("searching", "Searching threat actors...")
          const res = await dbQuery(
            `SELECT stix_id, name, group_id, aliases, description, sectors, countries
             FROM intel_mitre_groups
             WHERE name ILIKE $1 OR COALESCE(aliases::text, '') ILIKE $1 OR description ILIKE $1
             ORDER BY name ASC
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 20)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("threat actors")
            for (const row of res.data) {
              if (count >= clientLimit) break
              const aliases = Array.isArray(row.aliases) ? row.aliases.join(", ") : ""
              const sectors = Array.isArray(row.sectors) ? row.sectors.join(", ") : ""
              sendResult({
                source: "actors",
                sourceLabel: "Threat Actors",
                sourceIcon: "user-x",
                FilePath: `actor://${row.stix_id}`,
                FileName: `${row.name} (${row.group_id})`,
                LineNum: 0,
                Content: [row.description, aliases ? `Aliases: ${aliases}` : "", sectors ? `Sectors: ${sectors}` : "", `STIX ID: ${row.stix_id}`, `Group ID: ${row.group_id}`].filter(Boolean).join("\n"),
                Preview: blur(row.description || "", 250),
                fileType: "actor",
                isBlurred: false,
                displayPath: `Actors / ${row.name}`,
                category: "apt",
                aliases: row.aliases,
                sectors: row.sectors,
                severityColor: "red",
              })
              count++
            }
          }
        }

        // ─── SOURCE 11: Ransomware Victims ───
        if (count < clientLimit && (!type || type === "all" || type === "ransomware" || type === "victims")) {
          sendStatus("searching", "Searching ransomware victims...")
          const res = await dbQuery(
            `SELECT victim_uid, group_name, victim_name, victim_sector, victim_country,
                    ransom_amount, status, discovered_at, description, site_url, leak_size_gb
             FROM intel_ransomware_victims
             WHERE victim_name ILIKE $1 OR group_name ILIKE $1 OR victim_sector ILIKE $1 OR description ILIKE $1
             ORDER BY discovered_at DESC NULLS LAST
             LIMIT $2`,
            [searchLike, Math.min(clientLimit - count, 20)]
          ).catch(() => ({ success: false, data: [] as any[] }))

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sources.push("ransomware")
            const blurred = shouldBlur && !isAdmin
            for (const row of res.data) {
              if (count >= clientLimit) break
              sendResult({
                source: "ransomware",
                sourceLabel: "Ransomware",
                sourceIcon: "lock",
                FilePath: row.site_url || `ransomware://${row.victim_uid}`,
                FileName: `${row.victim_name} — ${row.group_name}`,
                LineNum: 0,
                Content: [blurred ? "[Ransomware Intel - Premium]" : row.description, `Group: ${row.group_name}`, `Sector: ${row.victim_sector}`, `Country: ${row.victim_country}`, row.ransom_amount ? `Ransom: ${row.ransom_amount}` : "", `Status: ${row.status}`].filter(Boolean).join("\n"),
                Preview: blurred ? "[Ransomware Victim - Premium]" : blur(row.description || "", 250),
                fileType: "ransomware",
                isBlurred: blurred,
                displayPath: `Ransomware / ${row.group_name}`,
                category: "ransomware",
                groupName: row.group_name,
                victimSector: row.victim_sector,
                victimCountry: row.victim_country,
                ransomAmount: row.ransom_amount,
                status: row.status,
                leakSizeGb: row.leak_size_gb,
                severityColor: getSeverityColor(row.status === "published" ? "critical" : "high"),
              })
              count++
            }
          }
        }

        sendStatus("complete", `Found ${count} results across ${sources.join(", ") || "no sources"}`)
        controller.enqueue(encoder.encode(JSON.stringify({ type: "final_count", count }) + "\n"))

        if (sessionUser && !isAdmin) {
          await dbQuery(`UPDATE users SET search_count = search_count + 1 WHERE id = $1 AND search_count < search_limit`, [sessionUser.id]).catch(() => {})
          const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
          await dbQuery(`INSERT INTO search_history (user_id, query, search_type, results_count, ip_address, created_at) VALUES ($1, $2, 'stream', $3, $4, NOW())`, [sessionUser.id, sanitizedQuery, count, clientIp]).catch(() => {})
        }

        controller.close()
      } catch (error) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Search failed" }) + "\n"))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  })
}
