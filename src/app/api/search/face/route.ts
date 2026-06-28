import { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import { query as dbQuery } from "@/lib/db"
import { parse as parseExif } from "exifr"
import crypto from "crypto"

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"
const IMAGE_INDEX_NAME = "osint-data-images"
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "http://localhost:9000/intelforge-images"

interface FaceSearchResult {
  face_id: string
  identity_id?: string
  image_id: string
  score: number
  confidence?: number
  path?: string
  url?: string
  thumbnail_url?: string
  is_centroid?: boolean
  threads_profile?: {
    username?: string
    full_name?: string
    bio?: string
    profile_url?: string
    profile_pic_url?: string
    follower_count?: number
    is_verified?: boolean
    is_private?: boolean
    scraped_at?: string
  }
  metadata?: {
    width?: number
    height?: number
    country?: string
    timestamp?: number
    source?: string
  }
  facial_attributes?: {
    age?: number
    gender?: number  // 0 = female, 1 = male
  }
  social_sources?: {
    source: string
    count: number
    platforms: string[]
  }[]
  intel?: {
    darknet?: { title: string; source: string; severity: string }[]
    phishing?: { url: string; target_brand: string; active: boolean }[]
    actors?: { name: string; group_id: string }[]
    news?: { title: string; url: string }[]
    cves?: { cve_id: string; description: string; cvss_v3_severity: string }[]
    exploits?: { exploit_id: string; title: string; cve_id: string }[]
    malware?: { sha256: string; file_name: string; malware_family: string }[]
    ransomware?: { name: string; active: boolean; victim_count: number }[]
    aptCampaigns?: { campaign_name: string; threat_actor: string }[]
    supplyChain?: { osv_id: string; package_name: string; severity: string }[]
    sigmaRules?: { rule_id: string; title: string; level: string }[]
    certs?: { domain: string; issuer: string }[]
    typosquats?: { variant_domain: string; risk_score: number }[]
    githubSecrets?: { repo_name: string; file_path: string; secret_type: string }[]
    yaraRules?: { rule_name: string; severity: string; target_family: string }[]
    iocLookups?: { ioc_value: string; ioc_type: string }[]
    totalHits: number
  }
  identity?: { id: number; name: string }
  watched?: boolean
}

// Enhanced error handling and logging
function logError(context: string, error: any, userId?: string) {
  const timestamp = new Date().toISOString()
  console.error(`[FACE_SEARCH] [${timestamp}] [User: ${userId || 'unknown'}] ${context}:`, error)
}

function logInfo(context: string, data?: any, userId?: string) {
  const timestamp = new Date().toISOString()
}

function getTimeoutSignal(ms: number): AbortSignal | undefined {
  // @ts-ignore
  if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
    // @ts-ignore
    return (AbortSignal as any).timeout(ms)
  }

  // Fallback (no timeout)
  return undefined
}

