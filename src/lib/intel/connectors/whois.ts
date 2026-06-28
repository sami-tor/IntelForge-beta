import type { EnrichmentInput, EnrichmentResult, IntelConnector } from "./types"

export const whoisConnector: IntelConnector = {
  name: "whois",
  enabled: Boolean(process.env.WHOIS_API_KEY),
  supports(type) {
    return type === "domain" || type === "ip"
  },
  async enrich(input: EnrichmentInput): Promise<EnrichmentResult[]> {
    if (!this.enabled) return []

    return [
      {
        connector: "whois",
        findingType: "whois_enrichment",
        title: `WHOIS enrichment queued for ${input.value}`,
        description: "WHOIS connector is configured. Add provider-specific API integration here.",
        confidence: 50,
        metadata: { providerConfigured: true, type: input.type, value: input.value },
      },
    ]
  },
}
