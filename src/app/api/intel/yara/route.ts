import { NextRequest, NextResponse } from "next/server"
import { getYaraRules, matchYaraRule } from "@/lib/intel/fetchers/yara-rules"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") || undefined
  const severity = searchParams.get("severity") || undefined
  const family = searchParams.get("family") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "yara_rules")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 200) : Math.min(limitParam, gate.limit)

  const rules = await getYaraRules(maxItems, category, severity, family)

  return NextResponse.json({ success: true, data: rules, total: rules.length, limit: gate.limit })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const target = body.target as string
  const ruleName = body.ruleName as string

  if (!target || !ruleName) {
    return NextResponse.json({ success: false, error: "target and ruleName required" }, { status: 400 })
  }

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "yara_rules")
  if (!gate.allowed) {
    return NextResponse.json({ success: false, error: gate.reason }, { status: 403 })
  }

  const rules = await getYaraRules(200)
  const rule = rules.find((r) => r.ruleName === ruleName)
  if (!rule) {
    return NextResponse.json({ success: false, error: "Rule not found" }, { status: 404 })
  }

  const matched = matchYaraRule(rule.rawRule, target)
  return NextResponse.json({ success: true, data: { ruleName, matched, target } })
}
