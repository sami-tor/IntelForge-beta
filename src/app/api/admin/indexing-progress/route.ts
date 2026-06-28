import { NextRequest, NextResponse } from "next/server"
import { query as dbQuery } from "@/lib/db"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"

export async function GET(request: NextRequest) {
  // Only admins can check indexing progress
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
  }

  try {
    // Get indexing statistics
    const stats = await dbQuery(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        SUM(line_count) as total_lines,
        MAX(indexed_at) as last_indexed
      FROM search_index
    `, [])

    const lineStats = await dbQuery(`
      SELECT 
        COUNT(*) as total_indexed_lines,
        COUNT(DISTINCT file_path) as unique_files,
        COUNT(DISTINCT country) as unique_countries
      FROM search_index_lines
    `, [])

    const recentFiles = await dbQuery(`
      SELECT 
        file_name,
        file_path,
        file_size,
        line_count,
        indexed_at
      FROM search_index
      ORDER BY indexed_at DESC
      LIMIT 10
    `, [])

    return NextResponse.json({
      success: true,
      stats: stats.success ? stats.data?.[0] : null,
      lineStats: lineStats.success ? lineStats.data?.[0] : null,
      recentFiles: recentFiles.success ? recentFiles.data : [],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}


