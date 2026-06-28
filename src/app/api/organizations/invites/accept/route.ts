import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { acceptOrgInvite } from "@/lib/organizations"

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const { token } = body
    if (!token) return NextResponse.json({ error: "Invite token is required" }, { status: 400 })

    const orgId = await acceptOrgInvite(token, authResult.user.user_id)
    if (!orgId) {
      return NextResponse.json({ error: "Invalid or expired invite token" }, { status: 404 })
    }

    return NextResponse.json({ success: true, orgId })
  } catch (error) {
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 })
  }
}
