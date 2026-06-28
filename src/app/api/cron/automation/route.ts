// ================================================
// Cron: IntelForge Automation Pipeline
// ------------------------------------------------
// Runs threat scoring + correlation + trends + briefing
// + forecast + actions + geo + notifications.
// Schedule alongside /api/cron/intel-sync.
//
// Header: Authorization: Bearer <CRON_SECRET>
//   or:    x-cron-secret: <CRON_SECRET>
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { runFullAutomation } from "@/lib/intel/automation/orchestrator"
import { checkCronRateLimit } from "@/lib/intel/automation/cron-rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV !== "production"
  const authHeader = request.headers.get("authorization") || ""
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  return bearer === expected || request.headers.get("x-cron-secret") === expected
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ip = clientIp(request)
  const decision = await checkCronRateLimit("automation", ip, 10)
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", resetIn: decision.resetIn },
      { status: 429, headers: { "Retry-After": String(decision.resetIn) } },
    )
  }

  try {
    const result = await runFullAutomation()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      rateLimit: { remaining: decision.remaining },
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Automation pipeline failed",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}

export async function GET(request: NextRequest) {
  return handle(request)
}
