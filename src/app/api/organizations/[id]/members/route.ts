import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import {
  getOrgMembers, addOrgMember, removeOrgMember, updateMemberRole,
  getUserOrgRole, hasMinRole, createOrgInvite, getOrgInvites, type OrgRole,
} from "@/lib/organizations"
import { getUserByEmail } from "@/lib/db"

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
  if (!role) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const members = await getOrgMembers(orgId)
  const invites = await getOrgInvites(orgId)

  return NextResponse.json({ members, invites })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const { id } = await params
  const orgId = parseInt(id)
  if (isNaN(orgId)) return NextResponse.json({ error: "Invalid org ID" }, { status: 400 })

  const userRole = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!userRole || !hasMinRole(userRole, "admin")) {
    return NextResponse.json({ error: "Admin access required to invite members" }, { status: 403 })
  }

  const body = await request.json()
  const { email, role } = body
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

  const memberRole: OrgRole = ["owner", "admin", "member", "viewer"].includes(role) ? role : "member"

  // If user already exists, add them directly
  const userResult = await getUserByEmail(email)
  if (userResult.success && userResult.data?.length) {
    const existingUser = userResult.data[0]
    const ok = await addOrgMember(orgId, existingUser.id, memberRole, authResult.user.user_id)
    if (!ok) return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
    return NextResponse.json({ success: true, added: true, invited: false })
  }

  // Otherwise, create invite
  const token = await createOrgInvite(orgId, email, memberRole, authResult.user.user_id)
  if (!token) return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })

  return NextResponse.json({ success: true, added: false, invited: true, token })
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

  const userRole = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!userRole || !hasMinRole(userRole, "admin")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const { userId, role } = body
  if (!userId || !role) return NextResponse.json({ error: "userId and role are required" }, { status: 400 })

  // Can't demote the last owner
  if (role !== "owner") {
    const members = await getOrgMembers(orgId)
    const owners = members.filter(m => m.role === "owner")
    if (owners.length === 1 && owners[0].user_id === userId) {
      return NextResponse.json({ error: "Cannot remove the last owner. Transfer ownership first." }, { status: 400 })
    }
  }

  const ok = await updateMemberRole(orgId, userId, role as OrgRole)
  if (!ok) return NextResponse.json({ error: "Failed to update role" }, { status: 500 })

  return NextResponse.json({ success: true })
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

  const userRole = await getUserOrgRole(orgId, authResult.user.user_id)
  if (!userRole || !hasMinRole(userRole, "admin")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const url = new URL(request.url)
  const targetUserId = parseInt(url.searchParams.get("userId") || "")
  if (isNaN(targetUserId)) return NextResponse.json({ error: "userId query param required" }, { status: 400 })

  // Cannot remove self (use leave instead)
  if (targetUserId === authResult.user.user_id) {
    return NextResponse.json({ error: "Use the leave endpoint instead of removing yourself" }, { status: 400 })
  }

  const ok = await removeOrgMember(orgId, targetUserId)
  if (!ok) return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })

  return NextResponse.json({ success: true })
}
