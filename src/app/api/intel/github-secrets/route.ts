import { NextRequest, NextResponse } from "next/server"
import { getGithubSecretFindings } from "@/lib/intel/fetchers/github-secrets"
import { checkIntelAccess } from "@/lib/intel/gate"
import { requireAuth } from "@/lib/middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const riskLevel = searchParams.get("risk") || undefined
  const secretType = searchParams.get("type") || undefined
  const limitParam = parseInt(searchParams.get("limit") || "50", 10)

  let user: { role?: string; subscription_type?: string; is_lifetime?: boolean } | null = null
  try { const auth = await requireAuth(request); if (auth.authorized) user = auth.user } catch { /* anonymous */ }

  const gate = await checkIntelAccess(user, "github_secrets")
  const maxItems = gate.limit === -1 ? Math.min(limitParam, 100) : Math.min(limitParam, gate.limit)

  const findings = await getGithubSecretFindings(maxItems, riskLevel, secretType)

  return NextResponse.json({ success: true, data: findings, total: findings.length, limit: gate.limit })
}
