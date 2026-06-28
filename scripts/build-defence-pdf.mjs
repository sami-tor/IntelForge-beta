// ================================================
// Build the FYP Defence PDF.
//   • Reads the master defence markdown + diagram files
//     in docs/defence and renders to a single PDF.
//   • PDFKit only — no headless browser, no LaTeX,
//     no Mermaid runtime needed.
//   • Mermaid blocks are auto-collapsed and the
//     plain-text fallback below them is rendered.
//
// Run with:  npm run defence:pdf
// Output:    docs/defence/IntelForge_FYP_Defence.pdf
// ================================================
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import PDFDocument from "pdfkit"
import SVGtoPDF from "svg-to-pdfkit"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..")
const DOCS = path.join(ROOT, "docs", "defence")
const OUT = path.join(DOCS, "IntelForge_FYP_Defence.pdf")

// ---- Source order in the rendered PDF ----
const SECTIONS = [
  { title: null,                                          file: "INTELFORGE_FYP_DEFENCE.md", isMaster: true },
  { title: "Diagram 1 — System Architecture",             file: "diagrams/01-architecture.md",   svg: "diagrams/svg/01-architecture.svg" },
  { title: "Diagram 2 — Automation Pipeline Sequence",    file: "diagrams/02-pipeline-flow.md",  svg: "diagrams/svg/02-pipeline-flow.svg" },
  { title: "Diagram 3 — Entity-Relationship",             file: "diagrams/03-er-diagram.md",     svg: "diagrams/svg/03-er-diagram.svg" },
  { title: "Diagram 4 — Use Case",                        file: "diagrams/04-use-case.md",       svg: "diagrams/svg/04-use-case.svg" },
  { title: "Diagram 5 — Action Queue State Machine",      file: "diagrams/05-state-machine.md",  svg: "diagrams/svg/05-state-machine.svg" },
  { title: "Diagram 6 — Class / Module Structure",        file: "diagrams/06-class-diagram.md",  svg: "diagrams/svg/06-class-diagram.svg" },
  { title: "Diagram 7 — Deployment Topology",             file: "diagrams/07-deployment.md",     svg: "diagrams/svg/07-deployment.svg" },
  { title: "Diagram 8 — Deep Correlation Engine",         file: "diagrams/08-correlation-engine.md", svg: "diagrams/svg/08-correlation-engine.svg" },
  { title: "Correlation Engine — Deep Dive",              file: "correlation-deep-dive.md" },
  { title: "200 Viva Questions & Answers",                file: "FYP_VIVA_200_QA.md" },
  { title: "Test Plan & Cases",                           file: "test-cases.md" },
  { title: "Comparison vs Commercial CTI",                file: "comparison.md" },
]

// ---- Colour palette ----
const C = {
  navy: "#0f172a",
  primary: "#0ea5e9",
  primaryDark: "#075985",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#cbd5e1",
  bgSoft: "#f1f5f9",
  bgChip: "#e0f2fe",
  codeBg: "#f8fafc",
  codeText: "#334155",
  red: "#ef4444",
  green: "#22c55e",
}

const PAGE_MARGIN = 54
const FONT_BODY = "Helvetica"
const FONT_BOLD = "Helvetica-Bold"
const FONT_MONO = "Courier"

function buildDoc() {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: PAGE_MARGIN,
      bottom: PAGE_MARGIN + 24,
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
    },
    bufferPages: true,
    info: {
      Title: "IntelForge — FYP Defence",
      Author: "IntelForge Project Team",
      Subject: "Final-year project defence reference document",
    },
  })
  return doc
}

