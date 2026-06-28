import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { query } from "@/lib/db"

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse("Admin access required", 403)
    }

    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }

    const { id } = await params
    const keyId = parseInt(id)

    if (isNaN(keyId)) {
      return NextResponse.json({ error: "Invalid key ID" }, { status: 400 })
    }

    // Revoke the API key (set is_active to false)
    const result = await query(
      "UPDATE api_keys SET is_active = false WHERE id = $1",
      [keyId]
    )

    if (!result.success) {
      throw new Error("Failed to revoke API key")
    }


    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    })
  } catch (error: any) {
    console.error("[v0] Failed to revoke API key:", error)
    return NextResponse.json({ success: false, error: "Failed to revoke API key" }, { status: 500 })
  }
}

