import { NextRequest, NextResponse } from "next/server"
import { query as dbQuery } from "@/lib/db"
import { requireAuth } from "@/lib/middleware"

// SECURITY: Cache-Control headers to prevent caching of sensitive quota data
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY FIX: Always authenticate and fetch user data from database
    // NEVER trust client-submitted headers like X-User-Type or X-User-ID
    const authResult = await requireAuth(request)
    
    if (!authResult.authorized) {
      // Anonymous users get free tier limits
      return NextResponse.json({
        searches_used: 0,
        searches_limit: 50,
        searches_remaining: 50,
        results_used: 0,
        results_limit: 50,
        results_remaining: 50,
        userType: "free"
      }, { headers: NO_CACHE_HEADERS })
    }

    const userId = authResult.user.user_id
    
    // SECURITY: Fetch user subscription from database, not from headers
    const userResult = await dbQuery(
      `SELECT 
        subscription_type,
        is_lifetime,
        search_limit,
        role
      FROM users 
      WHERE id = $1`,
      [userId]
    )

    if (!userResult.success || !userResult.data || userResult.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_CACHE_HEADERS })
    }

    const user = userResult.data[0]
    
    // Determine user type from database, not client headers
    const isPremium = user.is_lifetime || 
                     (user.subscription_type && 
                      ["starter", "professional", "enterprise", "api_access"].includes(user.subscription_type.toLowerCase())) ||
                     user.role === "admin"
    
    const userType = isPremium ? "premium" : "free"
    
    // Get current month quota usage
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const quotaResult = await dbQuery(
      `SELECT 
        COALESCE(SUM(CASE WHEN search_date >= $1 THEN search_count ELSE 0 END), 0) as searches_used,
        COALESCE(SUM(CASE WHEN search_date >= $1 THEN result_count ELSE 0 END), 0) as results_used
       FROM user_monthly_quota
       WHERE user_id = $2`,
      [monthStart, userId]
    )

    const quota = quotaResult.data?.[0] || { searches_used: 0, results_used: 0 }
    
    // SECURITY: Use database values for limits, not client-submitted values
    const searchLimit = user.search_limit || (isPremium ? 1500 : 50)
    const resultLimit = isPremium ? 10000 : 50
    
    return NextResponse.json({
      searches_used: parseInt(quota.searches_used) || 0,
      searches_limit: searchLimit,
      searches_remaining: Math.max(0, searchLimit - (parseInt(quota.searches_used) || 0)),
      results_used: parseInt(quota.results_used) || 0,
      results_limit: resultLimit,
      results_remaining: Math.max(0, resultLimit - (parseInt(quota.results_used) || 0)),
      userType, // Determined from database
      monthStart: monthStart.toISOString()
    }, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    console.error("[Quota API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch quota", searches_used: 0, searches_remaining: 50 },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