function cover(doc) {
  doc.fillColor(C.navy)
    .rect(0, 0, doc.page.width, doc.page.height)
    .fill()

  doc.fillColor(C.primary).fontSize(11).font(FONT_BODY)
    .text("INTELFORGE", PAGE_MARGIN, 120, { characterSpacing: 4 })
  doc.fillColor("#ffffff").fontSize(36).font(FONT_BOLD)
    .text("FYP Defence", PAGE_MARGIN, 150)
  doc.fontSize(20).font(FONT_BODY)
    .text("Threat Command Center · Automation Layer", PAGE_MARGIN, 200)

  doc.fillColor("#94a3b8").fontSize(11).font(FONT_BODY)
    .text(
      "A self-running threat-intelligence pipeline built on Next.js 16, " +
        "PostgreSQL 16 and a deterministic forecasting + correlation core.",
      PAGE_MARGIN,
      260,
      { width: doc.page.width - 2 * PAGE_MARGIN, lineGap: 4 },
    )

  // Tile bar
  const tileTop = 360
  const tiles = [
    ["Stack", "Next 16 · TS · pg"],
    ["Modules", "10 new"],
    ["Tables", "11 new"],
    ["LOC", "≈ 5,400"],
    ["Tests", "52 cases"],
  ]
  const tileWidth = (doc.page.width - 2 * PAGE_MARGIN - 8 * (tiles.length - 1)) / tiles.length
  let tx = PAGE_MARGIN
  for (const [label, value] of tiles) {
    doc.fillColor("#1e293b")
      .roundedRect(tx, tileTop, tileWidth, 64, 6)
      .fill()
    doc.fillColor("#94a3b8").fontSize(9).font(FONT_BODY)
      .text(label.toUpperCase(), tx + 10, tileTop + 12, { characterSpacing: 1 })
    doc.fillColor("#ffffff").fontSize(14).font(FONT_BOLD)
      .text(value, tx + 10, tileTop + 30, { width: tileWidth - 20 })
    tx += tileWidth + 8
  }

  doc.fillColor("#94a3b8").fontSize(10).font(FONT_BODY)
    .text(
      "Generated " + new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC",
      PAGE_MARGIN,
      doc.page.height - 80,
    )
  doc.fillColor("#475569").fontSize(8).font(FONT_BODY)
    .text(
      "Every claim in this document is cited to a specific file and line range in the codebase. " +
        "See appendix A for the full file inventory.",
      PAGE_MARGIN,
      doc.page.height - 60,
      { width: doc.page.width - 2 * PAGE_MARGIN, lineGap: 2 },
    )
}

// ---- Markdown line tokeniser (purpose-built; small subset) ----
const KIND = {
  H1: "h1",
  H2: "h2",
  H3: "h3",
  H4: "h4",
  HR: "hr",
  CODE_OPEN: "codeOpen",
  CODE_CLOSE: "codeClose",
  CODE_LINE: "codeLine",
  TABLE: "table",
  LIST: "list",
  OL: "ol",
  BLOCKQUOTE: "blockquote",
  TEXT: "text",
  EMPTY: "empty",
}

