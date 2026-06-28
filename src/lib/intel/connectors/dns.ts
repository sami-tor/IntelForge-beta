import dns from "dns/promises"
import type { EnrichmentInput, EnrichmentResult, IntelConnector } from "./types"

export const dnsConnector: IntelConnector = {
  name: "dns",
  enabled: true,
  supports(type) {
    return type === "domain"
  },
  async enrich(input: EnrichmentInput): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = []
    const [aRecords, mxRecords, txtRecords] = await Promise.allSettled([
      dns.resolve4(input.value),
      dns.resolveMx(input.value),
      dns.resolveTxt(input.value),
    ])

    results.push({
      connector: "dns",
      findingType: "dns_enrichment",
      title: `DNS enrichment for ${input.value}`,
      confidence: 70,
      metadata: {
        a: aRecords.status === "fulfilled" ? aRecords.value : [],
        mx: mxRecords.status === "fulfilled" ? mxRecords.value : [],
        txt: txtRecords.status === "fulfilled" ? txtRecords.value : [],
      },
    })

    return results
  },
}