async function correlateIdentityIntel(identity: string): Promise<FaceSearchResult["intel"]> {
  try {
    const like = `%${identity}%`
    const [
      darknet, phishing, actors, news,
      cves, exploits, malware, rwGroups, rwVictims,
      apt, supply, sigma, certs, typos,
      secrets, yara, iocLkps,
    ] = await Promise.all([
      dbQuery(`SELECT title, source, severity FROM intel_darknet_posts WHERE threat_actor ILIKE $1 OR content ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT url, target_brand, active FROM intel_phishing_cache WHERE target_brand ILIKE $1 OR url ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT name, group_id FROM intel_mitre_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT title, url FROM intel_news_cache WHERE title ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT cve_id, description, cvss_v3_severity FROM intel_cve_cache WHERE description ILIKE $1 OR vendor ILIKE $1 OR product ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT exploit_id, title, cve_id FROM intel_exploit_cache WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT sha256, file_name, malware_family FROM intel_malware_cache WHERE malware_family::text ILIKE $1 OR tags::text ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT name, active, victim_count FROM intel_ransomware_groups WHERE name ILIKE $1 OR aliases::text ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT victim_name AS name, group_name, country FROM intel_ransomware_victims WHERE victim_name ILIKE $1 OR group_name ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT campaign_name, threat_actor FROM intel_apt_campaigns WHERE threat_actor ILIKE $1 OR campaign_name ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT osv_id, package_name, severity FROM intel_supply_chain_cache WHERE package_name ILIKE $1 OR summary ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT rule_id, title, level FROM intel_sigma_rules WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT domain, issuer FROM intel_cert_cache WHERE domain ILIKE $1 OR issuer ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT variant_domain, risk_score FROM intel_typosquat_cache WHERE variant_domain ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT repo_name, file_path, secret_type FROM intel_github_secrets WHERE repo_name ILIKE $1 OR file_path ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT rule_name, severity, target_family FROM intel_yara_rules WHERE rule_name ILIKE $1 OR target_family ILIKE $1 LIMIT 3`, [like]),
      dbQuery(`SELECT ioc_value, ioc_type FROM intel_ioc_lookups WHERE ioc_value ILIKE $1 LIMIT 3`, [like]),
    ])
    const totalHits =
      (darknet.data?.length || 0) + (phishing.data?.length || 0) + (actors.data?.length || 0) + (news.data?.length || 0) +
      (cves.data?.length || 0) + (exploits.data?.length || 0) + (malware.data?.length || 0) +
      (rwGroups.data?.length || 0) + (rwVictims.data?.length || 0) + (apt.data?.length || 0) +
      (supply.data?.length || 0) + (sigma.data?.length || 0) + (certs.data?.length || 0) +
      (typos.data?.length || 0) + (secrets.data?.length || 0) + (yara.data?.length || 0) + (iocLkps.data?.length || 0)
    if (totalHits === 0) return undefined
    return {
      darknet: (darknet.data || []) as any[],
      phishing: (phishing.data || []) as any[],
      actors: (actors.data || []) as any[],
      news: (news.data || []) as any[],
      cves: (cves.data || []) as any[],
      exploits: (exploits.data || []) as any[],
      malware: (malware.data || []) as any[],
      ransomware: [...(rwGroups.data || []), ...(rwVictims.data || [])] as any[],
      aptCampaigns: (apt.data || []) as any[],
      supplyChain: (supply.data || []) as any[],
      sigmaRules: (sigma.data || []) as any[],
      certs: (certs.data || []) as any[],
      typosquats: (typos.data || []) as any[],
      githubSecrets: (secrets.data || []) as any[],
      yaraRules: (yara.data || []) as any[],
      iocLookups: (iocLkps.data || []) as any[],
      totalHits,
    }
  } catch {
    return undefined
  }
}

async function lookupFaceIdentities(faceIds: string[]): Promise<Record<string, { id: number; name: string }>> {
  try {
    const { data } = await dbQuery(
      `SELECT id, name, merged_faces FROM face_identities WHERE merged_faces && $1::text[]`,
      [faceIds],
    )
    const map: Record<string, { id: number; name: string }> = {}
    for (const identity of data || []) {
      for (const faceId of identity.merged_faces || []) {
        map[faceId] = { id: identity.id, name: identity.name }
      }
    }
    return map
  } catch {
    return {}
  }
}

async function checkFaceWatchlists(userId: string, faceIds: string[]): Promise<string[]> {
  try {
    const { data } = await dbQuery(
      `SELECT entity_value FROM user_watchlists WHERE user_id = $1 AND entity_type = 'face' AND entity_value = ANY($2::text[]) AND is_active = true`,
      [userId, faceIds],
    )
    return (data || []).map((r: any) => r.entity_value)
  } catch {
    return []
  }
}

