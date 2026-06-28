import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import { safeJsonParse } from "@/lib/safe-json"

interface DeviceQuota {
  deviceId: string
  fingerprint: string
  searchCount: number
  createdAt: string
  lastActivity: string
  expiresAt: string
}

// Store outside /data to avoid indexing
const QUOTA_FILE = path.join(process.cwd(), ".device-quotas.json")

// Ensure file exists
function initFile() {
  const dir = path.dirname(QUOTA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(QUOTA_FILE)) {
    fs.writeFileSync(QUOTA_FILE, JSON.stringify({}))
  }
}

function getQuotas(): Record<string, DeviceQuota> {
  initFile()
  try {
    const data = safeJsonParse<Record<string, DeviceQuota>>(fs.readFileSync(QUOTA_FILE, "utf-8"), {}) || {}
    // Clean up expired quotas
    const now = new Date().toISOString()
    Object.keys(data).forEach(key => {
      if (new Date(data[key].expiresAt) < new Date(now)) {
        delete data[key]
      }
    })
    return data
  } catch {
    return {}
  }
}

function saveQuotas(quotas: Record<string, DeviceQuota>) {
  initFile()
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(quotas, null, 2))
}

// Generate device fingerprint from browser and IP
function generateDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent") || "unknown"
  const acceptLanguage = request.headers.get("accept-language") || "unknown"
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                   request.headers.get("x-real-ip") || 
                   "unknown"
  
  // Create fingerprint from browser + IP (device-based, not session-based)
  const fingerprint = `${userAgent}|${acceptLanguage}|${ipAddress}`
  return crypto.createHash("sha256").update(fingerprint).digest("hex")
}

export async function GET(request: NextRequest) {
  const fingerprint = generateDeviceFingerprint(request)
  const quotas = getQuotas()
  const quota = quotas[fingerprint]

  if (!quota) {
    return NextResponse.json({
      searchCount: 0,
      searchLimit: 10,
      deviceId: fingerprint
    })
  }

  return NextResponse.json({
    searchCount: quota.searchCount,
    searchLimit: 10,
    deviceId: fingerprint,
    createdAt: quota.createdAt
  })
}

export async function POST(request: NextRequest) {
  const fingerprint = generateDeviceFingerprint(request)
  const { action, increment } = await request.json()
  const quotas = getQuotas()

  if (action === "create") {
    // Create or get device quota
    if (!quotas[fingerprint]) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // Quota expires in 30 days
      
      quotas[fingerprint] = {
        deviceId: fingerprint,
        fingerprint,
        searchCount: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }
      saveQuotas(quotas)
    }
  } else if (action === "increment") {
    // Initialize if doesn't exist
    if (!quotas[fingerprint]) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      
      quotas[fingerprint] = {
        deviceId: fingerprint,
        fingerprint,
        searchCount: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    }

    // Increment search count
    quotas[fingerprint].searchCount += increment || 1
    quotas[fingerprint].lastActivity = new Date().toISOString()
    
    // Check if limit exceeded
    if (quotas[fingerprint].searchCount > 10) {
      return NextResponse.json({
        success: false,
        error: "Device limit exceeded: 10 searches maximum. Please login to get 50+ searches.",
        searchCount: quotas[fingerprint].searchCount,
        searchLimit: 10,
        message: "Create an account to unlock 50 searches per month!"
      }, { status: 429 })
    }
    
    saveQuotas(quotas)
  }

  const current = quotas[fingerprint]
  return NextResponse.json({
    success: true,
    deviceId: fingerprint,
    searchCount: current?.searchCount || 0,
    searchLimit: 10
  })
}

