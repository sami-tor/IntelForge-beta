import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { getUserOrganizations, createOrganization } from "@/lib/organizations"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const orgs = await getUserOrganizations(authResult.user.user_id)
    return NextResponse.json({ organizations: orgs })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Organization name must be at least 2 characters" }, { status: 400 })
    }

    const slug = body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const org = await createOrganization(name, slug, authResult.user.user_id, body.description)
    if (!org) {
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    return NextResponse.json({ organization: org }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
