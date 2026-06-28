import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import readline from "readline"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { getUserPermissions } from "@/lib/roles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SearchResult = {
  type: string
  source: string
  line_number?: number
  url?: string
  username?: string
  password?: string
  directory?: string
  ip?: string
  content?: string
  blurred?: boolean
}

function blurText(text: string): string {
  if (!text || text.length <= 2) return "●●●"
  return text[0] + "●".repeat(text.length - 2) + text[text.length - 1]
}

async function searchInFiles(query: string, maxResults: number): Promise<SearchResult[]> {
  const baseDir = process.env.DATA_DIRECTORY
    ? path.resolve(process.env.DATA_DIRECTORY)
    : path.join(process.cwd(), "data")

  let dataDir = baseDir
  if (!fs.existsSync(baseDir)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[FILE_SEARCH] Data directory not found: ${baseDir}`)
    }

    const fallback = path.join(process.cwd(), "data")
    if (fallback !== baseDir && fs.existsSync(fallback)) {
      dataDir = fallback
    } else {
      return []
    }
  }

  const allowedExtensions = new Set([".txt", ".csv", ".log", ".json", ".ndjson"])
  const results: SearchResult[] = []
  const queryLower = query.toLowerCase()

  const filesToSearch: string[] = []

  const collectFiles = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        collectFiles(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (allowedExtensions.has(ext)) {
          filesToSearch.push(fullPath)
        }
      }
    }
  }

  collectFiles(dataDir)

  const parseLine = (line: string, source: string): SearchResult => {
    if (line.includes(":") && line.split(":").length >= 3) {
      const parts = line.split(":")
      const url = parts[0]
      const username = parts.slice(1, -1).join(":")
      const password = parts[parts.length - 1]
      return {
        type: "credential",
        url,
        username,
        password,
        source,
      }
    }

    if (line.includes(",")) {
      const parts = line.split(",")
      if (parts.length >= 5) {
        return {
          type: "directory",
          directory: parts[0],
          ip: parts[1],
          url: parts[2],
          username: parts[3],
          password: parts[4],
          source,
        }
      }
    }

    return {
      type: "text",
      content: line,
      source,
    }
  }

  for (const filePath of filesToSearch) {
    if (results.length >= maxResults) break

    try {
      const stream = fs.createReadStream(filePath, { encoding: "utf-8" })
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
      let lineNumber = 0

      for await (const line of rl) {
        lineNumber++
        if (!line) continue
        if (!line.toLowerCase().includes(queryLower)) continue

        const parsed = parseLine(line, path.relative(dataDir, filePath) || path.basename(filePath))
        parsed.line_number = lineNumber
        results.push(parsed)

        if (results.length >= maxResults) {
          rl.close()
          stream.close()
          break
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[FILE_SEARCH] Error reading file ${filePath}:`, error)
      }
    }
  }

  return results
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.authorized || !authResult.user) {
      return createAuthResponse("Authentication required", 401)
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[FILE_SEARCH] Failed to parse request body:", parseError)
      }
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
          results: [],
          count: 0,
        },
        { status: 400 },
      )
    }

    const { query: searchQuery } = body

    if (!searchQuery || searchQuery.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required",
          results: [],
          count: 0,
        },
        { status: 400 },
      )
    }

    const permissions = getUserPermissions(authResult.user)
    const canAccessFullResults = permissions.canAccessPremiumData
    const maxResults = canAccessFullResults ? 100 : 10

    const results = await searchInFiles(searchQuery, maxResults)

    const processedResults = canAccessFullResults
      ? results
      : results.map((r: any) => ({
          ...r,
          password: r.password ? "●●●●●●●●" : undefined,
          username: r.username ? blurText(r.username) : undefined,
          blurred: true,
        }))

    return NextResponse.json({
      success: true,
      results: processedResults,
      count: results.length,
      isBlurred: !canAccessFullResults,
      message: results.length === 0 ? "No results found" : undefined,
    })
  } catch (error: any) {
    console.error("[FILE_SEARCH] File search error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Search failed",
        results: [],
        count: 0,
      },
      { status: 500 },
    )
  }
}
