import { NextResponse } from "next/server"
import { getActorRelationships } from "@/lib/intel/actor-relationships"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const data = await getActorRelationships()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
