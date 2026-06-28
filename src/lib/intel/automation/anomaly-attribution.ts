// ================================================
// IntelForge Automation - Anomaly Attribution
// ------------------------------------------------
// When an anomaly fires, scan the underlying source
// table for the same window and attach the top
// contributing rows so the dashboard can answer
// "what's driving this spike?"
// ================================================
import { query } from "@/lib/db"

interface ContributorRow {
  reference: string
  label: string
  detail?: string
}

const ATTRIBUTION_QUERIES: Record<
  string,
  { sql: string; params?: (date: string) => unknown[] }
> = {
  cve_critical_24h: {
    sql: `SELECT cve_id AS reference,
                 cve_id AS label,
                 LEFT(description, 140) AS detail
          FROM intel_cve_cache
          WHERE cvss_v3_severity = 'CRITICAL'
            AND DATE(published_at) = $1::date
          ORDER BY cvss_v3_score DESC NULLS LAST
          LIMIT 5`,
  },
  exploits_24h: {
    sql: `SELECT exploit_id AS reference,
                 COALESCE(title, exploit_id) AS label,
                 cve_id AS detail
          FROM intel_exploit_cache
          WHERE DATE(published_at) = $1::date
          ORDER BY published_at DESC
          LIMIT 5`,
  },
  ransomware_victims_7d: {
    sql: `SELECT victim_name AS reference,
                 victim_name AS label,
                 group_name AS detail
          FROM intel_ransomware_victims
          WHERE discovered_at BETWEEN ($1::date - INTERVAL '7 days') AND $1::date
          ORDER BY discovered_at DESC
          LIMIT 5`,
  },
  malware_24h: {
    sql: `SELECT COALESCE(sha256, sha1, md5, file_name) AS reference,
                 COALESCE(file_name, sha256) AS label,
                 array_to_string(malware_family, ',') AS detail
          FROM intel_malware_cache
          WHERE DATE(first_seen) = $1::date
          ORDER BY first_seen DESC
          LIMIT 5`,
  },
  darknet_posts_24h: {
    sql: `SELECT post_uid AS reference,
                 COALESCE(title, victim_name, threat_actor) AS label,
                 source AS detail
          FROM intel_darknet_posts
          WHERE DATE(discovered_at) = $1::date
          ORDER BY discovered_at DESC
          LIMIT 5`,
  },
}


/**
 * Look up the contributing rows for one anomaly and persist
 * them into the `caused_by` JSON column on intel_anomalies.
 */
export async function attributeAnomaly(
  metricKey: string,
  bucketDate: string,
): Promise<ContributorRow[]> {
  const def = ATTRIBUTION_QUERIES[metricKey]
  if (!def) return []
  try {
    const r = await query(def.sql, [bucketDate])
    if (!r.success || !r.data) return []
    const rows: ContributorRow[] = (r.data as Array<Record<string, unknown>>)
      .map((row) => ({
        reference: String(row.reference || ""),
        label: String(row.label || row.reference || "").slice(0, 200),
        detail: row.detail ? String(row.detail).slice(0, 200) : undefined,
      }))
      .filter((row) => row.reference.length > 0)

    if (rows.length > 0) {
      await query(
        `UPDATE intel_anomalies
         SET caused_by = $1::jsonb
         WHERE metric_key = $2 AND bucket_date = $3::date`,
        [JSON.stringify(rows), metricKey, bucketDate],
      )
    }
    return rows
  } catch {
    return []
  }
}

/**
 * Attribute every anomaly without a populated `caused_by` array.
 * Called from the orchestrator after the forecast stage.
 */
export async function attributeRecentAnomalies(): Promise<number> {
  const r = await query(
    `SELECT metric_key, bucket_date
     FROM intel_anomalies
     WHERE caused_by = '[]'::jsonb
       AND detected_at > NOW() - INTERVAL '14 days'
     ORDER BY detected_at DESC
     LIMIT 50`,
    [],
  )
  if (!r.success || !r.data) return 0
  let attributed = 0
  for (const row of r.data as Array<Record<string, unknown>>) {
    const dateStr = (row.bucket_date as Date).toISOString().slice(0, 10)
    const found = await attributeAnomaly(String(row.metric_key), dateStr)
    if (found.length > 0) attributed++
  }
  return attributed
}
