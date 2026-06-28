import { query } from "./db"

export interface TenantBranding {
  id: number
  organization_id: number | null
  user_id: number | null
  company_name: string | null
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  custom_css: string | null
  hide_intelforge_branding: boolean
  hide_powered_by: boolean
  custom_domain: string | null
  domain_verified: boolean
  login_title: string | null
  login_subtitle: string | null
  login_bg_url: string | null
  email_from_name: string | null
  email_footer_text: string | null
  is_reseller: boolean
  reseller_commission_percent: number
}

let cachedBranding: Map<string, TenantBranding | null> = new Map()

export function clearBrandingCache() {
  cachedBranding.clear()
}

export async function getBrandingByDomain(hostname: string): Promise<TenantBranding | null> {
  if (cachedBranding.has(hostname)) {
    return cachedBranding.get(hostname)!
  }

  // Try custom domain
  const result = await query(
    `SELECT * FROM tenant_branding WHERE custom_domain = $1 AND domain_verified = true LIMIT 1`,
    [hostname]
  )

  const branding = result.data?.[0] || null
  cachedBranding.set(hostname, branding)
  return branding
}

export async function getBrandingByOrgId(orgId: number): Promise<TenantBranding | null> {
  const result = await query(
    `SELECT * FROM tenant_branding WHERE organization_id = $1 LIMIT 1`,
    [orgId]
  )
  return result.data?.[0] || null
}

export async function getBrandingByUserId(userId: number): Promise<TenantBranding | null> {
  const result = await query(
    `SELECT * FROM tenant_branding WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  return result.data?.[0] || null
}

export async function upsertBranding(
  branding: Partial<TenantBranding> & { organization_id?: number; user_id?: number }
): Promise<TenantBranding | null> {
  const existing = branding.organization_id
    ? await getBrandingByOrgId(branding.organization_id)
    : branding.user_id
      ? await getBrandingByUserId(branding.user_id)
      : null

  if (existing) {
    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    const allowed = [
      "company_name", "logo_url", "favicon_url", "primary_color", "secondary_color",
      "accent_color", "custom_css", "hide_intelforge_branding", "hide_powered_by",
      "custom_domain", "login_title", "login_subtitle", "login_bg_url",
      "email_from_name", "email_footer_text",
    ]

    for (const key of allowed) {
      if (key in branding) {
        fields.push(`${key} = $${idx++}`)
        values.push((branding as any)[key])
      }
    }

    if (!fields.length) return existing

    fields.push(`updated_at = NOW()`)
    values.push(existing.id)

    const result = await query(
      `UPDATE tenant_branding SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    )

    clearBrandingCache()
    return result.data?.[0] || null
  }

  // Insert new
  const result = await query(
    `INSERT INTO tenant_branding (organization_id, user_id, company_name, logo_url, favicon_url,
      primary_color, secondary_color, accent_color, custom_css, hide_intelforge_branding,
      hide_powered_by, custom_domain, login_title, login_subtitle, login_bg_url,
      email_from_name, email_footer_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      branding.organization_id || null,
      branding.user_id || null,
      branding.company_name || null,
      branding.logo_url || null,
      branding.favicon_url || null,
      branding.primary_color || "#DC2626",
      branding.secondary_color || "#1F2937",
      branding.accent_color || "#3B82F6",
      branding.custom_css || null,
      branding.hide_intelforge_branding || false,
      branding.hide_powered_by || false,
      branding.custom_domain || null,
      branding.login_title || null,
      branding.login_subtitle || null,
      branding.login_bg_url || null,
      branding.email_from_name || null,
      branding.email_footer_text || null,
    ]
  )

  clearBrandingCache()
  return result.data?.[0] || null
}

export async function verifyDomain(brandingId: number, token: string): Promise<boolean> {
  const result = await query(
    `SELECT * FROM tenant_branding WHERE id = $1 AND domain_verification_token = $2`,
    [brandingId, token]
  )
  if (!result.data?.length) return false

  await query(
    `UPDATE tenant_branding SET domain_verified = true, domain_verification_token = NULL WHERE id = $1`,
    [brandingId]
  )
  clearBrandingCache()
  return true
}

export async function requestDomainVerification(brandingId: number, domain: string): Promise<string | null> {
  const token = `dv_${crypto.randomUUID()}`
  await query(
    `UPDATE tenant_branding SET custom_domain = $1, domain_verification_token = $2, domain_verified = false, updated_at = NOW()
     WHERE id = $3`,
    [domain, token, brandingId]
  )
  clearBrandingCache()
  return token
}

export function generateCssVariables(branding: TenantBranding): string {
  return `
:root {
  --brand-primary: ${branding.primary_color};
  --brand-secondary: ${branding.secondary_color};
  --brand-accent: ${branding.accent_color};
}
${branding.custom_css || ""}
  `.trim()
}

export async function getResellerStats(brandingId: number) {
  const clientsResult = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active,
            COUNT(*) FILTER (WHERE status = 'trial') as trial,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
            COALESCE(SUM(monthly_revenue), 0) as total_mrr,
            COALESCE(SUM(commission_earned), 0) as total_commission
     FROM reseller_clients WHERE reseller_branding_id = $1`,
    [brandingId]
  )

  return clientsResult.data?.[0] || {
    total: 0, active: 0, trial: 0, cancelled: 0, total_mrr: 0, total_commission: 0,
  }
}
