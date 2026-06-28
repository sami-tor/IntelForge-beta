import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Pool } from 'pg'
import crypto from 'crypto'
import { normalizeEntityValue, type EntityType } from '@/lib/intel/entity-extractor'

const WATCHLIST_TYPES: EntityType[] = ['email', 'domain', 'ip', 'url', 'keyword', 'brand', 'phone', 'username', 'crypto_wallet']

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

// GET - Fetch user's monitored items and alerts
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Don't allow admin to use monitoring (as per requirement)
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Monitoring not available for admin accounts' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'items', 'alerts', or 'all'

    if (type === 'alerts') {
      // Get alerts for user
      const alertsResult = await pool.query(
        `SELECT ma.*, mi.item_type, mi.item_value 
         FROM monitoring_alerts ma
         JOIN monitored_items mi ON ma.monitored_item_id = mi.id
         WHERE ma.user_id = $1 AND ma.is_dismissed = false
         ORDER BY ma.created_at DESC
         LIMIT 50`,
        [user.id]
      )
      return NextResponse.json({ alerts: alertsResult.rows })
    }

    if (type === 'items') {
      // Get monitored items
      const itemsResult = await pool.query(
        `SELECT * FROM monitored_items 
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [user.id]
      )
      return NextResponse.json({ items: itemsResult.rows })
    }

    // Get both items and alerts (default)
    const [itemsResult, alertsResult, unreadCountResult] = await Promise.all([
      pool.query(
        `SELECT * FROM monitored_items 
         WHERE user_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [user.id]
      ),
      pool.query(
        `SELECT ma.*, mi.item_type, mi.item_value 
         FROM monitoring_alerts ma
         JOIN monitored_items mi ON ma.monitored_item_id = mi.id
         WHERE ma.user_id = $1 AND ma.is_dismissed = false
         ORDER BY ma.created_at DESC
         LIMIT 20`,
        [user.id]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM monitoring_alerts 
         WHERE user_id = $1 AND is_read = false AND is_dismissed = false`,
        [user.id]
      )
    ])

    return NextResponse.json({
      items: itemsResult.rows,
      alerts: alertsResult.rows,
      unreadCount: parseInt(unreadCountResult.rows[0]?.count || '0')
    })
  } catch (error) {
    console.error('Error fetching monitoring data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add new item to monitor (email or domain)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Monitoring not available for admin accounts' }, { status: 403 })
    }

    const body = await req.json()
    const { itemType, itemValue } = body

    if (!itemType || !itemValue) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!WATCHLIST_TYPES.includes(itemType)) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    const normalizedItemValue = normalizeEntityValue(itemType, itemValue)

    // Validate email format
    if (itemType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(itemValue)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    // Validate domain format
    if (itemType === 'domain') {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,})+$/
      if (!domainRegex.test(itemValue)) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
      }
    }

    // Check if item already exists for this user
    const existingItem = await pool.query(
      `SELECT * FROM monitored_items 
       WHERE user_id = $1 AND item_type = $2 AND item_value = $3`,
      [user.id, itemType, normalizedItemValue]
    )

    if (existingItem.rows.length > 0) {
      const item = existingItem.rows[0]
      if (item.is_verified) {
        return NextResponse.json({ error: 'This item is already being monitored' }, { status: 409 })
      }
      // Item exists but not verified, update verification code
      const verificationCode = crypto.randomBytes(32).toString('hex').substring(0, 8).toUpperCase()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await pool.query(
        `UPDATE monitored_items 
         SET verification_code = $1, verification_expires = $2, updated_at = NOW()
         WHERE id = $3`,
        [verificationCode, expiresAt, item.id]
      )

      return NextResponse.json({
        success: true,
        message: 'Verification code regenerated',
        itemId: item.id,
        verificationCode: itemType === 'domain' ? verificationCode : undefined,
        verificationMethod: itemType === 'email' ? 'email_code' : 'file_verification'
      })
    }

    // Check max items limit per entity type
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM monitored_items
       WHERE user_id = $1 AND item_type = $2 AND is_active = true`,
      [user.id, itemType]
    )

    if (parseInt(countResult.rows[0].count) >= 25) {
      return NextResponse.json({
        error: `Maximum ${itemType} limit reached (25). Please remove an existing item first.`
      }, { status: 400 })
    }

    // Generate verification code
    const verificationCode = crypto.randomBytes(32).toString('hex').substring(0, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const requiresVerification = itemType === 'email' || itemType === 'domain'

    // Insert new monitored item
    const insertResult = await pool.query(
      `INSERT INTO monitored_items (user_id, item_type, item_value, verification_code, verification_expires, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.id, itemType, normalizedItemValue, requiresVerification ? verificationCode : null, requiresVerification ? expiresAt : null, !requiresVerification]
    )

    const itemId = insertResult.rows[0].id

    if (!requiresVerification) {
      return NextResponse.json({
        success: true,
        message: `${itemType} added to monitoring`,
        itemId,
        verificationMethod: 'none'
      })
    }

    // For email: Send verification email
    if (itemType === 'email') {
      try {
        // Get SMTP settings
        const smtpResult = await pool.query('SELECT * FROM smtp_settings LIMIT 1')
        const smtp = smtpResult.rows[0]

        if (smtp) {
          const nodemailer = require('nodemailer')
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
              user: smtp.username,
              pass: smtp.password
            }
          })

          await transporter.sendMail({
            from: smtp.from_email,
            to: itemValue,
            subject: 'Intel Forge - Verify Your Email for Monitoring',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Intel Forge - Email Verification</h2>
                <p>You've requested to add this email to your monitoring list.</p>
                <p>Your verification code is:</p>
                <div style="background: #1a1a1a; color: #ef4444; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 20px 0;">
                  ${verificationCode}
                </div>
                <p>Enter this code in the Intel Forge dashboard to complete verification.</p>
                <p style="color: #666; font-size: 12px;">This code expires in 24 hours.</p>
                <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
              </div>
            `
          })
        }
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Don't fail the request, user can request a new code
      }

      return NextResponse.json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
        itemId,
        verificationMethod: 'email_code'
      })
    }

    // For domain: Return verification code for file verification
    return NextResponse.json({
      success: true,
      message: 'Please create a verification file on your domain',
      itemId,
      verificationCode,
      verificationMethod: 'file_verification',
      instructions: `Create a file at: ${itemValue}/intelforge-verify.txt containing: ${verificationCode}`
    })
  } catch (error) {
    console.error('Error adding monitored item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Verify item or mark alert as read
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, itemId, alertId, verificationCode } = body

    if (action === 'verify') {
      // Verify monitored item
      if (!itemId || !verificationCode) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const itemResult = await pool.query(
        `SELECT * FROM monitored_items WHERE id = $1 AND user_id = $2`,
        [itemId, user.id]
      )

      if (itemResult.rows.length === 0) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }

      const item = itemResult.rows[0]

      if (item.is_verified) {
        return NextResponse.json({ error: 'Item already verified' }, { status: 400 })
      }

      if (new Date(item.verification_expires) < new Date()) {
        return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 400 })
      }

      // For email: Check code directly
      if (item.item_type === 'email') {
        if (item.verification_code !== verificationCode.toUpperCase()) {
          return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
        }
      }

      // For domain: Check file on domain
      if (item.item_type === 'domain') {
        try {
          const verifyUrl = `https://${item.item_value}/intelforge-verify.txt`
          const response = await fetch(verifyUrl, { 
            method: 'GET',
            headers: { 'User-Agent': 'IntelForge-Verifier/1.0' }
          })

          if (!response.ok) {
            // Try http if https fails
            const httpResponse = await fetch(`http://${item.item_value}/intelforge-verify.txt`, {
              method: 'GET',
              headers: { 'User-Agent': 'IntelForge-Verifier/1.0' }
            })

            if (!httpResponse.ok) {
              return NextResponse.json({ 
                error: 'Could not access verification file. Make sure the file exists at your domain root.' 
              }, { status: 400 })
            }

            const content = await httpResponse.text()
            if (content.trim().toUpperCase() !== item.verification_code) {
              return NextResponse.json({ error: 'Verification code in file does not match' }, { status: 400 })
            }
          } else {
            const content = await response.text()
            if (content.trim().toUpperCase() !== item.verification_code) {
              return NextResponse.json({ error: 'Verification code in file does not match' }, { status: 400 })
            }
          }
        } catch (fetchError) {
          return NextResponse.json({ 
            error: 'Could not reach your domain. Please ensure the verification file is accessible.' 
          }, { status: 400 })
        }
      }

      // Mark as verified
      await pool.query(
        `UPDATE monitored_items 
         SET is_verified = true, verification_code = NULL, verification_expires = NULL, updated_at = NOW()
         WHERE id = $1`,
        [itemId]
      )

      return NextResponse.json({ success: true, message: 'Item verified successfully!' })
    }

    if (action === 'mark_read') {
      if (!alertId) {
        return NextResponse.json({ error: 'Missing alert ID' }, { status: 400 })
      }

      await pool.query(
        `UPDATE monitoring_alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
        [alertId, user.id]
      )

      return NextResponse.json({ success: true })
    }

    if (action === 'mark_all_read') {
      await pool.query(
        `UPDATE monitoring_alerts SET is_read = true WHERE user_id = $1`,
        [user.id]
      )

      return NextResponse.json({ success: true })
    }

    if (action === 'dismiss') {
      if (!alertId) {
        return NextResponse.json({ error: 'Missing alert ID' }, { status: 400 })
      }

      await pool.query(
        `UPDATE monitoring_alerts SET is_dismissed = true WHERE id = $1 AND user_id = $2`,
        [alertId, user.id]
      )

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in PUT monitoring:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove monitored item
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('id')

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 })
    }

    // Soft delete - mark as inactive
    const result = await pool.query(
      `UPDATE monitored_items SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [itemId, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Item removed from monitoring' })
  } catch (error) {
    console.error('Error deleting monitored item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

