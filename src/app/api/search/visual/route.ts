import { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import { query as dbQuery } from "@/lib/db"

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const COLLECTION_NAME = "intelforge-images"
const IMAGE_INDEX_NAME = "osint-data-images"
const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"

interface VisualSearchResult {
  file_path: string
  file_name: string
  score: number
  url?: string
  thumbnail_url?: string
  webp_url?: string
  metadata?: {
    width?: number
    height?: number
    format?: string
    country?: string
    file_size?: number
  }
}

// Enhanced error handling and logging
function logError(context: string, error: any, userId?: string) {
  const timestamp = new Date().toISOString()
  console.error(`[VISUAL_SEARCH] [${timestamp}] [User: ${userId || 'unknown'}] ${context}:`, error)
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
  return undefined
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
          message: "Please login to use visual search"
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    logInfo('Visual search request received', undefined, userId)

    // Get uploaded image from form data
    const formData = await request.formData()
    const imageFile = formData.get("image") as File
    
    if (!imageFile) {
      logError('No image provided', 'Missing image file in form data', userId)
      return new Response(
        JSON.stringify({ 
          error: "No image provided",
          message: "Please upload an image to search"
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
      type: imageFile.type 
    }, userId)

    // Get filters from query params
    const searchParams = request.nextUrl.searchParams
    const country = searchParams.get("country")
    const mediaType = searchParams.get("media_type")
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50) // Max 50 results

    try {
      const arrayBuffer = await imageFile.arrayBuffer()

      const formData = new FormData()
      const blob = new Blob([arrayBuffer], { type: imageFile.type })
      formData.append("file", blob, imageFile.name)

      const searchResponse = await postToVisualSearchWithFallback(
        `/api/search/image?limit=${limit}`,
        formData,
        300000,
      )

      if (!searchResponse.ok) {
        const raw = await searchResponse.text()
        const status = searchResponse.status

        if (status >= 400 && status < 500) {
          let payload: any = null
          try {
            payload = JSON.parse(raw)
          } catch {
            payload = { error: raw || "Visual search failed" }
          }

          const errorMsg = payload?.error || payload?.detail || payload?.message || "Visual search failed"
          return new Response(
            JSON.stringify({ error: errorMsg, message: errorMsg }),
            { status, headers: { "Content-Type": "application/json" } }
          )
        }

        logError('Visual search service error', {
          status,
          statusText: searchResponse.statusText,
          errorText: raw.substring(0, 500)
        }, userId)

        throw new Error(`Visual search service failed: ${status} - ${raw.substring(0, 200)}`)
      }

      const visualResults = await searchResponse.json()
      const similarImages = visualResults.results || []
      
      logInfo('Visual search service response', {
        totalResults: similarImages.length,
        serviceResponseTime: Date.now() - startTime
      }, userId)

      // If no results, return helpful message
      if (!similarImages || similarImages.length === 0) {
        logInfo('No similar images found', undefined, userId)
        return new Response(
          JSON.stringify({
            results: [],
            total: 0,
            message: "No similar images found. Try indexing some images first or use a different search image.",
            searchTime: Date.now() - startTime
          }),
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
      
      // Enrich results with metadata from Quickwit image index
      const enrichedResults: VisualSearchResult[] = []
      
      for (const result of similarImages) {
        try {
          // Extract from payload (Milvus returns nested structure)
          const imageId = result.payload?.image_id || result.image_id
          const filePath = result.payload?.path || result.path || result.file_path
          const fileName = result.file_name || filePath?.split("/").pop() || "unknown"
          
          // Validate result structure
          if (!imageId && !filePath) {
            logError('Invalid result structure', 'Missing image_id and path in result', userId)
            continue
          }
          
          // Get full metadata from Quickwit using embedding_id (which is the image_id)
          // Skip if the images index doesn't exist (non-critical enrichment)
          let quickwitResponse: Response | null = null
          try {
            const quickwitUrl = `${QUICKWIT_URL}/api/v1/${IMAGE_INDEX_NAME}/search`
            quickwitResponse = await fetch(quickwitUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: imageId ? `embedding_id:${imageId}` : `file_path:"${filePath}"`,
                max_hits: 1
              }),
              signal: AbortSignal.timeout(5000),
            })
          } catch {
            // Quickwit images index not available — continue without enrichment
            quickwitResponse = null
          }
          
          let enrichedResult: VisualSearchResult = {
            file_path: filePath,
            file_name: fileName,
            score: result.score || 0.0,
            url: result.payload?.url || result.url,
            thumbnail_url: result.payload?.thumbnail_url || result.thumbnail_url,
            webp_url: result.payload?.webp_url || result.webp_url,
            metadata: {
              width: result.payload?.width || result.metadata?.width,
              height: result.payload?.height || result.metadata?.height,
              format: result.metadata?.format
            }
          }
          
          if (quickwitResponse && quickwitResponse.ok) {
            const qwData = await quickwitResponse.json()
            const hit = qwData.hits?.[0]
            
            if (hit) {
              // Apply filters
              if (country && hit.country !== country) {
                logInfo('Filtered out by country', { filePath, resultCountry: hit.country, filterCountry: country }, userId)
                continue
              }
              if (mediaType && hit.media_type !== mediaType) {
                logInfo('Filtered out by media type', { filePath, resultMediaType: hit.media_type, filterMediaType: mediaType }, userId)
                continue
              }
              
              // Enrich with Quickwit data
              enrichedResult = {
                ...enrichedResult,
                url: result.payload?.url || result.url || hit.original_url,
                thumbnail_url: result.payload?.thumbnail_url || result.thumbnail_url || hit.thumbnail_url,
                webp_url: result.payload?.webp_url || result.webp_url || hit.webp_url,
                metadata: {
                  width: hit.image_width || result.payload?.width || result.metadata?.width,
                  height: hit.image_height || result.payload?.height || result.metadata?.height,
                  format: hit.file_type || result.metadata?.format,
                  country: hit.country,
                  file_size: hit.file_size
                }
              }
            }
          } else if (quickwitResponse && quickwitResponse.status !== 404) {
            logError('Quickwit query failed', {
              filePath,
              status: quickwitResponse.status,
              statusText: quickwitResponse.statusText
            }, userId)
          }
          
          enrichedResults.push(enrichedResult)
          
        } catch (err) {
          logError('Error enriching individual result', {
            result: result,
            error: err instanceof Error ? err.message : String(err)
          }, userId)
          
          // Include basic result even if enrichment fails
          const filePath = result.payload?.path || result.path || result.file_path
          enrichedResults.push({
            file_path: filePath,
            file_name: result.file_name || filePath?.split("/").pop() || "unknown",
            score: result.score || 0.0,
            url: result.payload?.url || result.url,
            thumbnail_url: result.payload?.thumbnail_url || result.thumbnail_url,
            webp_url: result.payload?.webp_url || result.webp_url,
            metadata: result.metadata
          })
        }
      }

      logInfo('Results enriched', {
        originalCount: similarImages.length,
        enrichedCount: enrichedResults.length,
        filters: { country, mediaType }
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
      logInfo('Visual search completed successfully', {
        resultCount: enrichedResults.length,
        totalTime
      }, userId)

      return new Response(
        JSON.stringify({
          results: enrichedResults,
          total: enrichedResults.length,
          searchTime: totalTime,
          message: enrichedResults.length > 0 
            ? `Found ${enrichedResults.length} similar images`
            : "No similar images found"
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
      
    } catch (fetchError: any) {
      logError('Visual search service connection failed', fetchError, userId)
      
      // Provide helpful error messages based on error type
      let errorMessage = "Visual search service is temporarily unavailable"
      let userMessage = "Please try again in a few moments"
      
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        errorMessage = "Visual search timeout"
        userMessage = "The search took too long. Please try with a different image or check if the service is running."
      } else if (fetchError.message?.includes('fetch') || fetchError.message?.includes('ECONNREFUSED')) {
        errorMessage = "Cannot connect to visual search service"
        userMessage = "The image search service is not available. Please contact support."
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
    logError('Visual search request failed', error, userId)
    
    return new Response(
      JSON.stringify({ 
        error: "Visual search failed",
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
    
    return new Response(
      JSON.stringify({
        service: "visual-search-api",
        status: "healthy",
        timestamp: new Date().toISOString(),
        visual_search_service: {
          status: serviceStatus,
          url: visualSearchUrl,
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
        service: "visual-search-api",
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