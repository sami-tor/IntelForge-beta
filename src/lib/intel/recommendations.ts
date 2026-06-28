import type { EntityType } from "./entity-extractor"

export interface RecommendationContext {
  findingType?: string
  severity?: string
  entityType?: EntityType
  value?: string
}

const BASE_ACTIONS = [
  "Validate the evidence source and confirm whether the exposure is current.",
  "Record the finding in a case and assign an owner for remediation tracking.",
]

const FINDING_ACTIONS: Record<string, string[]> = {
  credential_exposure: [
    "Force password reset for affected accounts and revoke active sessions.",
    "Rotate any exposed API keys, tokens, or service credentials immediately.",
    "Review authentication logs for suspicious access after the first exposure time.",
    "Enable or enforce MFA for affected users.",
  ],
  phishing_indicator: [
    "Block the phishing domain or URL at email, DNS, and web gateway controls.",
    "Search mailboxes and proxy logs for users who accessed the indicator.",
    "Prepare user advisory guidance if the campaign targets the organization.",
  ],
  malware_indicator: [
    "Submit related hashes, URLs, domains, or IPs to endpoint and network blocklists.",
    "Hunt endpoint telemetry for matching process, file, and network activity.",
    "Isolate affected hosts if matching activity is confirmed.",
  ],
  exposed_infrastructure: [
    "Confirm whether the exposed host or service belongs to the organization.",
    "Restrict public access and verify firewall/security-group rules.",
    "Run a vulnerability review for the exposed service version.",
  ],
  indexed_exposure: [
    "Triage the evidence and classify whether it contains sensitive business data.",
    "Add high-value entities from this finding to continuous monitoring.",
  ],
}

const ENTITY_ACTIONS: Partial<Record<EntityType, string[]>> = {
  email: ["Check whether the mailbox appears in credential, phishing, or breach findings."],
  domain: ["Review DNS, WHOIS, certificates, and passive sightings for suspicious changes."],
  ip: ["Check reputation, geolocation, ASN, and recent communication with internal assets."],
  url: ["Capture a safe screenshot or sandbox verdict before analyst interaction."],
  crypto_wallet: ["Review blockchain activity and cluster links before engaging externally."],
  brand: ["Monitor lookalike domains, phishing pages, and social impersonation."],
}

export function getRecommendedActions(context: RecommendationContext): string[] {
  const actions = new Set<string>()
  for (const action of BASE_ACTIONS) actions.add(action)

  if (context.findingType) {
    for (const action of FINDING_ACTIONS[context.findingType] || []) actions.add(action)
  }

  if (context.entityType) {
    for (const action of ENTITY_ACTIONS[context.entityType] || []) actions.add(action)
  }

  if (context.severity === "critical" || context.severity === "high") {
    actions.add("Escalate to the incident response owner and define a remediation SLA.")
  }

  return Array.from(actions)
}