async function saveFaceSearchHistory(
  userId: string,
  imageHash: string,
  imageThumbnail: string | null,
  queryUrl: string | null,
  resultsCount: number,
  topMatches: any[],
  searchTimeMs: number,
  ipAddress: string | null,
) {
  try {
    await dbQuery(
      `INSERT INTO face_search_history (user_id, image_hash, image_thumbnail, query_url, results_count, top_matches, search_time_ms, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, imageHash, imageThumbnail, queryUrl, resultsCount, JSON.stringify(topMatches.slice(0, 5)), searchTimeMs, ipAddress],
    )
  } catch {
    // Non-critical, silently fail
  }
}

async function enrichSocialSources(
  results: FaceSearchResult[],
  searchIdentity?: string,
): Promise<FaceSearchResult["social_sources"]> {
  try {
    // Aggregate unique countries/sources from results
    const sources = new Map<string, { count: number; platforms: Set<string> }>()
    for (const r of results) {
      const country = r.metadata?.country || "unknown"
      const source = r.metadata?.source || `${country}-image`
      if (!sources.has(source)) {
        sources.set(source, { count: 0, platforms: new Set() })
      }
      const entry = sources.get(source)!
      entry.count++
      if (country) entry.platforms.add(country)
    }

    // Also query osint-data text index for identity mentions if available
    if (searchIdentity) {
      try {
        const qwRes = await fetch(`${QUICKWIT_URL}/api/v1/osint-data/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `content:"${searchIdentity}"`,
            max_hits: 0,
            aggs: { by_country: { terms: { field: "country", size: 10 } } },
          }),
        })
        if (qwRes.ok) {
          const qwData = await qwRes.json()
          const buckets = qwData.aggregations?.by_country?.buckets || []
          for (const b of buckets) {
            const key = `text-${b.key || "unknown"}`
            if (!sources.has(key)) {
              sources.set(key, { count: b.doc_count || 0, platforms: new Set() })
            }
            sources.get(key)!.count += b.doc_count || 0
            sources.get(key)!.platforms.add("text-index")
          }
        }
      } catch {}
    }

    return Array.from(sources.entries())
      .map(([source, info]) => ({
        source,
        count: info.count,
        platforms: Array.from(info.platforms),
      }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return undefined
  }
}

function getVisualSearchBaseUrls(): string[] {
  const envUrl = (process.env.VISUAL_SEARCH_SERVICE_URL || "").trim()

  const candidates = [
    envUrl,
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://intelforge-visual-search:8000",
    "http://visual-search-service:8000",
  ].filter(Boolean)

  // Prefer envUrl first if present.
  const ordered = envUrl ? [envUrl, ...candidates.filter(u => u !== envUrl)] : candidates
  return Array.from(new Set(ordered))
}

