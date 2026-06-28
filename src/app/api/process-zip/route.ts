import { type NextRequest, NextResponse } from "next/server"
import { join } from "path"
import path from "path"
import { promises as fs } from "fs"
import { requireAuth, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { updateFileStatus, saveExtractedData } from "@/lib/db"
import { validateFilePath } from "@/lib/validation"
import { addResponseSignature } from "@/lib/response-signing"

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  const user = authResult.user

  if (user.verification_status !== "verified") {
    return NextResponse.json({ error: "Account not verified. Please verify your email." }, { status: 403 })
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { filepath, fileId } = body

    if (!filepath) {
      return NextResponse.json({ error: "No filepath provided" }, { status: 400 })
    }

    const uploadsDir = join(process.cwd(), "uploads")
    const validation = validateFilePath(filepath, uploadsDir)
    
    if (!validation.valid || !validation.path) {
      return NextResponse.json({ error: validation.error || "Invalid file path" }, { status: 403 })
    }
    
    const fullPath = validation.path
    
    // Check if file exists
    try {
      await fs.access(fullPath)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const mockResults = {
      filename: filepath.split("/").pop(),
      processed_at: new Date().toISOString(),
      files: [
        { name: "data.txt", size: 1024, mime_type: "text/plain", extracted: true },
        { name: "info.json", size: 512, mime_type: "application/json", extracted: true },
      ],
      total_files: 2,
      total_size: 1536,
      file_types: { ".txt": 1, ".json": 1 },
      status: "success",
      errors: [],
    }

    // Update file status in database if DATABASE_URL is set
    if (process.env.DATABASE_URL && fileId) {
      await updateFileStatus(fileId, "processed")

      // Save extracted data
      await saveExtractedData(fileId, "zip_analysis", JSON.stringify(mockResults), mockResults)
    }

    const signed = addResponseSignature({
      success: true,
      results: mockResults,
    })
    return NextResponse.json(signed)
  } catch (error) {
    console.error("[v0] Processing error:", error)
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 })
  }
}
