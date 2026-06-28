import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { normalizeIntelBatch } from "@/lib/intel/normalizer"

const DEFAULT_BATCH_SIZE = 100
const MAX_BATCH_SIZE = 500

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error, authResult.status)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE)
    const afterId = Math.max(Number(body.afterId) || 0, 0)
    const result = await normalizeIntelBatch(limit, afterId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Intel normalization failed:", error)
    return NextResponse.json({ error: "Intel normalization failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
