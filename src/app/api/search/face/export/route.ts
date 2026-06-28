import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import { generateDossierPdf } from "@/lib/face-dossier-pdf"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth?.isValid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { title, query_url, query_exif, results } = body

    if (!title || !results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "title and results[] are required" },
        { status: 400 },
      )
    }

    const pdfBuffer = await generateDossierPdf({
      title,
      queryUrl: query_url || undefined,
      queryExif: query_exif || undefined,
      results: results.slice(0, 50),
    })

    const uint8 = new Uint8Array(pdfBuffer)
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="face-dossier-${Date.now()}.pdf"`,
        "Content-Length": String(uint8.length),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: "PDF generation failed", message: err.message },
      { status: 500 },
    )
  }
}
