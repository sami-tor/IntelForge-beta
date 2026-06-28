import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
import { validateFilePath } from "@/lib/validation"
import AdmZip from "adm-zip"
import { query as dbQuery } from "@/lib/db"
import { requireAuth, createAuthResponse } from "@/lib/middleware"

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"
const INDEX_NAME = "osint-data"

interface PreviewLine {
  lineNum: number
  content: string
  isMatch: boolean
  matchPos: number
}

interface FilePreview {
  fileName: string
  filePath: string
  displayPath: string
  totalLines: number
  content: PreviewLine[]
  searchQuery: string
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Authenticate user and verify permissions using JWT
    const authResult = await requireAuth(request)
    if (!authResult.authorized || !authResult.user) {
      return createAuthResponse("Authentication required", 401)
    }
    
    const sessionUser = { id: authResult.user.user_id }
    
    const filePath = request.nextUrl.searchParams.get("file")
    const query = request.nextUrl.searchParams.get("q") || ""
    const lineNum = parseInt(request.nextUrl.searchParams.get("line") || "0")
    const contextLines = parseInt(request.nextUrl.searchParams.get("context") || "10") // Default to 10 lines before/after
    // SECURITY: Validate and cap maxLines to prevent memory exhaustion
    const clientMaxLines = parseInt(request.nextUrl.searchParams.get("maxLines") || "10000")
    const maxLines = Math.min(Math.max(clientMaxLines, 1), 50000) // Cap at 50k lines max

    if (process.env.NODE_ENV === "development") {
    }

    if (!filePath) {
      return NextResponse.json({ error: "Missing file parameter" }, { status: 400 })
    }
    
    // SECURITY: Fetch user subscription and role from database
    const userResult = await dbQuery(
      `SELECT subscription_type, is_lifetime, role FROM users WHERE id = $1`,
      [sessionUser.id]
    )
    
