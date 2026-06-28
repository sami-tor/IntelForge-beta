import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { switchUserOrg, getUserOrgRole } from "@/lib/organizations"

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const orgId = parseInt(body.orgId)
    if (isNaN(orgId)) return NextResponse.json({ error: "Valid orgId is required" }, { status: 400 })

    const role = await getUserOrgRole(orgId, authResult.user.user_id)
    if (!role) return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 })

    const ok = await switchUserOrg(authResult.user.user_id, orgId)
    if (!ok) return NextResponse.json({ error: "Failed to switch organization" }, { status: 500 })

    return NextResponse.json({ success: true, orgId, role })
  } catch (error) {
    return NextResponse.json({ error: "Failed to switch organization" }, { status: 500 })
  }
}
