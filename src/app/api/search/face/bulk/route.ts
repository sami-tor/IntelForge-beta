import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import pLimit from "p-limit"

export const dynamic = "force-dynamic"

const VISUAL_SEARCH_URL = process.env.VISUAL_SEARCH_SERVICE_URL || "http://localhost:8000"

async function searchSingleImage(
  formData: FormData,
  limit: number,
  apiKey?: string,
): Promise<{ results: any[]; total: number; searchTime: number; error?: string }> {
  try {
    const headers: HeadersInit = {}
    if (apiKey) headers["X-Internal-API-Key"] = apiKey

    const startTime = Date.now()
    const res = await fetch(`${VISUAL_SEARCH_URL}/api/search/face?limit=${limit}`, {
      method: "POST",
      body: formData,
      headers,
    })

    const data = await res.json()
    const searchTime = Date.now() - startTime

    if (!res.ok) {
      const errMsg = data?.error || data?.detail || data?.message || `HTTP ${res.status}`
      return { results: [], total: 0, searchTime, error: errMsg }
    }

    const faces = (data && (data.faces || data.results)) || []
    return { results: Array.isArray(faces) ? faces : [], total: faces.length, searchTime }
  } catch (err: any) {
    return { results: [], total: 0, searchTime: 0, error: err.message || "Search failed" }
  }
}

function detectCrossMatches(allResults: { fileName: string; results: any[] }[]): {
  faceId1: string
  faceId2: string
  fileName1: string
  fileName2: string
}[] {
  const matches: { faceId1: string; faceId2: string; fileName1: string; fileName2: string }[] = []
  for (let i = 0; i < allResults.length; i++) {
    for (let j = i + 1; j < allResults.length; j++) {
      const idsI = new Set(allResults[i].results.map(r => r.face_id || r.id).filter(Boolean))
      const idsJ = new Set(allResults[j].results.map(r => r.face_id || r.id).filter(Boolean))
      for (const id of idsI) {
        if (idsJ.has(id)) {
          matches.push({
            faceId1: id,
            faceId2: id,
            fileName1: allResults[i].fileName,
            fileName2: allResults[j].fileName,
          })
        }
      }
    }
  }
  return matches
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth?.isValid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 30)

    const formData = await request.formData()
    const files = formData.getAll("images") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "At least one image file is required" }, { status: 400 })
    }

    if (files.length > 10) {
      return NextResponse.json({ error: "Maximum 10 images per bulk search" }, { status: 400 })
    }

    // Process with concurrency limit of 3
    const limitFn = pLimit(3)
    const tasks = files.map((file, idx) =>
      limitFn(async () => {
        const singleForm = new FormData()
        const buffer = await file.arrayBuffer()
        const blob = new Blob([buffer], { type: file.type || "image/jpeg" })
        singleForm.append("file", blob, file.name)

        const result = await searchSingleImage(
          singleForm,
          limit,
          process.env.VISUAL_SEARCH_API_KEY,
        )

        let previewBase64: string | undefined
        if (buffer.byteLength < 500 * 1024) {
          const b64 = Buffer.from(buffer).toString("base64")
          previewBase64 = `data:${file.type || "image/jpeg"};base64,${b64}`
        }

        return {
          fileName: file.name,
          imagePreview: previewBase64,
          results: result.results,
          total: result.total,
          searchTime: result.searchTime,
          error: result.error,
        }
      }),
    )

    const allResults = await Promise.all(tasks)

    // Detect cross-matches
    const crossMatches = detectCrossMatches(
      allResults.filter(r => r.results.length > 0),
    )

    return NextResponse.json({
      results: allResults,
      cross_matches: crossMatches,
      total_images: files.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: "Bulk search failed", message: err.message },
      { status: 500 },
    )
  }
}
