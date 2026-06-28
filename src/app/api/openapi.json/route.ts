// ================================================
// GET /api/openapi.json
// Machine-readable spec for Swagger UI / Postman.
// ================================================
import { NextResponse } from "next/server"
import { buildFullSpec } from "@/lib/intel/automation/openapi"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(buildFullSpec(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  })
}
