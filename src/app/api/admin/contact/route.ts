import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"

// GET - Admin: Fetch all contact messages
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const sql = `
      SELECT 
        id,
        name,
        email,
        message_type,
        message,
        status,
        created_at
      FROM contact_messages
      ORDER BY created_at DESC
      LIMIT 500
    `

    const result = await query(sql)

    return NextResponse.json({
      success: true,
      messages: result.data || [],
    })
  } catch (error: any) {
    console.error("[ADMIN] Failed to fetch contact messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// PUT - Admin: Update message status
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const { id, status } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 })
    }
    
    // SECURITY: Validate id is a number
    const messageId = parseInt(id)
    if (!messageId || isNaN(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 })
    }
    
    // SECURITY: Validate status value
    const validStatuses = ['new', 'read', 'replied', 'archived']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const sql = `
      UPDATE contact_messages
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `

    const result = await query(sql, [status, messageId])

    return NextResponse.json({
      success: true,
      message: result.data?.[0],
    })
  } catch (error: any) {
    console.error("[ADMIN] Failed to update message:", error)
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
  }
}

// DELETE - Admin: Delete message
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing message ID" }, { status: 400 })
    }
    
    // SECURITY: Validate id is a number
    const messageId = parseInt(id)
    if (!messageId || isNaN(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 })
    }

    const sql = "DELETE FROM contact_messages WHERE id = $1"
    await query(sql, [messageId])

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
    })
  } catch (error: any) {
    console.error("[ADMIN] Failed to delete message:", error)
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }
}
