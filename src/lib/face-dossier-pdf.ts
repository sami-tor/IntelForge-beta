import PDFDocument from "pdfkit"

interface DossierInput {
  title: string
  queryUrl?: string
  queryExif?: {
    make?: string
    model?: string
    dateTaken?: string
    gps?: { lat: number; lng: number }
    software?: string
    dimensions?: { width: number; height: number }
  }
  results: {
    face_id: string
    score: number
    identity_id?: string
    url?: string
    metadata?: {
      country?: string
      timestamp?: number
      source?: string
    }
    threads_profile?: {
      username?: string
      full_name?: string
      bio?: string
      profile_url?: string
      follower_count?: number
    }
    identity?: { id: number; name: string }
    intel?: {
      totalHits: number
      cves?: { cve_id: string; description: string; cvss_v3_severity: string }[]
      exploits?: { exploit_id: string; title: string }[]
      malware?: { sha256: string; malware_family: string }[]
      darknet?: { title: string; source: string }[]
      phishing?: { url: string; target_brand: string }[]
      actors?: { name: string }[]
    }
  }[]
}

export async function generateDossierPdf(dossier: DossierInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: dossier.title,
        Author: "IntelForge Face Search",
        Subject: "Face Investigation Dossier",
      },
    })

    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // ── Title Page ──
    doc.fontSize(28).font("Helvetica-Bold").text("Face Investigation Dossier", { align: "center" })
    doc.moveDown(0.5)
    doc.fontSize(14).font("Helvetica").text(dossier.title, { align: "center" })
    doc.moveDown(1)

    // Metadata
    doc.fontSize(10).font("Helvetica")
    const metaY = doc.y
    if (dossier.queryUrl) {
      doc.text(`Query URL: ${dossier.queryUrl}`)
    }
    if (dossier.queryExif) {
      const ex = dossier.queryExif
      if (ex.make) doc.text(`Camera: ${ex.make} ${ex.model || ""}`)
      if (ex.dateTaken) doc.text(`Date Taken: ${new Date(ex.dateTaken).toLocaleString()}`)
      if (ex.gps) doc.text(`GPS: ${ex.gps.lat.toFixed(4)}, ${ex.gps.lng.toFixed(4)}`)
      if (ex.software) doc.text(`Software: ${ex.software}`)
    }
    doc.text(`Generated: ${new Date().toLocaleString()}`)
    doc.text(`Total Results: ${dossier.results.length}`)
    doc.text(`Total Intel Hits: ${dossier.results.reduce((s, r) => s + (r.intel?.totalHits || 0), 0)}`)

    doc.moveDown(1)
    doc.fontSize(9).fillColor("#888")
    doc.text("CONFIDENTIAL — For Authorized Investigators Only", { align: "center" })

    // ── Results Pages ──
    for (let i = 0; i < dossier.results.length; i++) {
      const result = dossier.results[i]
      doc.addPage()

      // Header
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#000")
      doc.text(`Result ${i + 1} of ${dossier.results.length}`)
      doc.moveDown(0.3)

      // Score bar
      const scorePct = (result.score * 100).toFixed(1)
      doc.fontSize(10).font("Helvetica").fillColor("#333")
      doc.text(`Match Score: ${scorePct}%`)

      // Identity
      if (result.identity) {
        doc.fontSize(10).fillColor("#6B21A8").text(`Identity: ${result.identity.name}`)
      }

      // Identity ID
      if (result.identity_id) {
        doc.fontSize(9).fillColor("#555").text(`ID: ${result.identity_id}`)
      }

      // Face ID
      doc.fontSize(8).fillColor("#888").text(`Face ID: ${result.face_id}`)
      doc.moveDown(0.5)

      // Threads profile
      if (result.threads_profile) {
        const tp = result.threads_profile
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Threads Profile")
        doc.fontSize(9).font("Helvetica").fillColor("#333")
        if (tp.username) doc.text(`Username: @${tp.username}`)
        if (tp.full_name) doc.text(`Name: ${tp.full_name}`)
        if (tp.bio) doc.text(`Bio: ${tp.bio.substring(0, 200)}`)
        if (tp.follower_count !== undefined) doc.text(`Followers: ${tp.follower_count.toLocaleString()}`)
        if (tp.profile_url) doc.text(`URL: ${tp.profile_url}`)
        doc.moveDown(0.5)
      }

      // Metadata
      if (result.metadata) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Image Metadata")
        doc.fontSize(9).font("Helvetica").fillColor("#333")
        if (result.metadata.country) doc.text(`Country: ${result.metadata.country}`)
        if (result.metadata.source) doc.text(`Source: ${result.metadata.source}`)
        if (result.metadata.timestamp) {
          doc.text(`Date: ${new Date(result.metadata.timestamp * 1000).toLocaleString()}`)
        }
        doc.moveDown(0.5)
      }

      // Intel
      if (result.intel && result.intel.totalHits > 0) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text(`Intelligence (${result.intel.totalHits} hits)`)
        doc.fontSize(8).font("Helvetica").fillColor("#333")

        if (result.intel.cves?.length) {
          doc.text("CVEs:")
          result.intel.cves.slice(0, 5).forEach(c => {
            doc.text(`  - ${c.cve_id}: ${c.description?.substring(0, 100)} [${c.cvss_v3_severity || "N/A"}]`)
          })
        }
        if (result.intel.exploits?.length) {
          doc.text("Exploits:")
          result.intel.exploits.slice(0, 5).forEach(e => {
            doc.text(`  - ${e.exploit_id}: ${e.title?.substring(0, 100)}`)
          })
        }
        if (result.intel.malware?.length) {
          doc.text("Malware:")
          result.intel.malware.slice(0, 5).forEach(m => {
            doc.text(`  - ${m.sha256?.substring(0, 16)}... [${m.malware_family || "unknown"}]`)
          })
        }
        if (result.intel.darknet?.length) {
          doc.text("Darknet:")
          result.intel.darknet.slice(0, 5).forEach(d => {
            doc.text(`  - ${d.title?.substring(0, 100)} [${d.source}]`)
          })
        }
        if (result.intel.phishing?.length) {
          doc.text("Phishing:")
          result.intel.phishing.slice(0, 5).forEach(p => {
            doc.text(`  - ${p.url?.substring(0, 60)} [${p.target_brand}]`)
          })
        }
        if (result.intel.actors?.length) {
          doc.text("Threat Actors:")
          result.intel.actors.slice(0, 5).forEach(a => {
            doc.text(`  - ${a.name}`)
          })
        }
        doc.moveDown(0.5)
      }

      // URL
      if (result.url) {
        doc.fontSize(8).fillColor("#888").text(`Image: ${result.url.substring(0, 120)}`)
      }

      // Footer
      doc.fontSize(7).fillColor("#aaa")
      doc.text(`Page ${i + 2} — IntelForge Face Search Dossier — ${new Date().toISOString().split("T")[0]}`, {
        align: "center",
      })
    }

    doc.end()
  })
}
