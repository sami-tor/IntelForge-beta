// ================================================
// IntelForge Automation - Briefing PDF Export
// ------------------------------------------------
// Renders a GeneratedBriefing into a polished A4
// PDF using the same PDFKit setup we already have.
// ================================================
import PDFDocument from "pdfkit"
import type { GeneratedBriefing } from "./briefing-generator"

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#64748b",
}

export function generateBriefingPdf(briefing: GeneratedBriefing): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
      info: {
        Title: briefing.headline,
        Author: "IntelForge",
        Subject: "Threat Intelligence Briefing",
      },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const sevColor = SEVERITY_COLOR[briefing.threatLevel] || "#64748b"

    // ── Cover ──
    doc.fillColor("#0f172a")
      .rect(0, 0, doc.page.width, 120)
      .fill()
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica")
      .text("INTELFORGE · THREAT COMMAND CENTER", 50, 38, { align: "left" })
    doc.fontSize(22).font("Helvetica-Bold")
      .text("Executive Briefing", 50, 60, { align: "left" })
    doc.fontSize(10).font("Helvetica")
      .text(
        `${briefing.briefingType.toUpperCase()} · ${new Date(briefing.periodEnd).toLocaleString()}`,
        50,
        92,
        { align: "left" },
      )

    doc.fillColor("#000000").y = 150
    doc.x = 50

    // Threat tile
    const tileY = doc.y
    doc.roundedRect(50, tileY, doc.page.width - 100, 80, 8)
      .fillAndStroke("#f8fafc", "#e2e8f0")

    doc.fillColor(sevColor).fontSize(36).font("Helvetica-Bold")
      .text(String(briefing.threatScore), 70, tileY + 18, { width: 90, align: "center" })
    doc.fillColor("#475569").fontSize(9).font("Helvetica")
      .text("/100", 70, tileY + 60, { width: 90, align: "center" })

    doc.fillColor(sevColor).fontSize(12).font("Helvetica-Bold")
      .text(briefing.threatLevel.toUpperCase(), 180, tileY + 18)
    doc.fillColor("#0f172a").fontSize(11).font("Helvetica")
      .text(briefing.headline, 180, tileY + 36, {
        width: doc.page.width - 230,
        height: 36,
        ellipsis: true,
      })

    doc.y = tileY + 100
    doc.x = 50

    // ── Summary ──
    sectionHeader(doc, "EXECUTIVE SUMMARY")
    doc.fillColor("#0f172a").fontSize(11).font("Helvetica")
      .text(briefing.summary, { align: "justify" })
    doc.moveDown(1)

    // ── Highlights ──
    if (briefing.highlights.length > 0) {
      sectionHeader(doc, "KEY HIGHLIGHTS")
      doc.fontSize(10).font("Helvetica")
      for (const h of briefing.highlights.slice(0, 8)) {
        const sev = (h.severity || "medium").toString().toLowerCase()
        const dot = SEVERITY_COLOR[sev] || "#94a3b8"
        const startY = doc.y
        doc.circle(56, startY + 5, 3).fillAndStroke(dot, dot)
        doc.fillColor("#0f172a").font("Helvetica-Bold")
          .text(h.title, 70, startY, { continued: true, width: doc.page.width - 120 })
        doc.font("Helvetica").fillColor("#475569")
          .text(` — ${h.detail}`)
        doc.moveDown(0.2)
      }
      doc.moveDown(0.6)
    }

    // ── Metrics ──
    sectionHeader(doc, "METRICS · LAST 24 HOURS")
    const metricRows: Array<[string, number]> = [
      ["New CVEs", briefing.metrics.newCves24h],
      ["Critical CVEs", briefing.metrics.criticalCves24h],
      ["KEV catalogue", briefing.metrics.kev],
      ["Public exploits", briefing.metrics.exploits24h],
      ["Ransomware victims (7d)", briefing.metrics.ransomwareVictims7d],
      ["Active phishing", briefing.metrics.phishingActive],
      ["Dark-web posts", briefing.metrics.darknetPosts24h],
      ["News items", briefing.metrics.newsItems24h],
    ]
    drawMetricGrid(doc, metricRows)
    doc.moveDown(1)

    // ── Top clusters ──
    if (briefing.topClusters.length > 0) {
      sectionHeader(doc, "TOP CORRELATED THREATS")
      for (const c of briefing.topClusters.slice(0, 5)) {
        if (doc.y > doc.page.height - 120) doc.addPage()
        const startY = doc.y
        doc.roundedRect(50, startY, doc.page.width - 100, 56, 6)
          .fillAndStroke("#ffffff", "#e2e8f0")
        const cSev = SEVERITY_COLOR[c.severity] || "#64748b"
        doc.fillColor(cSev).fontSize(20).font("Helvetica-Bold")
          .text(String(c.riskScore), 60, startY + 14, { width: 50, align: "center" })
        doc.fillColor("#94a3b8").fontSize(7).font("Helvetica")
          .text("RISK", 60, startY + 38, { width: 50, align: "center" })
        doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold")
          .text(c.title, 120, startY + 12, { width: doc.page.width - 180, ellipsis: true })
        doc.fontSize(9).font("Helvetica").fillColor("#475569")
          .text(c.summary || "", 120, startY + 28, {
            width: doc.page.width - 180,
            height: 24,
            ellipsis: true,
          })
        doc.y = startY + 64
        doc.x = 50
      }
      doc.moveDown(0.4)
    }

    // ── Recommendations ──
    if (briefing.recommendations.length > 0) {
      if (doc.y > doc.page.height - 200) doc.addPage()
      sectionHeader(doc, "RECOMMENDED ACTIONS")
      doc.fontSize(10).font("Helvetica")
      let n = 1
      for (const r of briefing.recommendations.slice(0, 6)) {
        doc.fillColor("#0f172a").font("Helvetica-Bold").text(`${n}. `, { continued: true })
        doc.font("Helvetica").fillColor("#1e293b").text(r)
        doc.moveDown(0.3)
        n++
      }
    }

    // ── Footer ──
    const pageCount = doc.bufferedPageRange().count
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i)
      doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
        .text(
          `IntelForge Threat Briefing · Generated ${new Date(briefing.periodEnd).toISOString()} · Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 30,
          { align: "center", width: doc.page.width - 100 },
        )
    }

    doc.end()
  })
}

function sectionHeader(doc: any, label: string) {
  doc.moveDown(0.2)
  doc.fillColor("#0ea5e9").fontSize(9).font("Helvetica-Bold")
    .text(label, { characterSpacing: 1 })
  doc.fillColor("#0f172a")
  doc.moveDown(0.3)
}

function drawMetricGrid(doc: any, rows: Array<[string, number]>) {
  const cols = 4
  const gap = 8
  const totalWidth = doc.page.width - 100
  const cellWidth = (totalWidth - gap * (cols - 1)) / cols
  const cellHeight = 50

  let i = 0
  let y = doc.y
  while (i < rows.length) {
    if (y + cellHeight > doc.page.height - 60) {
      doc.addPage()
      y = doc.y
    }
    for (let c = 0; c < cols && i < rows.length; c++, i++) {
      const x = 50 + c * (cellWidth + gap)
      const [label, value] = rows[i]
      doc.roundedRect(x, y, cellWidth, cellHeight, 6)
        .fillAndStroke("#f8fafc", "#e2e8f0")
      doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold")
        .text(value.toLocaleString(), x + 8, y + 8, { width: cellWidth - 16 })
      doc.fillColor("#64748b").fontSize(8).font("Helvetica")
        .text(label, x + 8, y + 30, { width: cellWidth - 16 })
    }
    y += cellHeight + gap
  }
  doc.y = y
  doc.x = 50
}
