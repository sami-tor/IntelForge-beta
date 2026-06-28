import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import {
  getOrganizationById, updateOrganization, deleteOrganization,
  getUserOrgRole, hasMinRole,
} from "@/lib/organizations"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const orgId = parseInt(id)
  if (isNaN(orgId)) return NextResponse.json({ error: "Invalid org ID" }, { status: 400 })

  const role = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!role) return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })

  const org = await getOrganizationById(orgId)
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  return NextResponse.json({ organization: org, role })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const orgId = parseInt(id)
  if (isNaN(orgId)) return NextResponse.json({ error: "Invalid org ID" }, { status: 400 })

  const role = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!role || !hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const org = await updateOrganization(orgId, body)
  if (!org) return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })

  return NextResponse.json({ organization: org })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const orgId = parseInt(id)
  if (isNaN(orgId)) return NextResponse.json({ error: "Invalid org ID" }, { status: 400 })

  const role = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!role || role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete an organization" }, { status: 403 })
  }

  const ok = await deleteOrganization(orgId)
  if (!ok) return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })

  return NextResponse.json({ success: true })
}
