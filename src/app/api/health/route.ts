import { NextResponse } from "next/server"
import { checkDatabaseHealth } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"

/**
 * Health Check Endpoint
 * Used for monitoring, load balancers, and uptime checks
 * Returns 200 if all systems operational, 503 if degraded
 */
export async function GET() {
  const startTime = Date.now()
  
  const health = {
    status: "ok" as "ok" | "degraded" | "error",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "unknown",
    checks: {
      database: { status: "unknown" as "ok" | "error", message: "", latency: 0 },
      filesystem: { status: "unknown" as "ok" | "error", message: "" },
      memory: { status: "ok" as "ok" | "error", usage: {} as any },
      quickwit: { status: "unknown" as "ok" | "error", message: "" },
      visualSearch: { status: "unknown" as "ok" | "error", message: "" },
    },
    responseTime: 0
  }

  // 1. Check Database
  try {
    const dbHealth = await checkDatabaseHealth()
    if (dbHealth.healthy) {
      health.checks.database = {
        status: "ok",
        message: dbHealth.message,
        latency: dbHealth.latency || 0
      }
    } else {
      health.checks.database = {
        status: "error",
        message: dbHealth.message,
        latency: 0
      }
      health.status = "degraded"
    }
  } catch (error) {
    health.checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Database check failed",
      latency: 0
    }
    health.status = "error"
  }

  // 2. Check File System (data directory)
  try {
    const dataDir = path.join(process.cwd(), "data")
    await fs.access(dataDir)
    const stats = await fs.stat(dataDir)
    health.checks.filesystem = {
      status: "ok",
      message: `Data directory accessible (${stats.isDirectory() ? 'directory' : 'not a directory'})`
    }
  } catch (error) {
    health.checks.filesystem = {
      status: "error",
      message: error instanceof Error ? error.message : "Filesystem check failed"
    }
    health.status = "degraded"
  }

  // 3. Check Memory Usage
  const memoryUsage = process.memoryUsage()
  const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024
  const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024
  const memoryPercent = (usedMemoryMB / totalMemoryMB) * 100

  const isDev = process.env.NODE_ENV !== "production"
  const memoryThreshold = isDev ? 98 : 90
  health.checks.memory = {
    status: memoryPercent > memoryThreshold ? "error" : "ok",
    usage: {
      heapUsed: `${usedMemoryMB.toFixed(2)} MB`,
      heapTotal: `${totalMemoryMB.toFixed(2)} MB`,
      percent: `${memoryPercent.toFixed(2)}%`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
    }
  }

  // In development, high heap usage is common (webpack HMR) — don't fail health checks
  if (memoryPercent > memoryThreshold && !isDev) {
    health.status = "degraded"
  }

  // 4. Optional services (informational — do not mark degraded when offline)
  const quickwitUrl = process.env.QUICKWIT_URL || "http://localhost:7280"
  try {
    const qw = await fetch(`${quickwitUrl}/api/v1/health`, { signal: AbortSignal.timeout(3000) })
    health.checks.quickwit = {
      status: qw.ok ? "ok" : "error",
      message: qw.ok ? "Quickwit reachable" : `HTTP ${qw.status}`,
    }
  } catch {
    health.checks.quickwit = { status: "error", message: "Quickwit unreachable (start Docker stack for full-text search)" }
  }

  const visualUrl = process.env.VISUAL_SEARCH_SERVICE_URL || "http://localhost:8000"
  try {
    const vs = await fetch(`${visualUrl}/health`, { signal: AbortSignal.timeout(3000) })
    health.checks.visualSearch = {
      status: vs.ok ? "ok" : "error",
      message: vs.ok ? "Visual search service reachable" : `HTTP ${vs.status}`,
    }
  } catch {
    health.checks.visualSearch = { status: "error", message: "Visual search service unreachable" }
  }

  // Calculate total response time
  health.responseTime = Date.now() - startTime

  // Return appropriate status code
  const statusCode = health.status === "ok" ? 200 : health.status === "degraded" ? 503 : 503

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json"
    }
  })
}

// HEAD request for simple uptime checks
export async function HEAD() {
  try {
    const dbHealth = await checkDatabaseHealth()
    return new NextResponse(null, {
      status: dbHealth.healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}


