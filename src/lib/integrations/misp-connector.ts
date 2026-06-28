/**
 * MISP (Malware Information Sharing Platform) Connector
 * Push/pull threat intel to/from MISP instances
 */

export interface MispConfig {
  baseUrl: string
  apiKey: string
  verifySsl: boolean
  defaultTags: string[]
  autoPublish: boolean
  sharingGroupId?: number
}

export interface MispEventInput {
  info: string
  distribution?: number  // 0=org, 1=community, 2=connected, 3=all
  threat_level_id?: number  // 1=high, 2=medium, 3=low, 4=undefined
  analysis?: number  // 0=initial, 1=ongoing, 2=completed
  published?: boolean
  tags?: string[]
  attributes?: MispAttributeInput[]
}

export interface MispAttributeInput {
  type: string  // 'ip-dst','domain','url','email','md5','sha256','comment','text', etc.
  category: string  // 'Network activity','Payload delivery','External analysis', etc.
  value: string
  comment?: string
  to_ids?: boolean
  distribution?: number
}

export function createMispEventFromAlert(
  alert: { title: string; description: string; severity: string; item_type: string; item_value: string },
  config: MispConfig
): MispEventInput {
  const threatLevelMap: Record<string, number> = { critical: 1, high: 1, medium: 2, low: 3 }
  const attributeTypeMap: Record<string, string> = {
    email: "email",
    domain: "domain",
    ip: "ip-dst",
    hash: "sha256",
  }

  return {
    info: `[IntelForge] ${alert.title}`,
    distribution: 1,
    threat_level_id: threatLevelMap[alert.severity] || 3,
    analysis: 0,
    published: config.autoPublish,
    tags: [...config.defaultTags, "intelforge", `severity:${alert.severity}`],
    attributes: [
      {
        type: attributeTypeMap[alert.item_type] || "text",
        category: "External analysis",
        value: alert.item_value,
        comment: `Detected by IntelForge monitoring. ${alert.description}`,
        to_ids: true,
      },
      {
        type: "comment",
        category: "External analysis",
        value: `Alert ID: ${(alert as any).id || "N/A"}. Source: IntelForge`,
        comment: "Internal tracking reference",
      },
    ],
  }
}

export async function pushToMisp(
  event: MispEventInput,
  config: MispConfig
): Promise<{ success: boolean; mispEventId?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Authorization": config.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    }

    const res = await fetch(`${config.baseUrl}/events/add`, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      return { success: false, error: `MISP responded ${res.status}: ${errBody}` }
    }

    const result = await res.json()
    const mispEventId = result?.Event?.id
    return { success: true, mispEventId }
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to connect to MISP" }
  }
}

export async function testMispConnection(config: MispConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${config.baseUrl}/servers/getVersion`, {
      headers: { "Authorization": config.apiKey, "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { success: false, error: `MISP returned ${res.status}` }
    }
    const data = await res.json()
    return { success: true, error: undefined }
  } catch (error: any) {
    return { success: false, error: error.message || "Connection failed" }
  }
}
