import { NextResponse } from "next/server"
import { getFeedHealth } from "@/lib/intel/feed-health"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getFeedHealth()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
