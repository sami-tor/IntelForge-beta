import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { requireCSRF, createCSRFResponse } from "@/lib/csrf"
import { addResponseSignature } from "@/lib/response-signing"
import { getAllSubscriptions, createSubscription, updateSubscription, deleteSubscription } from "@/lib/admin-db"
import { logAdminAction } from "@/lib/admin-db"

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const result = await getAllSubscriptions()

    if (!result.success) {
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
    }

    const signed = addResponseSignature({ subscriptions: result.data })
    return NextResponse.json(signed)
  } catch (error) {
    console.error("[v0] Admin subscriptions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { name, description, price, durationValue, durationUnit, isLifetime, features } = body

    const result = await createSubscription(name, description, price, durationValue, durationUnit, isLifetime, features)

    if (!result.success) {
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, "create_subscription", "subscription", result.data?.[0]?.id, { name })

    const signed = addResponseSignature({ success: true, subscription: result.data?.[0] })
    return NextResponse.json(signed)
  } catch (error) {
    console.error("[v0] Admin subscriptions POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const body = await request.json()
    const csrfResult = await requireCSRF(request, body.csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const { id, name, description, price, durationValue, durationUnit, isLifetime, features } = body
    
    // SECURITY: Validate id is a number
    const subscriptionId = parseInt(id)
    if (!subscriptionId || isNaN(subscriptionId)) {
      return NextResponse.json({ error: "Invalid subscription ID" }, { status: 400 })
    }

    const result = await updateSubscription(
      subscriptionId,
      name,
      description,
      price,
      durationValue,
      durationUnit,
      isLifetime,
      features,
    )

    if (!result.success) {
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, "update_subscription", "subscription", subscriptionId, { name })

    const signed = addResponseSignature({ success: true, subscription: result.data?.[0] })
    return NextResponse.json(signed)
  } catch (error) {
    console.error("[v0] Admin subscriptions PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    let csrfToken: any = undefined
    try {
      const body = await request.json()
      csrfToken = body?.csrfToken
    } catch {}
    const csrfResult = await requireCSRF(request, csrfToken)
    if (!csrfResult.authorized) {
      return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
    }
    const id = Number.parseInt(searchParams.get("id") || "0")

    if (!id) {
      return NextResponse.json({ error: "Subscription ID required" }, { status: 400 })
    }

    const result = await deleteSubscription(id)

    if (!result.success) {
      return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 })
    }

    await logAdminAction(authResult.user.user_id, "delete_subscription", "subscription", id, {})

    const signed = addResponseSignature({ success: true })
    return NextResponse.json(signed)
  } catch (error) {
    console.error("[v0] Admin subscriptions DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
