import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { getRecommendedActions } from '@/lib/intel/recommendations'
import { severityFromRiskScore } from '@/lib/intel/risk-scoring'
import { generateIntelReport } from '@/lib/intel/report-generator'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = req.headers.get('x-cron-secret')

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const isAuthorized = authHeader === `Bearer ${CRON_SECRET}` || cronSecret === CRON_SECRET
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemsResult = await pool.query(
      `SELECT mi.*, u.email as user_email, u.username
       FROM monitored_items mi
       JOIN users u ON mi.user_id = u.id
       WHERE mi.is_verified = true
       AND mi.is_active = true
       AND u.is_active = true
       AND u.role != 'admin'
       ORDER BY mi.last_checked ASC NULLS FIRST
       LIMIT 100`
    )

    if (itemsResult.rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to check', processed: 0 })
    }

    let processed = 0
    let alertsCreated = 0
    let casesCreated = 0
    let reportsCreated = 0
    const results: any[] = []

    for (const item of itemsResult.rows) {
      try {
        const searchResult = await pool.query(
          `SELECT COUNT(*) as count FROM search_index_lines WHERE content ILIKE $1 LIMIT 1`,
          [`%${item.item_value}%`]
        )

        const matchCount = parseInt(searchResult.rows[0]?.count || '0')
        const found = matchCount > 0

        await pool.query(
          `UPDATE monitored_items SET last_checked = NOW(), updated_at = NOW() WHERE id = $1`,
          [item.id]
        )

        if (found) {
          const intelResult = await pool.query(
            `SELECT e.id AS entity_id, e.risk_score AS entity_risk_score, e.confidence AS entity_confidence,
                    f.id AS finding_id, f.title, f.description, f.risk_score, f.confidence,
                    f.severity, f.recommended_actions, f.evidence, f.source_name, f.first_seen, f.last_seen
             FROM intel_entities e
             LEFT JOIN intel_relationships r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
             LEFT JOIN intel_findings f ON f.id = r.finding_id
             WHERE e.entity_type = $1 AND e.normalized_value = $2
             ORDER BY f.risk_score DESC NULLS LAST, f.last_seen DESC NULLS LAST
             LIMIT 5`,
            [item.item_type, item.item_value]
          )

          const detailsResult = await pool.query(
            `SELECT id, file_path, file_name, file_type, country, content, line_number
             FROM search_index_lines
             WHERE content ILIKE $1
             LIMIT 5`,
            [`%${item.item_value}%`]
          )

          await pool.query(
            `UPDATE monitored_items
             SET found_count = found_count + 1, last_found = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [item.id]
          )

          const existingAlert = await pool.query(
            `SELECT id FROM monitoring_alerts
             WHERE monitored_item_id = $1
             AND created_at > NOW() - INTERVAL '24 hours'`,
            [item.id]
          )

          if (existingAlert.rows.length === 0) {
            const bestIntel = intelResult.rows[0]
            const riskScore = Number(bestIntel?.risk_score || bestIntel?.entity_risk_score || (matchCount > 10 ? 90 : matchCount > 5 ? 72 : matchCount > 2 ? 50 : 25))
            const severity = bestIntel?.severity || severityFromRiskScore(riskScore)
            const recommendedActions = bestIntel?.recommended_actions || getRecommendedActions({
              findingType: bestIntel?.finding_type || 'indexed_exposure',
              severity,
              entityType: item.item_type,
              value: item.item_value,
            })
            const alertType = item.item_type === 'email' ? 'email_found' : item.item_type === 'domain' ? 'domain_found' : 'watchlist_match'
            const title = bestIntel?.title || `${item.item_type.toUpperCase()} Watchlist Match Detected`
            const description = bestIntel?.description || `Your monitored ${item.item_type} "${item.item_value}" was found in ${matchCount} location(s) in indexed intelligence data.`

            const alertInsert = await pool.query(
              `INSERT INTO monitoring_alerts
               (user_id, monitored_item_id, intel_finding_id, intel_entity_id, alert_type, severity, risk_score, confidence,
                title, description, source_info, evidence_preview, recommended_actions, source_count, first_seen, last_seen)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15, $16)
               RETURNING id`,
              [
                item.user_id,
                item.id,
                bestIntel?.finding_id || null,
                bestIntel?.entity_id || null,
                alertType,
                severity,
                riskScore,
                Number(bestIntel?.confidence || bestIntel?.entity_confidence || 60),
                title,
                description,
                JSON.stringify({
                  matchCount,
                  checkedAt: new Date().toISOString(),
                  sampleSources: detailsResult.rows.slice(0, 3).map(r => ({
                    file: r.file_name,
                    type: r.file_type,
                    country: r.country,
                    lineNumber: r.line_number,
                  })),
                }),
                detailsResult.rows[0]?.content?.slice(0, 500) || null,
                JSON.stringify(recommendedActions),
                matchCount,
                bestIntel?.first_seen || null,
                bestIntel?.last_seen || null,
              ]
            )

            alertsCreated++
            const alertId = alertInsert.rows?.[0]?.id || null

            const shouldOpenCase = riskScore >= 80 || severity === 'critical' || matchCount >= 10
            if (shouldOpenCase) {
              const caseTitle = `${item.item_type.toUpperCase()} Match: ${item.item_value}`
              const caseExists = await pool.query(
                `SELECT id FROM intel_cases
                 WHERE user_id = $1
                 AND title = $2
                 AND created_at > NOW() - INTERVAL '24 hours'
                 LIMIT 1`,
                [item.user_id, caseTitle]
              )

              if (caseExists.rows.length === 0) {
                const caseSummary = `Autogenerated from monitoring cron. ${title}. ${description}`
                const caseRecommendations = Array.isArray(recommendedActions) ? recommendedActions : []
                const caseResult = await pool.query(
                  `INSERT INTO intel_cases (user_id, title, status, severity, summary, recommendations, timeline)
                   VALUES ($1, $2, 'open', $3, $4, $5::jsonb, $6::jsonb)
                   RETURNING *`,
                  [
                    item.user_id,
                    caseTitle,
                    severity,
                    caseSummary,
                    JSON.stringify(caseRecommendations),
                    JSON.stringify([{ at: new Date().toISOString(), event: 'Auto-created from monitoring alert', by: 'system' }]),
                  ]
                )

                const caseRecord = caseResult.rows?.[0]
                if (caseRecord) {
                  await pool.query(
                    `INSERT INTO intel_case_items (case_id, entity_id, finding_id, alert_id, note)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [caseRecord.id, bestIntel?.entity_id || null, bestIntel?.finding_id || null, alertId, 'Auto-linked from monitoring match']
                  )
                  casesCreated++
                }
              }
            }

            const shouldAutoReport = riskScore >= 70 || matchCount >= 5
            if (shouldAutoReport) {
              const reportTitle = `Auto Intel Report: ${item.item_type.toUpperCase()} ${item.item_value}`
              const reportExists = await pool.query(
                `SELECT id FROM intel_reports
                 WHERE user_id = $1
                 AND title = $2
                 AND created_at > NOW() - INTERVAL '24 hours'
                 LIMIT 1`,
                [item.user_id, reportTitle]
              )

              if (reportExists.rows.length === 0) {
                const reportBody = generateIntelReport({
                  reportType: 'monitoring_match',
                  title: reportTitle,
                  entity: bestIntel?.entity_id ? {
                    id: bestIntel.entity_id,
                    entity_type: item.item_type,
                    value: item.item_value,
                    risk_score: riskScore,
                  } : null,
                  caseRecord: null,
                  findings: bestIntel ? [bestIntel] : [],
                })

                await pool.query(
                  `INSERT INTO intel_reports (user_id, case_id, entity_id, report_type, title, body, html)
                   VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                   RETURNING id`,
                  [item.user_id, null, bestIntel?.entity_id || null, 'monitoring_match', reportTitle, JSON.stringify(reportBody), null]
                )
                reportsCreated++
              }
            }

            try {
              const smtpResult = await pool.query('SELECT * FROM smtp_settings LIMIT 1')
              const smtp = smtpResult.rows[0]
              if (smtp && item.user_email) {
                const nodemailer = require('nodemailer')
                const transporter = nodemailer.createTransport({
                  host: smtp.host,
                  port: smtp.port,
                  secure: smtp.secure,
                  auth: { user: smtp.username, pass: smtp.password },
                })

                await transporter.sendMail({
                  from: smtp.from_email,
                  to: item.user_email,
                  subject: `🚨 Intel Forge Alert: Your ${item.item_type} was found in a breach`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #ef4444;">⚠️ Breach Alert</h2>
                      <p>Hello ${item.username || 'User'},</p>
                      <p>We detected your monitored ${item.item_type} in our breach database:</p>
                      <div style="background: #1a1a1a; color: #fff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 18px; font-weight: bold;">${item.item_value}</p>
                        <p style="margin: 10px 0 0 0; color: #ef4444;">Found in ${matchCount} location(s)</p>
                      </div>
                      <p>We recommend:</p>
                      <ul>
                        <li>Change your passwords immediately</li>
                        <li>Enable two-factor authentication where possible</li>
                        <li>Monitor your accounts for suspicious activity</li>
                      </ul>
                    </div>
                  `,
                })
              }
            } catch (emailError) {
              console.error('Failed to send alert email:', emailError)
            }
          }
        }

        results.push({ item: item.item_value, type: item.item_type, found, matchCount })
        processed++
      } catch (itemError) {
        console.error(`Error processing item ${item.id}:`, itemError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} items`,
      processed,
      alertsCreated,
      casesCreated,
      reportsCreated,
      results,
    })
  } catch (error) {
    console.error('Error in monitoring cron job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM monitored_items WHERE is_verified = true AND is_active = true) as active_items,
        (SELECT COUNT(*) FROM monitoring_alerts WHERE created_at > NOW() - INTERVAL '24 hours') as alerts_24h,
        (SELECT COUNT(*) FROM monitored_items WHERE last_checked IS NULL OR last_checked < NOW() - INTERVAL '1 hour') as pending_checks
    `)

    return NextResponse.json({ success: true, stats: stats.rows[0] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
