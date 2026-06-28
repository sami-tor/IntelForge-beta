/**
 * SIEM Formatters: CEF (Common Event Format) and LEEF (Log Event Extended Format)
 * Used for integration with Splunk, QRadar, ArcSight, etc.
 */

export type SiemFormat = "cef" | "leef"

export interface SiemEventData {
  signatureId: string
  name: string
  severity: string  // 'info'|'low'|'medium'|'high'|'critical'
  sourceService: string
  sourceHost?: string
  sourceIp?: string
  destinationHost?: string
  deviceAction?: string
  category?: string
  outcome?: string
  extensions: Record<string, string>
}

function escapeCefField(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/=/g, "\\=")
}

function escapeLeefValue(value: string): string {
  return value.replace(/\t/g, "\\t").replace(/\|/g, "\\|")
}

function severityToCef(severity: string): string {
  const map: Record<string, string> = {
    info: "0", low: "3", medium: "5", high: "7", critical: "10",
  }
  return map[severity] || "5"
}

function severityToLeef(severity: string): string {
  const map: Record<string, string> = {
    info: "1", low: "3", medium: "5", high: "7", critical: "9",
  }
  return map[severity] || "5"
}

/**
 * Format a SIEM event as CEF (ArcSight Common Event Format)
 * Format: CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
 */
export function formatCef(event: SiemEventData): string {
  const header = [
    "CEF:0",
    "IntelForge",
    "FaceSearch Platform",
    "1.0",
    event.signatureId,
    event.name,
    severityToCef(event.severity),
  ].join("|")

  const extFields: Record<string, string> = {
    ...event.extensions,
    src: event.sourceIp || event.sourceHost || "",
    dst: event.destinationHost || "",
    act: event.deviceAction || "",
    cat: event.category || "",
    outcome: event.outcome || "",
    externalId: event.signatureId,
    rt: new Date().toISOString(),
    cs1Label: "sourceService",
    cs1: event.sourceService,
  }

  const extension = Object.entries(extFields)
    .filter(([_, v]) => v !== "")
    .map(([k, v]) => `${k}=${escapeCefField(v)}`)
    .join(" ")

  return `${header}|${extension}`
}

/**
 * Format a SIEM event as LEEF (IBM QRadar Log Event Extended Format)
 * Format: LEEF:2.0|Vendor|Product|Version|EventID|attributes
 */
export function formatLeef(event: SiemEventData): string {
  const header = [
    "LEEF:2.0",
    "IntelForge",
    "FaceSearch",
    "1.0",
    event.signatureId,
  ].join("|")

  const attributes: Record<string, string> = {
    ...event.extensions,
    sev: severityToLeef(event.severity),
    cat: event.category || "Security",
    devTime: new Date().toISOString(),
    src: event.sourceIp || "",
    dst: event.destinationHost || "",
    action: event.deviceAction || "",
    outcome: event.outcome || "",
   sevName: event.severity,
    srcSvc: event.sourceService,
    msg: event.name,
  }

  const attrString = Object.entries(attributes)
    .filter(([_, v]) => v !== "")
    .map(([k, v]) => `${k}=${escapeLeefValue(v)}`)
    .join("\t")

  return `${header}\t${attrString}`
}

export function alertToSiemEvent(alert: {
  id: number; title: string; description: string; severity: string;
  item_type: string; item_value: string; source_info?: any
}): SiemEventData {
  return {
    signatureId: `IF-ALERT-${alert.id}`,
    name: alert.title,
    severity: alert.severity,
    sourceService: "IntelForge Monitoring",
    sourceHost: alert.source_info?.host || undefined,
    sourceIp: alert.source_info?.ip || undefined,
    deviceAction: "Alert",
    category: alert.item_type,
    outcome: "Detected",
    extensions: {
      itemType: alert.item_type,
      itemValue: alert.item_value,
      description: alert.description.substring(0, 1023),
    },
  }
}

export function searchResultToSiemEvent(result: {
  id?: string; face_id?: string; score?: number; identity?: { name?: string }
}): SiemEventData {
  return {
    signatureId: `IF-SEARCH-${result.face_id || result.id || Date.now()}`,
    name: `Face search match: ${result.identity?.name || result.face_id || "Unknown"}`,
    severity: (result.score || 0) > 0.85 ? "high" : (result.score || 0) > 0.7 ? "medium" : "low",
    sourceService: "IntelForge Face Search",
    deviceAction: "Match",
    category: "identity",
    outcome: "Matched",
    extensions: {
      faceId: result.face_id || "",
      score: String(result.score || 0),
      identity: result.identity?.name || "",
    },
  }
}