function tokenise(md) {
  const lines = md.split("\n")
  const tokens = []
  let inCode = false
  let codeLang = ""
  let suppressMermaid = false
  let tableBuffer = null

  function flushTable() {
    if (tableBuffer && tableBuffer.length >= 2) {
      tokens.push({ kind: KIND.TABLE, rows: tableBuffer })
    }
    tableBuffer = null
  }

  for (let raw of lines) {
    const line = raw.replace(/\r$/, "")

    // Code fence handling
    const fenceMatch = line.match(/^```(\w*)\s*$/)
    if (fenceMatch) {
      if (!inCode) {
        inCode = true
        codeLang = (fenceMatch[1] || "").toLowerCase()
        suppressMermaid = codeLang === "mermaid"
        if (!suppressMermaid) {
          flushTable()
          tokens.push({ kind: KIND.CODE_OPEN, lang: codeLang })
        }
      } else {
        if (!suppressMermaid) tokens.push({ kind: KIND.CODE_CLOSE })
        inCode = false
        suppressMermaid = false
        codeLang = ""
      }
      continue
    }
    if (inCode) {
      if (!suppressMermaid) tokens.push({ kind: KIND.CODE_LINE, text: line })
      continue
    }

    // Table
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim())
      if (!tableBuffer) tableBuffer = []
      // Skip the divider row (e.g. "|---|---|")
      if (!/^[-:\s|]+$/.test(line.replace(/\|/g, ""))) {
        tableBuffer.push(cells)
      }
      continue
    } else if (tableBuffer) {
      flushTable()
    }

    // Block-level
    if (/^\s*$/.test(line)) {
      tokens.push({ kind: KIND.EMPTY })
      continue
    }
    if (/^---+$/.test(line.trim())) {
      tokens.push({ kind: KIND.HR })
      continue
    }
    if (line.startsWith("# ")) tokens.push({ kind: KIND.H1, text: line.slice(2) })
    else if (line.startsWith("## ")) tokens.push({ kind: KIND.H2, text: line.slice(3) })
    else if (line.startsWith("### ")) tokens.push({ kind: KIND.H3, text: line.slice(4) })
    else if (line.startsWith("#### ")) tokens.push({ kind: KIND.H4, text: line.slice(5) })
    else if (/^\s*[-*]\s+/.test(line)) tokens.push({ kind: KIND.LIST, text: line.replace(/^\s*[-*]\s+/, "") })
    else if (/^\s*\d+\.\s+/.test(line)) tokens.push({ kind: KIND.OL, text: line.replace(/^\s*\d+\.\s+/, "") })
    else if (line.startsWith("> ")) tokens.push({ kind: KIND.BLOCKQUOTE, text: line.slice(2) })
    else tokens.push({ kind: KIND.TEXT, text: line })
  }
  flushTable()
  return tokens
}

// ---- Inline formatting ----
// Splits a string into runs of {bold, mono, link, plain} for stylised render.
function inlineRuns(text) {
  // tokens: ` `code`, **bold**, [text](url), plain
  const runs = []
  let i = 0
  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1)
      if (end > -1) {
        runs.push({ kind: "mono", text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
      // Unmatched backtick — emit as plain and advance one char
      runs.push({ kind: "plain", text: text[i] })
      i++
      continue
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2)
      if (end > -1) {
        runs.push({ kind: "bold", text: text.slice(i + 2, end) })
        i = end + 2
        continue
      }
      // Unmatched ** — emit literally and advance two chars
      runs.push({ kind: "plain", text: "**" })
      i += 2
      continue
    }
    if (text[i] === "[") {
      const end = text.indexOf("]", i + 1)
      if (end > -1 && text[end + 1] === "(") {
        const close = text.indexOf(")", end + 2)
        if (close > -1) {
          runs.push({ kind: "link", text: text.slice(i + 1, end), url: text.slice(end + 2, close) })
          i = close + 1
          continue
        }
      }
      // Unmatched [ — emit as plain and advance one char
      runs.push({ kind: "plain", text: text[i] })
      i++
      continue
    }
    // plain run until next special, but at least 1 char so we always advance
    let next = text.length
    for (const m of ["`", "**", "["]) {
      const idx = text.indexOf(m, i + 1) // start search AFTER current position
      if (idx > -1 && idx < next) next = idx
    }
    if (next <= i) next = i + 1
    runs.push({ kind: "plain", text: text.slice(i, next) })
    i = next
  }
  return runs
}

// ---- Rendering primitives ----
function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

function renderInline(doc, runs, opts = {}) {
  const baseSize = opts.size || 10.5
  const baseColor = opts.color || C.text
  const lineGap = opts.lineGap ?? 2
  doc.fontSize(baseSize).fillColor(baseColor)

  // Build a single line with continuation
  for (let idx = 0; idx < runs.length; idx++) {
    const run = runs[idx]
    const isLast = idx === runs.length - 1
    let font = FONT_BODY
    let color = baseColor
    let size = baseSize
    let underline = false
    let bg = null

    switch (run.kind) {
      case "bold":
        font = FONT_BOLD
        break
      case "mono":
        font = FONT_MONO
        size = baseSize - 0.5
        color = C.codeText
        bg = C.bgChip
        break
      case "link":
        color = C.primaryDark
        underline = true
        break
    }

    doc.font(font).fontSize(size).fillColor(color)
    const text = run.text
    if (bg) {
      // Inline mono with subtle background
      doc.text(text, { continued: !isLast, lineGap, underline: false })
    } else {
      doc.text(text, { continued: !isLast, lineGap, underline })
    }
  }
}

function renderHeading(doc, kind, text) {
  const sizes = { h1: 24, h2: 17, h3: 13, h4: 11.5 }
  const colors = { h1: C.navy, h2: C.navy, h3: C.primaryDark, h4: C.primaryDark }
  const spacingTop = { h1: 18, h2: 16, h3: 12, h4: 8 }
  const spacingBot = { h1: 6, h2: 5, h3: 3, h4: 2 }

  ensureSpace(doc, sizes[kind] + 30)
  doc.moveDown(spacingTop[kind] / 12)
  doc.fillColor(colors[kind]).font(FONT_BOLD).fontSize(sizes[kind])
    .text(text, { lineGap: 2 })
  if (kind === "h1") {
    // Coloured underline
    const y = doc.y + 1
    doc.moveTo(PAGE_MARGIN, y)
      .lineTo(PAGE_MARGIN + 40, y)
      .lineWidth(2)
      .strokeColor(C.primary)
      .stroke()
    doc.moveDown(0.3)
  } else {
    doc.moveDown(spacingBot[kind] / 12)
  }
}

function renderCodeBlock(doc, lines, lang) {
  const innerWidth = doc.page.width - 2 * PAGE_MARGIN - 16
  doc.font(FONT_MONO).fontSize(8.5)
  // Wrap long lines manually
  const wrapped = []
  for (const l of lines) {
    if (l.length === 0) {
      wrapped.push("")
      continue
    }
    // approx 90 chars per line at this size
    const max = 95
    if (l.length <= max) wrapped.push(l)
    else {
      for (let i = 0; i < l.length; i += max) wrapped.push(l.slice(i, i + max))
    }
  }
  const lineHeight = 11
  const padY = 8
  const totalHeight = wrapped.length * lineHeight + 2 * padY

  ensureSpace(doc, totalHeight + 8)
  const startY = doc.y
  doc.roundedRect(PAGE_MARGIN, startY, innerWidth + 16, totalHeight, 4)
    .fillAndStroke(C.codeBg, C.border)

  if (lang) {
    doc.fontSize(7).fillColor(C.textMuted).font(FONT_BODY)
      .text(lang, PAGE_MARGIN + innerWidth - 30, startY + 4, { width: 50, align: "right" })
  }

  doc.font(FONT_MONO).fontSize(8.5).fillColor(C.codeText)
  for (let i = 0; i < wrapped.length; i++) {
    doc.text(wrapped[i], PAGE_MARGIN + 8, startY + padY + i * lineHeight, {
      width: innerWidth,
      lineBreak: false,
    })
  }

  doc.y = startY + totalHeight + 8
  doc.x = PAGE_MARGIN
  doc.fillColor(C.text)
}

function renderTable(doc, rows) {
  if (!rows || rows.length === 0) return
  const cols = rows[0].length
  const tableWidth = doc.page.width - 2 * PAGE_MARGIN
  const colWidth = tableWidth / cols
  const headerHeight = 22
  const rowHeight = 18

  ensureSpace(doc, headerHeight + rows.length * rowHeight + 8)

  // Header
  let y = doc.y
  doc.rect(PAGE_MARGIN, y, tableWidth, headerHeight).fill(C.navy)
  doc.font(FONT_BOLD).fontSize(9).fillColor("#ffffff")
  for (let c = 0; c < cols; c++) {
    doc.text(rows[0][c] || "", PAGE_MARGIN + c * colWidth + 6, y + 7, {
      width: colWidth - 12,
      ellipsis: true,
      lineBreak: false,
    })
  }
  y += headerHeight

  // Body
  doc.font(FONT_BODY).fontSize(8.5)
  for (let r = 1; r < rows.length; r++) {
    const ensureFor = rowHeight + 4
    if (y + ensureFor > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
      y = doc.y
      // Re-render header
      doc.rect(PAGE_MARGIN, y, tableWidth, headerHeight).fill(C.navy)
      doc.font(FONT_BOLD).fontSize(9).fillColor("#ffffff")
      for (let c = 0; c < cols; c++) {
        doc.text(rows[0][c] || "", PAGE_MARGIN + c * colWidth + 6, y + 7, {
          width: colWidth - 12,
          ellipsis: true,
          lineBreak: false,
        })
      }
      y += headerHeight
      doc.font(FONT_BODY).fontSize(8.5)
    }
    doc.fillColor(r % 2 === 0 ? "#ffffff" : C.bgSoft)
      .rect(PAGE_MARGIN, y, tableWidth, rowHeight)
      .fill()
    for (let c = 0; c < cols; c++) {
      const cell = rows[r][c] || ""
      // Inline render with mono detection on backticks
      const runs = inlineRuns(cell)
      doc.x = PAGE_MARGIN + c * colWidth + 6
      doc.y = y + 5
      // Limit to one rendered line height
      doc.fillColor(C.text).font(FONT_BODY).fontSize(8.5)
      let text = cell.replace(/`/g, "").replace(/\*\*/g, "")
      // Reduce link [text](url) to text
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      doc.text(text, {
        width: colWidth - 12,
        height: rowHeight - 6,
        ellipsis: true,
        lineBreak: false,
      })
    }
    y += rowHeight
  }

  // Border
  doc.lineWidth(0.5).strokeColor(C.border)
    .rect(PAGE_MARGIN, doc.y - (rows.length - 1) * rowHeight - headerHeight, tableWidth, (rows.length - 1) * rowHeight + headerHeight)
    .stroke()

  doc.x = PAGE_MARGIN
  doc.y = y + 8
  doc.fillColor(C.text).font(FONT_BODY)
}

function renderTokens(doc, tokens, opts = {}) {
  let listIndent = 14
  for (const tok of tokens) {
    switch (tok.kind) {
      case KIND.H1:
      case KIND.H2:
      case KIND.H3:
      case KIND.H4:
        renderHeading(doc, tok.kind, tok.text)
        break
      case KIND.HR:
        ensureSpace(doc, 14)
        doc.moveDown(0.5)
        doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y)
          .lineWidth(0.5).strokeColor(C.border).stroke()
        doc.moveDown(0.5)
        break
      case KIND.CODE_OPEN:
        // collect lines until close
        opts._codeBuf = []
        opts._codeLang = tok.lang
        break
      case KIND.CODE_LINE:
        if (opts._codeBuf) opts._codeBuf.push(tok.text)
        break
      case KIND.CODE_CLOSE:
        renderCodeBlock(doc, opts._codeBuf || [], opts._codeLang || "")
        opts._codeBuf = null
        break
      case KIND.TABLE:
        renderTable(doc, tok.rows)
        break
      case KIND.LIST: {
        ensureSpace(doc, 18)
        const x = PAGE_MARGIN
        const y = doc.y
        doc.fillColor(C.primary).fontSize(10).font(FONT_BODY)
          .text("•", x, y, { lineBreak: false })
        doc.x = x + listIndent
        doc.y = y
        renderInline(doc, inlineRuns(tok.text), { size: 10.5, color: C.text, lineGap: 2 })
        doc.x = PAGE_MARGIN
        break
      }
      case KIND.OL: {
        ensureSpace(doc, 18)
        const x = PAGE_MARGIN
        const y = doc.y
        // Render the marker; counter not strictly tracked — fine for FYP doc
        doc.fillColor(C.primary).fontSize(10).font(FONT_BOLD)
          .text("›", x, y, { lineBreak: false })
        doc.x = x + listIndent
        doc.y = y
        renderInline(doc, inlineRuns(tok.text), { size: 10.5, color: C.text, lineGap: 2 })
        doc.x = PAGE_MARGIN
        break
      }
      case KIND.BLOCKQUOTE: {
        ensureSpace(doc, 24)
        const start = doc.y
        doc.x = PAGE_MARGIN + 12
        renderInline(doc, inlineRuns(tok.text), { size: 10, color: C.textMuted, lineGap: 2 })
        const end = doc.y
        doc.moveTo(PAGE_MARGIN + 4, start)
          .lineTo(PAGE_MARGIN + 4, end)
          .lineWidth(2).strokeColor(C.primary).stroke()
        doc.x = PAGE_MARGIN
        break
      }
      case KIND.TEXT:
        ensureSpace(doc, 18)
        doc.x = PAGE_MARGIN
        renderInline(doc, inlineRuns(tok.text), { size: 10.5, color: C.text, lineGap: 2 })
        break
      case KIND.EMPTY:
        doc.moveDown(0.4)
        break
    }
  }
}

function pageFooters(doc) {
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i)
    doc.font(FONT_BODY).fontSize(8).fillColor(C.textMuted)
      .text(
        "IntelForge · FYP Defence",
        PAGE_MARGIN,
        doc.page.height - 30,
        { width: doc.page.width - 2 * PAGE_MARGIN, align: "left", lineBreak: false },
      )
    doc.text(
      `${i + 1} / ${range.count}`,
      PAGE_MARGIN,
      doc.page.height - 30,
      { width: doc.page.width - 2 * PAGE_MARGIN, align: "right", lineBreak: false },
    )
  }
}

async function main() {
  console.log("[defence-pdf] Building...")

  const doc = buildDoc()
  const out = fs.createWriteStream(OUT)
  doc.pipe(out)

  // Cover
  cover(doc)

  // Each section starts on a new page
  for (const sec of SECTIONS) {
    const fp = path.join(DOCS, sec.file)
    if (!fs.existsSync(fp)) {
      console.warn(`[defence-pdf] Missing ${sec.file} — skipping`)
      continue
    }
    const md = fs.readFileSync(fp, "utf8")
    doc.addPage()
    if (sec.title) {
      doc.fillColor(C.primary).fontSize(10).font(FONT_BOLD)
        .text("APPENDIX · DIAGRAM", { characterSpacing: 2 })
      doc.fillColor(C.navy).fontSize(20).font(FONT_BOLD)
        .text(sec.title)
      doc.moveTo(PAGE_MARGIN, doc.y + 2)
        .lineTo(PAGE_MARGIN + 40, doc.y + 2)
        .lineWidth(2).strokeColor(C.primary).stroke()
      doc.moveDown(0.6)
    }
    // Embed the SVG diagram if available
    if (sec.svg) {
      const svgPath = path.join(DOCS, sec.svg)
      if (fs.existsSync(svgPath)) {
        try {
          const svgContent = fs.readFileSync(svgPath, "utf8")
          const targetWidth = doc.page.width - 2 * PAGE_MARGIN
          // Make sure there's room; otherwise let the function paginate naturally
          SVGtoPDF(doc, svgContent, PAGE_MARGIN, doc.y, {
            width: targetWidth,
            preserveAspectRatio: "xMidYMid meet",
          })
          // Advance y heuristically — svg-to-pdfkit doesn't update doc.y reliably
          doc.y = Math.min(doc.y + targetWidth * 0.65, doc.page.height - PAGE_MARGIN - 40)
          doc.moveDown(0.5)
        } catch (err) {
          console.warn(`[defence-pdf] SVG render failed for ${sec.svg}:`, err.message)
        }
      }
    }
    const tokens = tokenise(md)
    renderTokens(doc, tokens, {})
  }

  pageFooters(doc)
  doc.end()

  await new Promise((resolve, reject) => {
    out.on("finish", resolve)
    out.on("error", reject)
  })

  const stats = fs.statSync(OUT)
  console.log(`[defence-pdf] Wrote ${OUT}`)
  console.log(`[defence-pdf] Size: ${(stats.size / 1024).toFixed(1)} KB`)
}

main().catch((e) => {
  console.error("[defence-pdf] Failed:", e)
  process.exit(1)
})
