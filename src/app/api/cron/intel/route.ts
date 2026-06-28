import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { normalizeIntelBatch } from "@/lib/intel/normalizer"

const DEFAULT_BATCH_SIZE = 100

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV !== "production"
  const authHeader = request.headers.get("authorization") || ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  return bearer === expected || request.headers.get("x-cron-secret") === expected
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_BATCH_SIZE, 1), 500)

  const jobResult = await query(
    `INSERT INTO intel_jobs (job_type, status, started_at, cursor_value)
     VALUES ('normalization', 'running', NOW(), COALESCE((
       SELECT cursor_value FROM intel_jobs
       WHERE job_type = 'normalization' AND status = 'completed'
       ORDER BY completed_at DESC NULLS LAST, id DESC
       LIMIT 1
     ), '0'))
     RETURNING id, cursor_value`,
    []
  )

  const job = jobResult.data?.[0]
  const afterId = Number(job?.cursor_value || 0)

  try {
    const result = await normalizeIntelBatch(limit, afterId)
    if (!result.success) throw new Error(result.error || "Normalization failed")

    await query(
      `UPDATE intel_jobs
       SET status = 'completed', cursor_value = $1, stats = $2::jsonb, completed_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [String(result.lastId || afterId), JSON.stringify(result), job?.id]
    )

    return NextResponse.json({ ...result, jobId: job?.id })
  } catch (error) {
    await query(
      `UPDATE intel_jobs
       SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [error instanceof Error ? error.message : "Unknown error", job?.id]
    )
    return NextResponse.json({ error: "Intel cron failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
