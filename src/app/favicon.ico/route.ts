import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

// Serve favicon.ico
export async function GET() {
  try {
    const faviconPath = join(process.cwd(), "public", "placeholder-logo.png")
    if (existsSync(faviconPath)) {
      const favicon = readFileSync(faviconPath)
      return new NextResponse(favicon, {
        status: 200,
        headers: { "Content-Type": "image/png" }
      })
    }
  } catch (e) {}
  
  // Return transparent 1x1 PNG if no favicon
  const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
  return new NextResponse(transparentPng, {
    status: 200,
    headers: { "Content-Type": "image/png" }
  })
}

