// ================================================
// GET /api/intel/automation/clusters
// Public read of deep correlation clusters with
// optional filtering by anchor type.
// ================================================
import { NextRequest, NextResponse } from "next/server"
import { getDeepClusters, type ClusterType } from "@/lib/intel/automation/correlator-v2"

export const dynamic = "force-dynamic"
export const revalidate = 0

const TYPES = new Set(["cve", "actor", "ransomware", "malware"])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100)
  const typeRaw = searchParams.get("type")
  const type = typeRaw && TYPES.has(typeRaw) ? (typeRaw as ClusterType) : undefined
  const items = await getDeepClusters(limit, type)
  return NextResponse.json({ success: true, items })
}
