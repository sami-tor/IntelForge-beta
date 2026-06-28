import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { validateSearchInput } from "@/lib/validation"

// POST - Public: Submit contact/feedback/deletion request
export async function POST(request: NextRequest) {
  try {
    const { name, email, messageType, message } = await request.json()

    // Validate inputs
    if (!name || !email || !messageType || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Validate message type
    const validTypes = ["feedback", "contact", "deletion_request"]
    if (!validTypes.includes(messageType)) {
      return NextResponse.json(
        { error: "Invalid message type" },
        { status: 400 }
      )
    }

    // Sanitize message
    const validation = validateSearchInput(message)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid message content" },
        { status: 400 }
      )
    }

    // Get IP address
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                     request.headers.get("x-real-ip") || 
                     "unknown"

    // Insert into database
    const sql = `
      INSERT INTO contact_messages (name, email, message_type, message, ip_address, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING id
    `

    const result = await query(sql, [name, email, messageType, validation.sanitized, ipAddress])

    return NextResponse.json({
      success: true,
      message: "Your message has been submitted successfully. We'll get back to you soon!",
      id: result.data?.[0]?.id,
    })
  } catch (error: any) {
    console.error("[CONTACT] Failed to submit message:", error)
    return NextResponse.json(
      { error: "Failed to submit message. Please try again later." },
      { status: 500 }
    )
  }
}