async function postToVisualSearchWithFallback(path: string, formData: FormData, timeoutMs: number) {
  let lastErr: any = null

  for (const baseUrl of getVisualSearchBaseUrls()) {
    try {
      const url = `${baseUrl}${path}`
      const headers: HeadersInit = {}
      if (process.env.VISUAL_SEARCH_API_KEY) {
        headers["X-Internal-API-Key"] = process.env.VISUAL_SEARCH_API_KEY
      }

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: getTimeoutSignal(timeoutMs),
      })

      return res
    } catch (e) {
      lastErr = e
      continue
    }
  }

  throw lastErr || new Error("fetch failed")
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId: string | undefined
  
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request)
    const sessionUser = (authResult && authResult.isValid && authResult.user) 
      ? { id: authResult.user.userId } 
      : null
    
    userId = sessionUser?.id ? String(sessionUser.id) : undefined
    
    if (!userId) {
      logError('Authentication failed', 'No valid user session')
      return new Response(
        JSON.stringify({ 
          error: "Authentication required",
          message: "Please login to use face search"
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    logInfo('Face search request received', undefined, userId)

    // Get uploaded image from form data or URL
    const formData = await request.formData()
    let imageFile = formData.get("image") as File | null
    const imageUrl = formData.get("url") as string | null

    // Support URL-based face search (fetch image from URL)
    if (!imageFile && imageUrl) {
      try {
        logInfo('Fetching image from URL', { url: imageUrl.substring(0, 100) }, userId)
        const urlRes = await fetch(imageUrl, { signal: getTimeoutSignal(15000) })
        if (!urlRes.ok) throw new Error(`HTTP ${urlRes.status}`)
        const contentType = urlRes.headers.get("content-type") || "image/jpeg"
        if (!contentType.startsWith("image/")) throw new Error("URL does not point to an image")
        const blob = await urlRes.blob()
        if (blob.size > 10 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Image too large", message: "URL image must be smaller than 10MB" }), { status: 400, headers: { "Content-Type": "application/json" } })
        }
        imageFile = new File([blob], imageUrl.split("/").pop() || "url-image.jpg", { type: contentType })
      } catch (err: any) {
        logError('Failed to fetch image URL', err, userId)
        return new Response(JSON.stringify({ error: "Cannot fetch URL", message: "Could not download image from the provided URL" }), { status: 400, headers: { "Content-Type": "application/json" } })
      }
    }

    if (!imageFile) {
      logError('No image provided', 'Missing image file or URL', userId)
      return new Response(
        JSON.stringify({
          error: "No image provided",
          message: "Please upload an image or provide an image URL"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate image file
    if (!imageFile.type.startsWith('image/')) {
      logError('Invalid file type', `File type: ${imageFile.type}`, userId)
      return new Response(
        JSON.stringify({
          error: "Invalid file type",
          message: "Please upload a valid image file (JPEG, PNG, etc.)"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Check file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      logError('File too large', `File size: ${imageFile.size} bytes`, userId)
      return new Response(
        JSON.stringify({
          error: "File too large",
          message: "Please upload an image smaller than 10MB"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    logInfo('Image validation passed', {
      filename: imageFile.name,
      size: imageFile.size,
      type: imageFile.type,
      source: imageUrl ? 'url' : 'upload'
    }, userId)

    // Get filters from query params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50) // Max 50 results
    const includeNonCentroids = searchParams.get("include_all") === "true"

    // Read image buffer once for both EXIF parsing and visual search
    const imageBuffer = await imageFile.arrayBuffer()

    // Parse EXIF data from query image
    let queryExif: Record<string, unknown> | undefined
    try {
      const exifData = await parseExif(imageBuffer, {
        gps: true,
        tiff: true,
        xmp: true,
        iptc: true,
      })
      if (exifData) {
        queryExif = {
          make: exifData.Make,
          model: exifData.Model,
          dateTaken: exifData.DateTimeOriginal?.toISOString?.() || exifData.DateTimeOriginal,
          gps: exifData.latitude != null ? {
            lat: exifData.latitude,
            lng: exifData.longitude,
          } : undefined,
          software: exifData.Software,
          dimensions: exifData.ImageWidth ? { width: exifData.ImageWidth, height: exifData.ImageHeight } : undefined,
        }
        logInfo('EXIF extracted', { hasGps: !!queryExif.gps, make: queryExif.make }, userId)
      }
    } catch {
      // EXIF parsing is non-critical
    }

    try {
      // Convert image to blob and send to service
      const formData = new FormData()
      const blob = new Blob([imageBuffer], { type: imageFile.type })
      formData.append("file", blob, imageFile.name)

      const searchResponse = await postToVisualSearchWithFallback(
        `/api/search/face?limit=${limit}`,
        formData,
        30000,
      )

      if (!searchResponse.ok) {
        const raw = await searchResponse.text()
        const status = searchResponse.status

        // Pass through client errors (e.g. 400 No face detected)
        if (status >= 400 && status < 500) {
          let payload: any = null
          try {
            payload = JSON.parse(raw)
          } catch {
            payload = { error: raw || "Face search failed" }
          }

          const errorMsg = payload?.error || payload?.detail || payload?.message || "Face search failed"
          return new Response(
            JSON.stringify({ error: errorMsg, message: errorMsg }),
            { status, headers: { "Content-Type": "application/json" } }
          )
        }

        logError('Face search service error', {
          status,
          statusText: searchResponse.statusText,
          errorText: raw.substring(0, 500)
        }, userId)

        throw new Error(`Face search service failed: ${status} - ${raw.substring(0, 200)}`)
      }

      const faceResults = await searchResponse.json()
      // Support both legacy "faces" field and newer "results" field from the visual search service
      const rawFaces = (faceResults && (faceResults.faces || faceResults.results)) || []
      const similarFaces = Array.isArray(rawFaces) ? rawFaces : []
      const queryFacialAttributes = faceResults?.query_facial_attributes || null

      logInfo('Face search service response', {
        totalResults: similarFaces.length,
        serviceResponseTime: Date.now() - startTime
      }, userId)

      // If no results, return helpful message
      if (!similarFaces || similarFaces.length === 0) {
        logInfo('No similar faces found', undefined, userId)
        return new Response(
          JSON.stringify({
            results: [],
            total: 0,
            message: "No similar faces found. Make sure the image contains a clear face.",
            searchTime: Date.now() - startTime
          }),
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
      
      // Compute image hash for history tracking
      const imageHash = crypto.createHash("sha256").update(new Uint8Array(imageBuffer)).digest("hex")

      // Collect face_ids for identity and watchlist lookups
      const faceIds = similarFaces.map((r: any) => r.face_id || r.id).filter(Boolean)

      // Look up identities and watchlists in parallel
      const [identityMap, watchedFaces] = await Promise.all([
        lookupFaceIdentities(faceIds),
        userId ? checkFaceWatchlists(userId, faceIds) : Promise.resolve([] as string[]),
      ])

      // Filter and enrich results
      const enrichedResults: FaceSearchResult[] = []

      for (const result of similarFaces) {
        try {
          // Include all faces by default - centroids filter is optional
          // Only skip if explicitly filtering for centroids only AND this is explicitly not a centroid
          // (undefined/null is_centroid means we don't know, so include it)
          
          // Construct full MinIO URL if URL is missing or just a filename
          let imageUrl = result.url || result.thumbnail_url || ""
          let thumbnailUrl = result.thumbnail_url || result.url || ""
          const faceId = result.face_id || result.id || ""
          
          // Helper function to construct full URL from path or face_id
          const constructUrl = (url: string, path: string | undefined): string => {
            // If we already have a full HTTP URL, use it
            if (url && url.startsWith('http')) {
              return url
            }
            
            // If URL is just a filename (contains extension but no http)
            const isJustFilename = url && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) && !url.startsWith('http')
            
            // Determine the MinIO object path
            let objectPath = path || ""
            
            if (isJustFilename) {
              // URL is just filename - extract country from path or default to threads
              // Try to detect country from existing path, or use threads as default
              const country = path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              objectPath = `intel_data_images/${country}/faces/${url}`
            } else if (!objectPath && faceId) {
              // Construct from face_id - need to detect country and extension
              // Check if face_id matches old format (_face_1) or new format (_face0)
              // Old images use .webp, new Threads use .jpg
              // Try to infer from existing data or default
              const country = result.path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              // Default to .jpg for Threads, but check if path suggests .webp
              const ext = path?.includes('.webp') || faceId.includes('_face_') ? '.webp' : '.jpg'
              objectPath = `intel_data_images/${country}/faces/${faceId}${ext}`
            } else if (!objectPath && url) {
              // Use URL as path if it looks like a path
              objectPath = url.startsWith('intel_data_images/') ? url : `intel_data_images/threads/faces/${url}`
            } else if (!objectPath) {
              // Last resort fallback
              const country = result.path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              objectPath = `intel_data_images/${country}/faces/${faceId || 'unknown'}.jpg`
            }
            
            // Ensure path doesn't start with / and construct full URL
            const cleanPath = objectPath.startsWith('/') ? objectPath.slice(1) : objectPath
            return `${MINIO_PUBLIC_URL}/${cleanPath}`
          }
          
          imageUrl = constructUrl(imageUrl, result.path)
          thumbnailUrl = constructUrl(thumbnailUrl, result.path)
          
          // Debug logging for URL construction
          if (!result.url || !result.url.startsWith('http')) {
            logInfo('URL construction', {
              face_id: faceId,
              original_url: result.url,
              original_path: result.path,
              constructed_url: imageUrl.substring(0, 100)
            }, userId)
          }
          
          let enrichedResult: FaceSearchResult = {
            face_id: result.face_id || result.id,
            identity_id: result.identity_id,
            image_id: result.image_id,
            score: result.score || 0.0,
            confidence: result.confidence,
            path: result.path,
            url: imageUrl,
            thumbnail_url: thumbnailUrl,
            is_centroid: result.is_centroid
          }

          // Attach identity info if this face belongs to a known identity
          if (identityMap[faceId]) {
            enrichedResult.identity = identityMap[faceId]
          }

          // Flag if this face is on the user's watchlist
          if (watchedFaces.includes(faceId)) {
            enrichedResult.watched = true
          }

          // Check if this is a Threads profile (identity_id is username)
          if (result.identity_id && result.identity_id !== result.image_id) {
            try {
              const threadsUrl = `${QUICKWIT_URL}/api/v1/threads-profiles/search`
              const threadsResponse = await fetch(threadsUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: `username:${result.identity_id}`,
                  max_hits: 1
                })
              })
              
              if (threadsResponse.ok) {
                const threadsData = await threadsResponse.json()
                const profile = threadsData.hits?.[0]
                
                if (profile) {
                  enrichedResult.threads_profile = {
                    username: profile.username,
                    full_name: profile.full_name,
                    bio: profile.bio,
                    profile_url: profile.profile_url,
                    profile_pic_url: profile.profile_pic_url,
                    follower_count: profile.follower_count,
                    is_verified: profile.is_verified,
                    is_private: profile.is_private,
                    scraped_at: profile.scraped_at
                  }
                }
              }
            } catch (threadsError) {
              // Non-critical
            }
          }
          
          // Intel correlation for this face identity
          const searchIdentity = result.identity_id || enrichedResult.threads_profile?.username || enrichedResult.threads_profile?.full_name
          if (searchIdentity) {
            enrichedResult.intel = await correlateIdentityIntel(searchIdentity)
          }

          // Try to get image metadata from Quickwit if we have a path
          // Gracefully skip if the images index doesn't exist (non-critical)
          if (result.path) {
            try {
              const quickwitUrl = `${QUICKWIT_URL}/api/v1/${IMAGE_INDEX_NAME}/search`
              const quickwitResponse = await fetch(quickwitUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: `file_path:"${result.path}"`,
                  max_hits: 1
                }),
                signal: AbortSignal.timeout(5000),
              })
              
              if (quickwitResponse.ok) {
                const qwData = await quickwitResponse.json()
                const hit = qwData.hits?.[0]
                
                if (hit) {
                  enrichedResult = {
                    ...enrichedResult,
                    url: hit.original_url || result.url,
                    thumbnail_url: hit.thumbnail_url,
                    metadata: {
                      width: hit.image_width,
                      height: hit.image_height,
                      country: hit.country,
                      timestamp: hit.timestamp,
                      source: hit.category || (hit.country ? `${hit.country}-${hit.media_type || "image"}` : undefined),
                    }
                  }
                }
              }
              // Silently ignore 404 (index doesn't exist) — not an error
            } catch {
              // Non-critical, continue without enrichment
            }
          }
          
          enrichedResults.push(enrichedResult)
          
        } catch (err) {
          logError('Error enriching face result', {
            result: result,
            error: err instanceof Error ? err.message : String(err)
          }, userId)
          
          // Use the same URL construction logic as above
          let imageUrl = result.url || result.thumbnail_url || ""
          let thumbnailUrl = result.thumbnail_url || result.url || ""
          const faceId = result.face_id || result.id || ""
          
          const constructUrl = (url: string, path: string | undefined): string => {
            if (url && url.startsWith('http')) return url
            const isJustFilename = url && (url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) && !url.startsWith('http')
            let objectPath = path || ""
            if (isJustFilename) {
              const country = path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              objectPath = `intel_data_images/${country}/faces/${url}`
            } else if (!objectPath && faceId) {
              const country = result.path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              const ext = path?.includes('.webp') || faceId.includes('_face_') ? '.webp' : '.jpg'
              objectPath = `intel_data_images/${country}/faces/${faceId}${ext}`
            } else if (!objectPath && url) {
              objectPath = url.startsWith('intel_data_images/') ? url : `intel_data_images/threads/faces/${url}`
            } else if (!objectPath) {
              const country = result.path?.match(/intel_data_images\/([^\/]+)/)?.[1] || "threads"
              objectPath = `intel_data_images/${country}/faces/${faceId || 'unknown'}.jpg`
            }
            const cleanPath = objectPath.startsWith('/') ? objectPath.slice(1) : objectPath
            return `${MINIO_PUBLIC_URL}/${cleanPath}`
          }
          
          imageUrl = constructUrl(imageUrl, result.path)
          thumbnailUrl = constructUrl(thumbnailUrl, result.path)
          
          // Include basic result even if enrichment fails
          enrichedResults.push({
            face_id: result.face_id || result.id,
            identity_id: result.identity_id,
            image_id: result.image_id,
            score: result.score || 0.0,
            confidence: result.confidence,
            path: result.path,
            url: imageUrl,
            thumbnail_url: thumbnailUrl,
            is_centroid: result.is_centroid
          })
        }
      }

      // Sort results so highest-confidence / highest-score matches appear first
      enrichedResults.sort((a, b) => {
        const aConf = typeof a.confidence === "number" ? a.confidence : 0
        const bConf = typeof b.confidence === "number" ? b.confidence : 0
        if (bConf !== aConf) return bConf - aConf

        const aScore = typeof a.score === "number" ? a.score : 0
        const bScore = typeof b.score === "number" ? b.score : 0
        return bScore - aScore
      })

      logInfo('Results enriched', {
        originalCount: similarFaces.length,
        enrichedCount: enrichedResults.length
      }, userId)

      // Update user search count
      try {
        await dbQuery(
          `UPDATE users SET search_count = search_count + 1 WHERE id = $1`,
          [userId]
        )
        logInfo('User search count updated', undefined, userId)
      } catch (err) {
        logError('Failed to update search count', err, userId)
        // Non-critical error, continue
      }

      const totalTime = Date.now() - startTime
      logInfo('Face search completed successfully', {
        resultCount: enrichedResults.length,
        totalTime
      }, userId)

      // Save search history (non-blocking)
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
      saveFaceSearchHistory(
        userId,
        imageHash,
        null,
        imageUrl,
        enrichedResults.length,
        enrichedResults,
        totalTime,
        ipAddress,
      ).catch(() => {})

      // Enrich social sources (cross-source platform diversity)
      const primaryIdentity = enrichedResults[0]?.identity_id
        || enrichedResults[0]?.threads_profile?.username
        || undefined
      const socialSources = await enrichSocialSources(enrichedResults, primaryIdentity).catch(() => undefined)

      return new Response(
        JSON.stringify({
          results: enrichedResults,
          total: enrichedResults.length,
          searchTime: totalTime,
          queryExif: queryExif || null,
          social_sources: socialSources || null,
          facial_attributes: queryFacialAttributes,
          message: enrichedResults.length > 0
            ? `Found ${enrichedResults.length} similar faces`
            : "No similar faces found"
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
      
    } catch (fetchError: any) {
      logError('Face search service connection failed', fetchError, userId)
      
      // Provide helpful error messages based on error type
      let errorMessage = "Face search service is temporarily unavailable"
      let userMessage = "Please try again in a few moments"
      
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        errorMessage = "Face search timeout"
        userMessage = "The search took too long. Please try with a clearer face image."
      } else if (fetchError.message?.includes('fetch') || fetchError.message?.includes('ECONNREFUSED')) {
        errorMessage = "Cannot connect to face search service"
        userMessage = "The face search service is not available. Please contact support."
      } else if (fetchError.message?.includes('No face detected')) {
        errorMessage = "No face detected"
        userMessage = "No face was detected in the image. Please upload an image with a clear face."
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          message: userMessage,
          details: process.env.NODE_ENV === 'development' ? fetchError.message : undefined
        }),
        { 
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      )
    }

  } catch (error: any) {
    logError('Face search request failed', error, userId)
    
    return new Response(
      JSON.stringify({ 
        error: "Face search failed",
        message: "An unexpected error occurred. Please try again.",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}

// GET endpoint for health check and service status
export async function GET(request: NextRequest) {
  try {
    const visualSearchUrl = process.env.VISUAL_SEARCH_SERVICE_URL || "http://localhost:8000"
    
    // Check if visual search service is available
    const healthResponse = await fetch(`${visualSearchUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10000) // 10 second timeout
    }).catch(() => null)
    
    const serviceStatus = healthResponse?.ok ? "healthy" : "unavailable"
    const serviceResponse = healthResponse?.ok ? await healthResponse.json() : null
    
    // Check if ArcFace is available
    const arcfaceAvailable = serviceResponse?.arcface_available || false
    
    return new Response(
      JSON.stringify({
        service: "face-search-api",
        status: "healthy",
        timestamp: new Date().toISOString(),
        face_search_service: {
          status: serviceStatus,
          url: visualSearchUrl,
          arcface_available: arcfaceAvailable,
          details: serviceResponse
        }
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
    
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        service: "face-search-api",
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}

