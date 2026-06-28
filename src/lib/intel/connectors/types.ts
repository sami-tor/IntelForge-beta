import type { EntityType } from "../entity-extractor"

export interface EnrichmentInput {
  type: EntityType
  value: string
}

export interface EnrichmentResult {
  connector: string
  findingType: string
  title: string
  description?: string
  confidence: number
  metadata: Record<string, unknown>
}

export interface IntelConnector {
  name: string
  enabled: boolean
  supports(type: EntityType): boolean
  enrich(input: EnrichmentInput): Promise<EnrichmentResult[]>
}
