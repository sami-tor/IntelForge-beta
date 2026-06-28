import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Pool } from 'pg'
import crypto from 'crypto'

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

// POST - Resend verification code
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json({ error: 'Missing item ID' }, { status: 400 })
    }

    // Get the item
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

    // Generate new verification code
    const verificationCode = crypto.randomBytes(32).toString('hex').substring(0, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update verification code
    await pool.query(
      `UPDATE monitored_items 
       SET verification_code = $1, verification_expires = $2, updated_at = NOW()
       WHERE id = $3`,
      [verificationCode, expiresAt, itemId]
    )

    // For email: Send verification email
    if (item.item_type === 'email') {
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
            to: item.item_value,
            subject: 'Intel Forge - New Verification Code',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Intel Forge - Email Verification</h2>
                <p>Here's your new verification code for email monitoring.</p>
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
      }

      return NextResponse.json({
        success: true,
        message: 'New verification code sent to your email',
        verificationMethod: 'email_code'
      })
    }

    // For domain: Return new verification code
    return NextResponse.json({
      success: true,
      message: 'New verification code generated',
      verificationCode,
      verificationMethod: 'file_verification',
      instructions: `Update the file at: ${item.item_value}/intelforge-verify.txt with: ${verificationCode}`
    })
  } catch (error) {
    console.error('Error resending verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

