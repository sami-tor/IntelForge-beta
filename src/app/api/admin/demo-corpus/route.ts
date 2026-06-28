import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"
import { query } from "@/lib/db"
import { buildDemoCorpus, validateDemoDoc } from "@/lib/intel/demo-corpus"

const QUICKWIT_URL = process.env.QUICKWIT_URL || "http://localhost:7280"
const QUICKWIT_INDEX = process.env.QUICKWIT_INDEX || "osint-data"

async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS intel_demo_corpus (
    id VARCHAR(120) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    doc_type VARCHAR(80) NOT NULL,
    source_name VARCHAR(200) NOT NULL,
    source_kind VARCHAR(40) NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,
    confidence INTEGER NOT NULL,
    tlp VARCHAR(20) NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    iocs JSONB NOT NULL DEFAULT '[]'::jsonb,
    relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
    safe_demo BOOLEAN DEFAULT true,
    redaction_level VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`, [])
}

async function ingestToQuickwit(docs: ReturnType<typeof buildDemoCorpus>) {
  const ndjson = docs.map((doc) => JSON.stringify({
    timestamp: doc.timestamp,
    file_name: `${doc.doc_type}-${doc.id}.json`,
    file_path: `demo/${doc.doc_type}/${doc.id}.json`,
    file_type: "json",
    category: `demo-${doc.doc_type}`,
    content: JSON.stringify(doc),
    title: doc.title,
    summary: doc.summary,
    doc_type: doc.doc_type,
    source_name: doc.source_name,
    safe_demo: true,
    severity: doc.severity,
    risk_score: doc.risk_score,
    confidence: doc.confidence,
    tags: doc.tags,
    entities: doc.entities,
    iocs: doc.iocs,
    redaction_level: doc.redaction_level,
  })).join("\n") + "\n"

  const res = await fetch(`${QUICKWIT_URL}/api/v1/${QUICKWIT_INDEX}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body: ndjson,
  })

  if (!res.ok) {
    throw new Error(`Quickwit ingest failed: ${res.status} ${await res.text()}`)
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const rows = await query(`SELECT * FROM intel_demo_corpus ORDER BY timestamp DESC`, [])
  return NextResponse.json({ success: true, docs: rows.data || [], count: rows.data?.length || 0 })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()

  const docs = buildDemoCorpus()
  for (const doc of docs) validateDemoDoc(doc)

  for (const doc of docs) {
    await query(
      `INSERT INTO intel_demo_corpus (
        id, timestamp, doc_type, source_name, source_kind, title, summary, body, severity,
        risk_score, confidence, tlp, tags, entities, iocs, relationships, raw_reference, safe_demo, redaction_level
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        doc_type = EXCLUDED.doc_type,
        source_name = EXCLUDED.source_name,
        source_kind = EXCLUDED.source_kind,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        body = EXCLUDED.body,
        severity = EXCLUDED.severity,
        risk_score = EXCLUDED.risk_score,
        confidence = EXCLUDED.confidence,
        tlp = EXCLUDED.tlp,
        tags = EXCLUDED.tags,
        entities = EXCLUDED.entities,
        iocs = EXCLUDED.iocs,
        relationships = EXCLUDED.relationships,
        raw_reference = EXCLUDED.raw_reference,
        safe_demo = EXCLUDED.safe_demo,
        redaction_level = EXCLUDED.redaction_level,
        updated_at = NOW()`,
      [
        doc.id,
        doc.timestamp,
        doc.doc_type,
        doc.source_name,
        doc.source_kind,
        doc.title,
        doc.summary,
        doc.body,
        doc.severity,
        doc.risk_score,
        doc.confidence,
        doc.tlp,
        JSON.stringify(doc.tags),
        JSON.stringify(doc.entities),
        JSON.stringify(doc.iocs),
        JSON.stringify(doc.relationships),
        JSON.stringify(doc.raw_reference),
        doc.safe_demo,
        doc.redaction_level,
      ],
    )
  }

  let quickwit = "skipped"
  try {
    await ingestToQuickwit(docs)
    quickwit = "ok"
  } catch {
    quickwit = "failed"
  }

  return NextResponse.json({ success: true, seeded: docs.length, quickwit })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return createAuthResponse(auth.error || "Unauthorized", auth.status || 401)
  await ensureTables()
  await query(`DELETE FROM intel_demo_corpus`, [])
  return NextResponse.json({ success: true })
}
