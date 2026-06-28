import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAdmin } from "@/lib/middleware"

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request)
  if (adminCheck) return adminCheck

  try {
    const result = await query("SELECT * FROM search_directories ORDER BY created_at DESC")
    if (!result.success) {
      throw new Error(result.error || "Query failed")
    }

    return NextResponse.json({
      directories: result.data || [],
    })
  } catch (error: any) {
    console.error("[v0] Get directories error:", error)
    return NextResponse.json({ error: "Failed to fetch directories" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request)
  if (adminCheck) return adminCheck

  try {
    const { path, name } = await request.json()

    if (!path || !name) {
      return NextResponse.json({ error: "Path and name are required" }, { status: 400 })
    }

    const result = await query(
      "INSERT INTO search_directories (path, name, is_active) VALUES ($1, $2, true) RETURNING *",
      [path, name],
    )

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error(result.error || "Insert failed")
    }

    return NextResponse.json({
      success: true,
      directory: result.data[0],
    })
  } catch (error: any) {
    console.error("[v0] Add directory error:", error)
    return NextResponse.json({ error: "Failed to add directory" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const adminCheck = await verifyAdmin(request)
  if (adminCheck) return adminCheck

  try {
    const { id, is_active } = await request.json()
    
    // SECURITY: Validate id is a number
    const directoryId = parseInt(id)
    if (!directoryId || isNaN(directoryId)) {
      return NextResponse.json({ error: "Invalid directory ID" }, { status: 400 })
    }
    
    // SECURITY: Validate is_active is boolean
    if (typeof is_active !== "boolean") {
      return NextResponse.json({ error: "Invalid is_active value" }, { status: 400 })
    }

    await query("UPDATE search_directories SET is_active = $1 WHERE id = $2", [is_active, directoryId])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Update directory error:", error)
    return NextResponse.json({ error: "Failed to update directory" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const adminCheck = await verifyAdmin(request)
  if (adminCheck) return adminCheck

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }
    
    // SECURITY: Validate id is a number
    const directoryId = parseInt(id)
    if (!directoryId || isNaN(directoryId)) {
      return NextResponse.json({ error: "Invalid directory ID" }, { status: 400 })
    }

    await query("DELETE FROM search_directories WHERE id = $1", [directoryId])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete directory error:", error)
    return NextResponse.json({ error: "Failed to delete directory" }, { status: 500 })
  }
}
