export type EntityType =
  | "email"
  | "domain"
  | "ip"
  | "url"
  | "phone"
  | "username"
  | "crypto_wallet"
  | "keyword"
  | "brand"
  | "unknown"

export interface ExtractedEntity {
  type: EntityType
  value: string
  normalizedValue: string
  confidence: number
  metadata?: Record<string, unknown>
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g
const BTC_REGEX = /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b/g
const ETH_REGEX = /\b0x[a-fA-F0-9]{40}\b/g
const DOMAIN_REGEX = /\b(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}\b/g

const EMAIL_LIKE_PREFIXES = new Set(["http", "https", "www"])

function uniqueKey(entity: ExtractedEntity) {
  return `${entity.type}:${entity.normalizedValue}`
}

export function normalizeEntityValue(type: EntityType, value: string): string {
  const trimmed = value.trim().replace(/[),.;:!?]+$/g, "")

  switch (type) {
    case "email":
    case "domain":
    case "url":
    case "username":
    case "crypto_wallet":
    case "brand":
    case "keyword":
      return trimmed.toLowerCase()
    case "phone":
      return trimmed.replace(/[^+\d]/g, "")
    case "ip":
      return trimmed
    default:
      return trimmed.toLowerCase()
  }
}

function addEntity(map: Map<string, ExtractedEntity>, entity: ExtractedEntity) {
  if (!entity.value || entity.normalizedValue.length < 2) return
  map.set(uniqueKey(entity), entity)
}

export function extractEntities(text: string): ExtractedEntity[] {
  const entities = new Map<string, ExtractedEntity>()
  const input = text || ""

  for (const match of input.match(EMAIL_REGEX) || []) {
    addEntity(entities, {
      type: "email",
      value: match,
      normalizedValue: normalizeEntityValue("email", match),
      confidence: 95,
    })
  }

  for (const match of input.match(URL_REGEX) || []) {
    const cleaned = match.replace(/[),.;]+$/g, "")
    addEntity(entities, {
      type: "url",
      value: cleaned,
      normalizedValue: normalizeEntityValue("url", cleaned),
      confidence: 90,
    })

    try {
      const host = new URL(cleaned).hostname
      addEntity(entities, {
        type: "domain",
        value: host,
        normalizedValue: normalizeEntityValue("domain", host),
        confidence: 88,
        metadata: { extractedFromUrl: cleaned },
      })
    } catch {
      // Ignore malformed URLs that still matched the broad URL pattern.
    }
  }

  for (const match of input.match(IP_REGEX) || []) {
    addEntity(entities, {
      type: "ip",
      value: match,
      normalizedValue: normalizeEntityValue("ip", match),
      confidence: 90,
    })
  }

  for (const match of input.match(PHONE_REGEX) || []) {
    const normalizedValue = normalizeEntityValue("phone", match)
    if (normalizedValue.length >= 8) {
      addEntity(entities, {
        type: "phone",
        value: match,
        normalizedValue,
        confidence: 65,
      })
    }
  }

  for (const match of input.match(BTC_REGEX) || []) {
    addEntity(entities, {
      type: "crypto_wallet",
      value: match,
      normalizedValue: normalizeEntityValue("crypto_wallet", match),
      confidence: 80,
      metadata: { chain: "bitcoin" },
    })
  }

  for (const match of input.match(ETH_REGEX) || []) {
    addEntity(entities, {
      type: "crypto_wallet",
      value: match,
      normalizedValue: normalizeEntityValue("crypto_wallet", match),
      confidence: 90,
      metadata: { chain: "ethereum" },
    })
  }

  for (const match of input.match(DOMAIN_REGEX) || []) {
    const normalizedValue = normalizeEntityValue("domain", match)
    const prefix = normalizedValue.split(".")[0]
    if (!EMAIL_LIKE_PREFIXES.has(prefix) && !normalizedValue.includes("@")) {
      addEntity(entities, {
        type: "domain",
        value: match,
        normalizedValue,
        confidence: 70,
      })
    }
  }

  return Array.from(entities.values())
}

export function inferFindingType(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("password") || lower.includes("passwd") || lower.includes("pwd") || lower.split(":").length >= 3) {
    return "credential_exposure"
  }
  if (lower.includes("phish") || lower.includes("login") || lower.includes("verify account")) {
    return "phishing_indicator"
  }
  if (lower.includes("malware") || lower.includes("stealer") || lower.includes("ransom")) {
    return "malware_indicator"
  }
  return "indexed_exposure"
}
