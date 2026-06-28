// ================================================
// IntelForge Automation - Action Queue Collaboration
// ------------------------------------------------
// Comments + assignment + audit log. Audit rows are
// the source of truth for "who changed what when".
// ================================================
import { query } from "@/lib/db"

export interface ActionComment {
  id: number
  actionId: number
  authorId: number | null
  authorName: string | null
  body: string
  createdAt: string
}

export interface ActionAuditEntry {
  id: number
  actionId: number
  actorId: number | null
  actorName: string | null
  event: string
  fromValue: string | null
  toValue: string | null
  metadata: Record<string, unknown>
  createdAt: string
}


export async function listComments(actionId: number): Promise<ActionComment[]> {
  const r = await query(
    `SELECT id, action_id, author_id, author_name, body, created_at
     FROM intel_action_comments
     WHERE action_id = $1
     ORDER BY created_at ASC`,
    [actionId],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    actionId: Number(row.action_id),
    authorId: row.author_id ? Number(row.author_id) : null,
    authorName: (row.author_name as string) || null,
    body: String(row.body),
    createdAt: (row.created_at as Date).toISOString(),
  }))
}

export async function addComment(
  actionId: number,
  body: string,
  authorId: number | null,
  authorName: string | null,
): Promise<ActionComment | null> {
  if (!body || body.trim().length === 0) return null
  const trimmed = body.trim().slice(0, 4000)
  const r = await query(
    `INSERT INTO intel_action_comments (action_id, author_id, author_name, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, action_id, author_id, author_name, body, created_at`,
    [actionId, authorId, authorName, trimmed],
  )
  if (!r.success || !r.data?.length) return null

  await recordAudit({
    actionId,
    actorId: authorId,
    actorName: authorName,
    event: "comment",
    fromValue: null,
    toValue: trimmed.slice(0, 80),
    metadata: { length: trimmed.length },
  })

  const row = r.data[0] as Record<string, unknown>
  return {
    id: Number(row.id),
    actionId: Number(row.action_id),
    authorId: row.author_id ? Number(row.author_id) : null,
    authorName: (row.author_name as string) || null,
    body: String(row.body),
    createdAt: (row.created_at as Date).toISOString(),
  }
}

export async function listAuditEntries(actionId: number, limit = 50): Promise<ActionAuditEntry[]> {
  const r = await query(
    `SELECT id, action_id, actor_id, actor_name, event, from_value, to_value, metadata, created_at
     FROM intel_action_audit
     WHERE action_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [actionId, limit],
  )
  return ((r.data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    actionId: Number(row.action_id),
    actorId: row.actor_id ? Number(row.actor_id) : null,
    actorName: (row.actor_name as string) || null,
    event: String(row.event),
    fromValue: (row.from_value as string) || null,
    toValue: (row.to_value as string) || null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: (row.created_at as Date).toISOString(),
  }))
}

export async function recordAudit(input: {
  actionId: number
  actorId: number | null
  actorName: string | null
  event: string
  fromValue?: string | null
  toValue?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await query(
    `INSERT INTO intel_action_audit
       (action_id, actor_id, actor_name, event, from_value, to_value, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.actionId,
      input.actorId,
      input.actorName,
      input.event,
      input.fromValue ?? null,
      input.toValue ?? null,
      JSON.stringify(input.metadata || {}),
    ],
  )
}

export async function assignAction(
  actionId: number,
  assigneeId: number | null,
  assigneeName: string | null,
  actorId: number | null,
  actorName: string | null,
): Promise<void> {
  // Read previous assignee for audit
  const prev = await query(
    `SELECT assigned_to FROM intel_action_queue WHERE id = $1`,
    [actionId],
  )
  const prevId = prev.success ? (prev.data?.[0] as Record<string, unknown> | undefined)?.assigned_to : null

  await query(
    `UPDATE intel_action_queue
     SET assigned_to = $1, updated_at = NOW()
     WHERE id = $2`,
    [assigneeId, actionId],
  )
  await recordAudit({
    actionId,
    actorId,
    actorName,
    event: "assigned",
    fromValue: prevId ? String(prevId) : null,
    toValue: assigneeId ? String(assigneeId) : null,
    metadata: { assigneeName },
  })
}
