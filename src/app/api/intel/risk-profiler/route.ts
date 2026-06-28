import { NextRequest, NextResponse } from "next/server"
import { profileTechStack } from "@/lib/intel/risk-profiler"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ stack: [] }))
  const stack: { product: string; version?: string }[] = body.stack || []

  if (!Array.isArray(stack) || stack.length === 0 || stack.length > 20) {
    return NextResponse.json({ success: false, error: "Provide 1-20 products" }, { status: 400 })
  }

  try {
    const data = await profileTechStack(stack)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
