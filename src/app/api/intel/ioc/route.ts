import { NextRequest, NextResponse } from "next/server"
import { lookupIOC, detectIOCType } from "@/lib/intel/fetchers/ioc"
import { checkIntelAccess, logIOCLookup } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let user: { id?: number; role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "ioc_lookup")
  if (!gate.allowed) {
    return NextResponse.json({
      success: false,
      error: gate.reason,
      upgradeRequired: gate.upgradeRequired,
    }, { status: 429 })
  }

  let body: { value?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { value, type } = body
  if (!value || typeof value !== "string" || value.trim().length < 3) {
    return NextResponse.json({ success: false, error: "Invalid IOC value" }, { status: 400 })
  }

  const iocType = (type as "ip" | "domain" | "hash" | "url" | undefined) || detectIOCType(value.trim())
  const result = await lookupIOC(value.trim(), iocType)

  // Log lookup for quota tracking
  await logIOCLookup(user?.id ?? null, iocType, value.trim(), result)

  return NextResponse.json({ success: true, data: result })
}

// Also support GET for API key users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const value = searchParams.get("value")
  const type = searchParams.get("type")

  if (!value) {
    return NextResponse.json({ success: false, error: "value param required" }, { status: 400 })
  }

  let user: { id?: number; role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try {
    const auth = await requireAuth(request)
    if (auth.authorized) user = auth.user
  } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "ioc_lookup")
  if (!gate.allowed) {
    return NextResponse.json({
      success: false,
      error: gate.reason,
      upgradeRequired: gate.upgradeRequired,
    }, { status: 429 })
  }

  const iocType = (type as "ip" | "domain" | "hash" | "url" | undefined) || detectIOCType(value.trim())
  const result = await lookupIOC(value.trim(), iocType)
  await logIOCLookup(user?.id ?? null, iocType, value.trim(), result)

  return NextResponse.json({ success: true, data: result })
}
