import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { getBrandingByOrgId, getBrandingByUserId, upsertBranding, generateCssVariables } from "@/lib/tenant"

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  const url = new URL(request.url)
  const orgId = url.searchParams.get("orgId")

  let branding = null
  if (orgId) {
    branding = await getBrandingByOrgId(parseInt(orgId))
  } else {
    branding = await getBrandingByUserId(authResult.user.user_id)
  }

  if (!branding) {
    return NextResponse.json({ branding: null, message: "No branding configured" })
  }

  return NextResponse.json({
    branding,
    cssVariables: generateCssVariables(branding),
  })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()

    const branding = await upsertBranding({
      ...body,
      user_id: body.organization_id ? undefined : authResult.user.user_id,
    })

    if (!branding) {
      return NextResponse.json({ error: "Failed to save branding" }, { status: 500 })
    }

    return NextResponse.json({ branding, cssVariables: generateCssVariables(branding) })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save branding" }, { status: 500 })
  }
}
