import { NextRequest, NextResponse } from "next/server"
import { validateSearchInput } from "@/lib/validation"
import { authenticateRequest } from "@/lib/jwt"
import { query as dbQuery } from "@/lib/db"

// Mark this route as using Node.js runtime (not Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"
const INDEX_NAME = "osint-data"
const SITE_NAME = "IntelForge"

interface SearchResult {
  Content: string
  LineNum: number
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")?.trim() || ""
  const category = searchParams.get("category")?.trim() || ""
  const format = searchParams.get("format")?.toLowerCase() || "txt" // Only txt format
  
  // Validate format
  if (format !== "txt") {
    return NextResponse.json(
      { error: "Invalid format. Use 'txt'" },
      { status: 400 }
    )
  }
  
  // Validate query
  const validation = validateSearchInput(query)
  if (!validation.valid || !validation.sanitized) {
    return NextResponse.json(
      { error: validation.errors[0] || "Invalid query" },
      { status: 400 }
    )
  }

  const sanitizedQuery = validation.sanitized

  // Authenticate user
  const authResult = await authenticateRequest(request)
  const sessionUser = (authResult && authResult.isValid && authResult.user) 
    ? { id: authResult.user.userId } 
    : null
  
  if (!sessionUser?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }
  
  // Get user subscription and quota
  const userResult = await dbQuery(
    `SELECT 
      subscription_type,
      is_lifetime,
      role,
      email
    FROM users 
    WHERE id = $1`,
    [sessionUser.id]
  )
  
  if (!userResult.success || !userResult.data || userResult.data.length === 0) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    )
  }

  const user = userResult.data[0]
  const isAdmin = user.role === "admin"
  const subType = (user.subscription_type || "").toLowerCase()
  const isPremium = user.is_lifetime || 
    ["starter", "professional", "enterprise", "api_access", "government"].includes(subType) ||
    isAdmin

  // Fetch search results from Quickwit - only get lines that match the query
  try {
    const filterParts: string[] = []
    if (category) filterParts.push(`category:"${category.replace(/"/g, '\\"')}"`)

    const quickwitQuery = filterParts.length > 0
      ? `${sanitizedQuery} ${filterParts.join(" ")}`
      : sanitizedQuery

    const searchUrl = `${QUICKWIT_URL}/api/v1/${INDEX_NAME}/search`
    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: quickwitQuery, // This ensures only matching lines are returned
        max_hits: 10000, // Export up to 10k matching lines
        search_field: "content"
      })
    })

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      throw new Error(`Quickwit search failed: ${searchResponse.status} - ${errorText}`)
    }

    const searchData = await searchResponse.json()
    const hits = searchData.hits || []
    const totalHits = searchData.num_hits || 0
    
    // Transform results - only include content (matching lines)
    // Filter out blurred content and only include actual matching lines
    const results: SearchResult[] = hits
      .filter((hit: any) => {
        // Only include if content actually matches (not blurred)
        const content = hit.content || ""
        if (!content || content.includes("[BLURRED")) {
          return false
        }
        
        // Apply blurring logic
        if (!isPremium && !isAdmin) {
          const fileType = (hit.file_type || "").toLowerCase()
          if (fileType !== "txt") {
            return false // Skip blurred content
          }
        }
        
        // Ensure content actually contains the search query
        const contentLower = content.toLowerCase()
        const queryLower = sanitizedQuery.toLowerCase()
        return contentLower.includes(queryLower)
      })
      .map((hit: any) => ({
        Content: hit.content || "",
        LineNum: hit.line_number || 0
      }))

    // Generate TXT export
    return generateTXT(results, sanitizedQuery, user, totalHits)
    
  } catch (error: any) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    )
  }
}

async function generateTXT(results: SearchResult[], query: string, user: any, totalHits: number) {
  // Generate plain text export
  let txtContent = `${SITE_NAME} - Search Results Export\n`
  txtContent += "=".repeat(60) + "\n\n"
  txtContent += "⚠️ This data is for educational and investigation purposes only.\n\n"
  txtContent += `Search Query: ${query}\n`
  txtContent += `Lines Found: ${results.length}\n`
  txtContent += `Total Matches: ${totalHits}\n`
  txtContent += `User: ${user.email || "Unknown"}\n`
  txtContent += `Date: ${new Date().toLocaleString()}\n`
  txtContent += "\n" + "=".repeat(60) + "\n\n"
  txtContent += "Matching Lines:\n"
  txtContent += "-".repeat(60) + "\n\n"
  
  // Add all matching lines (content only, no line numbers)
  for (const result of results) {
    txtContent += `${result.Content}\n`
  }
  
  txtContent += "\n" + "=".repeat(60) + "\n"
  txtContent += `${SITE_NAME} | Generated on ${new Date().toLocaleString()} | ${results.length} lines found\n`
  
  return new NextResponse(txtContent, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="intelforge-results-${query.substring(0, 20)}-${Date.now()}.txt"`,
      "Content-Length": Buffer.byteLength(txtContent, 'utf8').toString()
    }
  })
}
