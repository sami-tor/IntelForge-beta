import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/middleware"
import { getDb } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"

interface HealthStatus {
  database: {
    status: "online" | "offline" | "degraded"
    message: string
    responseTime: number
  }
  fileSystem: {
    status: "online" | "offline" | "degraded"
    message: string
    dataDir: string
  }
  api: {
    status: "online" | "offline"
    message: string
    uptime: number
  }
  overall: "healthy" | "degraded" | "unhealthy"
  timestamp: string
}

// Track server startup time
const serverStartTime = Date.now()

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const health: HealthStatus = {
      database: { status: "offline", message: "Not checked", responseTime: 0 },
      fileSystem: { status: "offline", message: "Not checked", dataDir: "" },
      api: { status: "offline", message: "Not checked", uptime: 0 },
      overall: "unhealthy",
      timestamp: new Date().toISOString(),
    }

    // Check Database
    const dbStartTime = Date.now()
    try {
      const db = getDb()
      const result = await db.query("SELECT NOW()")
      const dbResponseTime = Date.now() - dbStartTime

      health.database = {
        status: dbResponseTime > 1000 ? "degraded" : "online",
        message: `Connected successfully (${dbResponseTime}ms)`,
        responseTime: dbResponseTime,
      }
    } catch (error) {
      health.database = {
        status: "offline",
        message: error instanceof Error ? error.message : "Connection failed",
        responseTime: Date.now() - dbStartTime,
      }
    }

    // Check File System
    const dataDir = path.join(process.cwd(), "data")
    try {
      await fs.access(dataDir)
      const stats = await fs.stat(dataDir)
      const files = await fs.readdir(dataDir)

      health.fileSystem = {
        status: "online",
        message: `Accessible - ${files.length} items found`,
        dataDir,
      }
    } catch (error) {
      health.fileSystem = {
        status: "offline",
        message: error instanceof Error ? error.message : "Not accessible",
        dataDir,
      }
    }

    // Check API (always online if this endpoint responds)
    const uptime = Date.now() - serverStartTime
    health.api = {
      status: "online",
      message: `Server running normally`,
      uptime,
    }

    // Determine overall health
    const statuses = [
      health.database.status,
      health.fileSystem.status,
      health.api.status,
    ]
    if (statuses.every((s) => s === "online")) {
      health.overall = "healthy"
    } else if (statuses.some((s) => s === "offline")) {
      health.overall = "unhealthy"
    } else {
      health.overall = "degraded"
    }

    return NextResponse.json(health)
  } catch (error) {
    console.error("[Admin Health] Check failed:", error)
    return NextResponse.json(
      { error: "Health check failed", overall: "unhealthy" },
      { status: 500 }
    )
  }
}
