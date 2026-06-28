import { NextRequest, NextResponse } from "next/server"
import { createAuthResponse, requireAuth } from "@/lib/middleware"
import { getBrandingByOrgId, requestDomainVerification, verifyDomain } from "@/lib/tenant"

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!authResult.authorized) return createAuthResponse(authResult.error, authResult.status)

  try {
    const body = await request.json()
    const { action, orgId, domain } = body

    if (action === "request") {
      if (!domain) return NextResponse.json({ error: "Domain is required" }, { status: 400 })

      const branding = orgId
        ? await getBrandingByOrgId(parseInt(orgId))
        : null

      if (!branding) {
        // Create branding first if needed
        return NextResponse.json({ error: "Branding not configured. Save branding settings first." }, { status: 400 })
      }

      const token = await requestDomainVerification(branding.id, domain)
      if (!token) return NextResponse.json({ error: "Failed to request verification" }, { status: 500 })

      return NextResponse.json({
        success: true,
        token,
        dnsRecord: `TXT: _intelforge-verify.${domain} → ${token}`,
        message: `Add a TXT record to verify domain ownership.`,
      })
    }

    if (action === "verify") {
      const { brandingId, token } = body
      if (!brandingId || !token) {
        return NextResponse.json({ error: "brandingId and token are required" }, { status: 400 })
      }

      const ok = await verifyDomain(parseInt(brandingId), token)
      if (!ok) return NextResponse.json({ error: "Verification failed. Check the token." }, { status: 400 })

      return NextResponse.json({ success: true, message: "Domain verified successfully" })
    }

    return NextResponse.json({ error: "Invalid action. Use: request, verify" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process domain request" }, { status: 500 })
  }
}
