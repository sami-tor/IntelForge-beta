import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Get current user from session
async function getCurrentUser(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session_token')?.value

  if (!sessionToken) {
    return null
  }

  const result = await pool.query(
    `SELECT u.* FROM users u 
     JOIN sessions s ON u.id = s.user_id 
     WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
    [sessionToken]
  )

  return result.rows[0] || null
}

// POST - Manually trigger check for user's monitored items
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Monitoring not available for admin accounts' }, { status: 403 })
    }

    // Get user's verified monitored items
    const itemsResult = await pool.query(
      `SELECT * FROM monitored_items 
       WHERE user_id = $1 AND is_verified = true AND is_active = true`,
      [user.id]
    )

    if (itemsResult.rows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No verified items to check',
        results: []
      })
    }

    const results = []
    const newAlerts = []

    for (const item of itemsResult.rows) {
      let found = false
      let foundResults: any[] = []

      // Search in the database for the item
      if (item.item_type === 'email') {
        // Search for email in search_index_lines
        const searchResult = await pool.query(
          `SELECT file_path, file_name, line_number, content, file_type, country
           FROM search_index_lines 
           WHERE content ILIKE $1
           LIMIT 10`,
          [`%${item.item_value}%`]
        )

        if (searchResult.rows.length > 0) {
          found = true
          foundResults = searchResult.rows
        }
      } else if (item.item_type === 'domain') {
        // Search for domain in search_index_lines
        const searchResult = await pool.query(
          `SELECT file_path, file_name, line_number, content, file_type, country
           FROM search_index_lines 
           WHERE content ILIKE $1
           LIMIT 10`,
          [`%${item.item_value}%`]
        )

        if (searchResult.rows.length > 0) {
          found = true
          foundResults = searchResult.rows
        }
      }

      // Update last_checked
      await pool.query(
        `UPDATE monitored_items SET last_checked = NOW(), updated_at = NOW() WHERE id = $1`,
        [item.id]
      )

      if (found) {
        // Update found_count and last_found
        await pool.query(
          `UPDATE monitored_items 
           SET found_count = found_count + 1, last_found = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [item.id]
        )

        // Check if alert already exists for this item today
        const existingAlert = await pool.query(
          `SELECT id FROM monitoring_alerts 
           WHERE monitored_item_id = $1 
           AND created_at > NOW() - INTERVAL '24 hours'`,
          [item.id]
        )

        // Only create new alert if none exists in the last 24 hours
        if (existingAlert.rows.length === 0) {
          const alertType = item.item_type === 'email' ? 'email_found' : 'domain_found'
          const severity = foundResults.length > 5 ? 'high' : foundResults.length > 2 ? 'medium' : 'low'

          const alertResult = await pool.query(
            `INSERT INTO monitoring_alerts 
             (user_id, monitored_item_id, alert_type, severity, title, description, source_info)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              user.id,
              item.id,
              alertType,
              severity,
              `${item.item_type === 'email' ? 'Email' : 'Domain'} Found in Database`,
              `Your monitored ${item.item_type} "${item.item_value}" was found in ${foundResults.length} location(s) in our breach database.`,
              JSON.stringify({
                matchCount: foundResults.length,
                sampleSources: foundResults.slice(0, 3).map(r => ({
                  file: r.file_name,
                  type: r.file_type,
                  country: r.country
                }))
              })
            ]
          )

          newAlerts.push(alertResult.rows[0])
        }

        results.push({
          item: item.item_value,
          type: item.item_type,
          found: true,
          matchCount: foundResults.length,
          samples: foundResults.slice(0, 3)
        })
      } else {
        results.push({
          item: item.item_value,
          type: item.item_type,
          found: false,
          matchCount: 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${itemsResult.rows.length} items`,
      results,
      newAlerts: newAlerts.length,
      alertsCreated: newAlerts
    })
  } catch (error) {
    console.error('Error checking monitored items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