    if (!userResult.success || !userResult.data || userResult.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    const user = userResult.data[0]
    const subType = (user.subscription_type || "").toLowerCase()
    const isAdmin = user.role === "admin"
    const isPremium = user.is_lifetime || 
                     ["starter", "professional", "enterprise", "api_access", "government"].includes(subType) ||
                     isAdmin
    
    // Determine if file should be blurred based on file type and user subscription
    const fileExt = path.extname(filePath).toLowerCase().slice(1) || "txt"
    let shouldBlur = false
    
    if (!isAdmin) {
      if (!isPremium) {
        // Free users: Only .txt files visible
        shouldBlur = fileExt !== "txt"
      } else if (subType === "starter") {
        // Starter: Only .txt, .rar, .zip, .7z visible
        const allowedTypes = ["txt", "rar", "zip", "7z"]
        shouldBlur = !allowedTypes.includes(fileExt)
      }
      // Professional, Enterprise, API, Government: All files visible (shouldBlur stays false)
    }

    const dataDir = path.join(process.cwd(), "data")

    // Check if file is inside an archive
    const archiveMatch = filePath.match(/^(.+?\.(zip|rar|7z))\/(.+)$/i)
    
    if (archiveMatch) {
      // File is inside an archive
      const archiveRelativePath = archiveMatch[1]
      const fileInsideArchive = archiveMatch[3]
      const archivePath = path.join(dataDir, archiveRelativePath)

      // Security check - Validate archive path
      const validation = validateFilePath(archiveRelativePath, dataDir)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 })
      }

      try {
        let content: string
        try {
          content = await readFileFromArchive(archivePath, fileInsideArchive)
        } catch (archiveErr: any) {
          // Archive file not found - try to get from Quickwit
          if (archiveErr.code === 'ENOENT' || archiveErr.message?.includes('not found')) {
            
            // Get file content from Quickwit
            const searchUrl = `${QUICKWIT_URL}/api/v1/${INDEX_NAME}/search`
            const normalizedFilePath = filePath.replace(/\\/g, "/")
            
            const searchResponse = await fetch(searchUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `file_path:"${normalizedFilePath}"`,
                max_hits: maxLines,
                search_field: "file_path"
              })
            })
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json()
              const hits = searchData.hits || []
              
              if (hits.length > 0) {
                // Sort by line number and reconstruct content
                hits.sort((a: any, b: any) => (a.line_number || 0) - (b.line_number || 0))
                content = hits.map((h: any) => h.content || "").join("\n")
              } else {
                throw new Error(`File not found in Quickwit: ${filePath}`)
              }
            } else {
              throw new Error(`Quickwit search failed: ${searchResponse.status}`)
            }
          } else {
            throw archiveErr
          }
        }
        const lines = content.split("\n")
        const queryLower = query.toLowerCase().trim()

        const preview: PreviewLine[] = []
        let matchCount = 0
        
        // If a specific line is requested, show context around it
        if (lineNum > 0) {
          const start = Math.max(0, lineNum - 1 - contextLines)
          const end = Math.min(lines.length, lineNum - 1 + contextLines + 1)
          
          for (let i = start; i < end; i++) {
            const line = lines[i]
            const isMatch = Boolean(queryLower && line.toLowerCase().includes(queryLower))
            const matchPos = isMatch ? line.toLowerCase().indexOf(queryLower) : -1

            if (isMatch) matchCount++

            // SECURITY: NEVER send actual content when it should be blurred
            const lineContent = shouldBlur 
              ? "[BLURRED - Premium Content]"
              : line
            
            preview.push({
              lineNum: i + 1,
              content: lineContent,
              isMatch: i + 1 === lineNum ? true : isMatch,
              matchPos: i + 1 === lineNum ? 0 : matchPos
            })
          }
        } else {
          // Show all lines or up to maxLines
          const limitedLines = Math.min(lines.length, maxLines)

          for (let i = 0; i < limitedLines; i++) {
            const line = lines[i]
            const isMatch = Boolean(queryLower && line.toLowerCase().includes(queryLower))
            const matchPos = isMatch ? line.toLowerCase().indexOf(queryLower) : -1

            if (isMatch) matchCount++

            // SECURITY: NEVER send actual content when it should be blurred
            const lineContent = shouldBlur 
              ? "[BLURRED - Premium Content]"
              : line
            
            preview.push({
              lineNum: i + 1,
              content: lineContent,
              isMatch,
              matchPos
            })
          }
        }

        if (process.env.NODE_ENV === "development") {
        }
        
        // SECURITY: Check file extension inside archive for blurring
        const archiveFileExt = path.extname(fileInsideArchive).toLowerCase().slice(1) || "txt"
        let archiveShouldBlur = false
        
        if (!isAdmin) {
          if (!isPremium) {
            // Free users: Only .txt files visible
            archiveShouldBlur = archiveFileExt !== "txt"
          } else if (subType === "starter") {
            // Starter: Only .txt, .rar, .zip, .7z visible
            const allowedTypes = ["txt", "rar", "zip", "7z"]
            archiveShouldBlur = !allowedTypes.includes(archiveFileExt)
          }
        }
        
        // SECURITY: If file should be blurred, return error instead of content
        if (archiveShouldBlur) {
          return NextResponse.json({ 
            error: "Access denied",
            message: "This file type requires a premium subscription to view",
            fileName: path.basename(fileInsideArchive),
            filePath,
            displayPath: `/data/${filePath}`.replace(/\\/g, "/"),
            totalLines: lines.length,
            content: [],
            searchQuery: query,
            blurred: true
          } as FilePreview, { status: 403 })
        }

        const fileName = path.basename(fileInsideArchive)
        const displayPath = `/data/${filePath}`.replace(/\\/g, "/")

        return NextResponse.json({
          fileName,
          filePath,
          displayPath,
          totalLines: lines.length,
          content: preview,
          searchQuery: query
        } as FilePreview)
      } catch (err) {
        console.error("Error reading file from archive:", err)
        return NextResponse.json({ error: "File not found in archive" }, { status: 404 })
      }
    } else {
      // Regular file in /data directory
      const fullPath = path.join(dataDir, filePath)

      // Security: prevent directory traversal
      if (!fullPath.startsWith(dataDir)) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 403 })
      }

      try {
        // Try to read file from filesystem first
        let content: string
        let lines: string[]
        
        try {
          content = await fs.readFile(fullPath, "utf-8").catch(async () => {
            const buffer = await fs.readFile(fullPath)
            return buffer.toString('latin1')
          })
          lines = content.split("\n")
        } catch (fileErr: any) {
          // File not found - try to get from Quickwit (file was deleted after indexing)
          if (fileErr.code === 'ENOENT') {
            
            // Get file content from Quickwit
            try {
              const searchUrl = `${QUICKWIT_URL}/api/v1/${INDEX_NAME}/search`
              const normalizedFilePath = filePath.replace(/\\/g, "/")
              
              // Search for all lines from this file
              const searchResponse = await fetch(searchUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: `file_path:"${normalizedFilePath}"`,
                  max_hits: maxLines,
                  search_field: "file_path"
                })
              })
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                const hits = searchData.hits || []
                
                if (hits.length > 0) {
                  // Sort by line number
                  hits.sort((a: any, b: any) => (a.line_number || 0) - (b.line_number || 0))
                  
                  // If specific line requested, filter to context around it
                  if (lineNum > 0) {
                    const startLine = Math.max(1, lineNum - contextLines)
                    const endLine = lineNum + contextLines
                    const filteredHits = hits.filter((h: any) => {
                      const ln = h.line_number || 0
                      return ln >= startLine && ln <= endLine
                    })
                    
                    // Create line map
                    const lineMap = new Map<number, string>()
                    filteredHits.forEach((h: any) => {
                      lineMap.set(h.line_number || 0, h.content || "")
                    })
                    
                    // Reconstruct lines array
                    lines = []
                    for (let i = startLine; i <= endLine; i++) {
                      lines.push(lineMap.get(i) || "")
                    }
                  } else {
                    // Get all lines
                    lines = hits.map((h: any) => h.content || "")
                  }
                  
                } else {
                  throw new Error("File not found in Quickwit")
                }
              } else {
                throw new Error(`Quickwit search failed: ${searchResponse.status}`)
              }
            } catch (quickwitErr: any) {
              console.error(`[FILE-PREVIEW] Quickwit error: ${quickwitErr.message}`)
              throw new Error(`File not found. It may have been deleted after indexing.`)
            }
          } else {
            throw fileErr
          }
        }
        
        const queryLower = query.toLowerCase().trim()

        const preview: PreviewLine[] = []
        let matchCount = 0
        
        // If a specific line is requested, show context around it
        if (lineNum > 0) {
          const start = Math.max(0, lineNum - 1 - contextLines)
          const end = Math.min(lines.length, lineNum - 1 + contextLines + 1)
          
          for (let i = start; i < end; i++) {
            const line = lines[i]
            const isMatch = Boolean(queryLower && line.toLowerCase().includes(queryLower))
            const matchPos = isMatch ? line.toLowerCase().indexOf(queryLower) : -1

            if (isMatch) matchCount++

            // SECURITY: NEVER send actual content when it should be blurred
            const lineContent = shouldBlur 
              ? "[BLURRED - Premium Content]"
              : line
            
            preview.push({
              lineNum: i + 1,
              content: lineContent,
              isMatch: i + 1 === lineNum ? true : isMatch,
              matchPos: i + 1 === lineNum ? 0 : matchPos
            })
          }
        } else {
          // Show all lines or up to maxLines
          const limitedLines = Math.min(lines.length, maxLines)

          for (let i = 0; i < limitedLines; i++) {
            const line = lines[i]
            const isMatch = Boolean(queryLower && line.toLowerCase().includes(queryLower))
            const matchPos = isMatch ? line.toLowerCase().indexOf(queryLower) : -1

            if (isMatch) matchCount++

            // SECURITY: NEVER send actual content when it should be blurred
            const lineContent = shouldBlur 
              ? "[BLURRED - Premium Content]"
              : line
            
            preview.push({
              lineNum: i + 1,
              content: lineContent,
              isMatch,
              matchPos
            })
          }
        }

        if (process.env.NODE_ENV === "development") {
        }
        
        // SECURITY: If file should be blurred, return error instead of content
        if (shouldBlur) {
          return NextResponse.json({ 
            error: "Access denied",
            message: "This file type requires a premium subscription to view",
            fileName: path.basename(filePath),
            filePath,
            displayPath: `/data/${filePath}`.replace(/\\/g, "/"),
            totalLines: lines.length,
            content: [],
            searchQuery: query,
            blurred: true
          } as FilePreview, { status: 403 })
        }

        const fileName = path.basename(filePath)
        const displayPath = `/data/${filePath}`.replace(/\\/g, "/")

        return NextResponse.json({
          fileName,
          filePath,
          displayPath,
          totalLines: lines.length,
          content: preview,
          searchQuery: query
        } as FilePreview)
      } catch (err) {
        console.error("Error reading file:", err)
        return NextResponse.json({ error: "File not found" }, { status: 404 })
      }
    }
  } catch (error) {
    console.error("File preview error:", error)
    return NextResponse.json({ error: "Failed to load file preview" }, { status: 500 })
  }
}

async function readFileFromArchive(archivePath: string, fileInsideArchive: string): Promise<string> {
  const ext = path.extname(archivePath).toLowerCase()

  try {
    if (ext === ".zip") {
      // Use adm-zip for ZIP files (no temporary directory needed)
      try {
        const zip = new AdmZip(archivePath)
        const normalizedPath = fileInsideArchive.replace(/\\/g, "/")
        const zipEntry = zip.getEntry(normalizedPath)
        
        if (!zipEntry) {
          throw new Error(`File not found in ZIP: ${fileInsideArchive}`)
        }
        
        const content = zipEntry.getData().toString("utf8")
        return content
      } catch (zipErr) {
        throw new Error(`Failed to read ZIP: ${zipErr instanceof Error ? zipErr.message : zipErr}`)
      }
    } else if (ext === ".rar" || ext === ".7z") {
      // RAR and 7Z require Go indexer or external tools
      throw new Error(`.${ext.slice(1).toUpperCase()} format requires Go indexer support`)
    } else {
      throw new Error(`Unsupported archive format: ${ext}`)
    }
  } catch (err) {
    throw new Error(`Failed to read file from archive: ${err instanceof Error ? err.message : err}`)
  }
}
