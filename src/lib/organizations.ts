import { query } from "./db"

export type OrgRole = "owner" | "admin" | "member" | "viewer"

export interface Organization {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website: string | null
  industry: string | null
  size: string | null
  billing_email: string | null
  settings: Record<string, any>
  is_active: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: number
  organization_id: number
  user_id: number
  role: OrgRole
  email: string
  username: string
  joined_at: string
  is_active: boolean
}

export const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

export function hasMinRole(userRole: OrgRole, minRole: OrgRole): boolean {
  return (ORG_ROLE_HIERARCHY[userRole] || 0) >= (ORG_ROLE_HIERARCHY[minRole] || 0)
}

const PERMISSIONS: Record<OrgRole, string[]> = {
  owner: [
    "org:manage", "org:delete", "org:settings", "org:billing",
    "members:invite", "members:remove", "members:role",
    "cases:create", "cases:edit", "cases:delete", "cases:view",
    "searches:run", "searches:export",
    "integrations:manage", "branding:manage",
    "api:keys", "api:use",
  ],
  admin: [
    "org:settings",
    "members:invite", "members:remove", "members:role",
    "cases:create", "cases:edit", "cases:delete", "cases:view",
    "searches:run", "searches:export",
    "integrations:manage",
    "api:keys", "api:use",
  ],
  member: [
    "cases:create", "cases:edit", "cases:view",
    "searches:run", "searches:export",
    "api:use",
  ],
  viewer: [
    "cases:view",
    "searches:run",
  ],
}

export function hasPermission(role: OrgRole, permission: string): boolean {
  return (PERMISSIONS[role] || []).includes(permission)
}

export async function getUserOrgRole(orgId: number, userId: number): Promise<OrgRole | null> {
  const result = await query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
    [orgId, userId]
  )
  return result.data?.[0]?.role || null
}

export async function getUserOrganizations(userId: number): Promise<Organization[]> {
  const result = await query(
    `SELECT o.* FROM organizations o
     INNER JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.is_active = true AND o.is_active = true
     ORDER BY o.name`,
    [userId]
  )
  return result.data || []
}

export async function getOrganizationById(orgId: number): Promise<Organization | null> {
  const result = await query(
    `SELECT * FROM organizations WHERE id = $1 AND is_active = true`,
    [orgId]
  )
  return result.data?.[0] || null
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const result = await query(
    `SELECT * FROM organizations WHERE slug = $1 AND is_active = true`,
    [slug]
  )
  return result.data?.[0] || null
}

export async function createOrganization(
  name: string, slug: string, createdBy: number, description?: string
): Promise<Organization | null> {
  const result = await query(
    `INSERT INTO organizations (name, slug, description, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, createdBy, description || null]
  )
  if (!result.success || !result.data?.length) return null

  const org = result.data[0]
  // Creator becomes owner
  await query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [org.id, createdBy]
  )
  // Set as current org
  await query(`UPDATE users SET current_org_id = $1 WHERE id = $2`, [org.id, createdBy])

  return org
}

export async function updateOrganization(
  orgId: number, updates: Partial<Organization>
): Promise<Organization | null> {
  const fields: string[] = []
  const values: any[] = []
  let idx = 1

  const allowed = ["name", "description", "logo_url", "website", "industry", "size", "billing_email", "settings"]
  for (const key of allowed) {
    if (key in updates) {
      fields.push(`${key} = $${idx++}`)
      values.push((updates as any)[key])
    }
  }

  if (!fields.length) return getOrganizationById(orgId)

  fields.push(`updated_at = NOW()`)
  values.push(orgId)

  const result = await query(
    `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  )
  return result.data?.[0] || null
}

export async function deleteOrganization(orgId: number): Promise<boolean> {
  const result = await query(
    `UPDATE organizations SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [orgId]
  )
  return result.success
}

export async function getOrgMembers(orgId: number): Promise<OrgMember[]> {
  const result = await query(
    `SELECT om.*, u.email, u.username
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.is_active = true
     ORDER BY om.joined_at`,
    [orgId]
  )
  return result.data || []
}

export async function addOrgMember(
  orgId: number, userId: number, role: OrgRole, invitedBy?: number
): Promise<boolean> {
  const result = await query(
    `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET is_active = true, role = $3
     RETURNING *`,
    [orgId, userId, role, invitedBy || null]
  )
  return result.success && (result.data?.length || 0) > 0
}

export async function removeOrgMember(orgId: number, userId: number): Promise<boolean> {
  const result = await query(
    `UPDATE organization_members SET is_active = false WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  )
  return result.success
}

export async function updateMemberRole(orgId: number, userId: number, role: OrgRole): Promise<boolean> {
  const result = await query(
    `UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3`,
    [role, orgId, userId]
  )
  return result.success
}

export async function switchUserOrg(userId: number, orgId: number): Promise<boolean> {
  const result = await query(
    `UPDATE users SET current_org_id = $1 WHERE id = $2`,
    [orgId, userId]
  )
  return result.success
}

export async function createOrgInvite(
  orgId: number, email: string, role: OrgRole, invitedBy: number
): Promise<string | null> {
  const token = `org_inv_${crypto.randomUUID()}`
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const result = await query(
    `INSERT INTO organization_invites (organization_id, email, role, token, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (organization_id, email) DO UPDATE
       SET token = $4, invited_by = $5, expires_at = $6, accepted_at = NULL
     RETURNING token`,
    [orgId, email, role, token, invitedBy, expiresAt]
  )
  return result.data?.[0]?.token || null
}

export async function acceptOrgInvite(token: string, userId: number): Promise<number | null> {
  const inviteResult = await query(
    `SELECT * FROM organization_invites WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL`,
    [token]
  )
  const invite = inviteResult.data?.[0]
  if (!invite) return null

  await addOrgMember(invite.organization_id, userId, invite.role, invite.invited_by)

  await query(
    `UPDATE organization_invites SET accepted_at = NOW() WHERE id = $1`,
    [invite.id]
  )

  await switchUserOrg(userId, invite.organization_id)

  return invite.organization_id
}

export async function getOrgInvites(orgId: number) {
  const result = await query(
    `SELECT oi.*, u.username as inviter_name
     FROM organization_invites oi
     LEFT JOIN users u ON oi.invited_by = u.id
     WHERE oi.organization_id = $1 AND oi.accepted_at IS NULL AND oi.expires_at > NOW()
     ORDER BY oi.created_at DESC`,
    [orgId]
  )
  return result.data || []
}
