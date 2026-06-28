import { type NextRequest, NextResponse } from "next/server"
import { getClearTokenCookies } from "@/lib/jwt"

export async function POST(request: NextRequest) {
  try {
    // Create response with success message
    const response = NextResponse.json({ 
      success: true,
      message: "Logged out successfully" 
    })

    // Clear JWT cookies
    const clearCookies = getClearTokenCookies()
    clearCookies.forEach(cookie => {
      response.headers.append("Set-Cookie", cookie)
    })

    return response
  } catch (error) {
    console.error("[LOGOUT] Error:", error)
    return NextResponse.json({ error: "Logout failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
