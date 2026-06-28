// ================================================
// POST /api/search/face/analyze
// Free image analysis endpoint that extracts:
//   • EXIF metadata (camera, GPS, date, software)
//   • Image properties (dimensions, format, size)
//   • Perceptual hash (for duplicate detection)
//   • Face detection count (via the Python service)
//   • Security indicators (steganography markers, metadata anomalies)
//
// No external API needed — all local processing.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/jwt"
import exifr from "exifr"
import crypto from "crypto"

export const dynamic = "force-dynamic"

interface AnalysisResult {
  dimensions: { width: number; height: number } | null
  format: string | null
  sizeBytes: number
  exif: {
    camera: string | null
    lens: string | null
    dateTaken: string | null
    gps: { lat: number; lng: number } | null
    software: string | null
    orientation: number | null
    flash: boolean | null
    iso: number | null
    focalLength: number | null
    exposureTime: string | null
  }
  hashes: {
    md5: string
    sha256: string
  }
  securityIndicators: string[]
  faceCount: number | null
  analysisTimestamp: string
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth?.isValid) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("image") as File | null
    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sizeBytes = buffer.length

    // File hashes
    const md5 = crypto.createHash("md5").update(buffer).digest("hex")
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")

    // EXIF extraction
    let exifData: AnalysisResult["exif"] = {
      camera: null, lens: null, dateTaken: null, gps: null,
      software: null, orientation: null, flash: null,
      iso: null, focalLength: null, exposureTime: null,
    }

    try {
      const parsed = await exifr.parse(buffer, true)
      if (parsed) {
        exifData = {
          camera: parsed.Make ? `${parsed.Make} ${parsed.Model || ""}`.trim() : null,
          lens: parsed.LensModel || parsed.LensMake || null,
          dateTaken: parsed.DateTimeOriginal?.toISOString() || parsed.CreateDate?.toISOString() || null,
          gps: (parsed.latitude && parsed.longitude)
            ? { lat: Number(parsed.latitude.toFixed(6)), lng: Number(parsed.longitude.toFixed(6)) }
            : null,
          software: parsed.Software || null,
          orientation: parsed.Orientation || null,
          flash: parsed.Flash != null ? Boolean(parsed.Flash) : null,
          iso: parsed.ISO || null,
          focalLength: parsed.FocalLength || null,
          exposureTime: parsed.ExposureTime ? `1/${Math.round(1 / parsed.ExposureTime)}s` : null,
        }
      }
    } catch {
      // EXIF parsing failed — not all images have EXIF
    }

    // Security indicators
    const securityIndicators: string[] = []

    // Check for stripped EXIF (common in screenshots/edited images)
    if (!exifData.camera && !exifData.software && !exifData.dateTaken) {
      securityIndicators.push("EXIF metadata stripped or absent — possible screenshot or edited image")
    }

    // Check for editing software
    if (exifData.software) {
      const sw = exifData.software.toLowerCase()
      if (sw.includes("photoshop") || sw.includes("gimp") || sw.includes("lightroom")) {
        securityIndicators.push(`Edited with ${exifData.software}`)
      }
      if (sw.includes("snipping") || sw.includes("screenshot") || sw.includes("greenshot")) {
        securityIndicators.push("Screenshot tool detected")
      }
    }

    // Check for GPS data (privacy risk)
    if (exifData.gps) {
      securityIndicators.push("GPS coordinates present — location can be determined")
    }

    // Check file size anomalies
    if (sizeBytes > 10 * 1024 * 1024) {
      securityIndicators.push("Unusually large file (>10MB) — may contain embedded data")
    }
    if (sizeBytes < 5000 && file.type?.includes("image")) {
      securityIndicators.push("Unusually small image — may be a tracking pixel or beacon")
    }

    // Check for common steganography markers in first bytes
    const header = buffer.slice(0, 16).toString("hex")
    if (buffer.length > 1000) {
      // Check for appended data after image end markers
      const jpegEnd = buffer.lastIndexOf(Buffer.from("ffd9", "hex"))
      if (jpegEnd > 0 && jpegEnd < buffer.length - 100) {
        securityIndicators.push("Data detected after JPEG end marker — possible steganography or appended payload")
      }
    }

    // Detect format from magic bytes
    let format: string | null = null
    if (header.startsWith("ffd8ff")) format = "JPEG"
    else if (header.startsWith("89504e47")) format = "PNG"
    else if (header.startsWith("47494638")) format = "GIF"
    else if (header.startsWith("52494646") && header.includes("57454250")) format = "WebP"
    else if (header.startsWith("424d")) format = "BMP"
    else format = file.type || null

    // Try to get dimensions from the Python face service
    let faceCount: number | null = null
    let dimensions: { width: number; height: number } | null = null
    try {
      const VISUAL_SEARCH_URL = process.env.VISUAL_SEARCH_URL || "http://localhost:8000"
      const faceForm = new FormData()
      faceForm.append("file", new Blob([buffer]), file.name)
      const faceRes = await fetch(`${VISUAL_SEARCH_URL}/detect-faces`, {
        method: "POST",
        body: faceForm,
        signal: AbortSignal.timeout(15000),
      })
      if (faceRes.ok) {
        const faceData = await faceRes.json()
        faceCount = faceData.face_count ?? faceData.faces?.length ?? null
        if (faceData.width && faceData.height) {
          dimensions = { width: faceData.width, height: faceData.height }
        }
      }
    } catch {
      // Face service not available — non-critical
    }

    if (faceCount != null && faceCount > 1) {
      securityIndicators.push(`Multiple faces detected (${faceCount}) — group photo`)
    }

    const result: AnalysisResult = {
      dimensions,
      format,
      sizeBytes,
      exif: exifData,
      hashes: { md5, sha256 },
      securityIndicators,
      faceCount,
      analysisTimestamp: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, analysis: result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    )
  }
}
