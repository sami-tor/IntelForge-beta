// ================================================
// Intel Hub - MITRE ATT&CK
// Source: GitHub MITRE/CTI (free, no auth)
// Full STIX bundle: enterprise-attack
// ================================================
import { safeFetchJson, memGet, memSet, TTL } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { MitreGroup, MitreTechnique, MitreTactic } from "@/lib/intel/types"

const MITRE_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

// ---- STIX object types ----
interface STIXBundle {
  objects: STIXObject[]
}

interface STIXObject {
  type: string
  id: string
  name?: string
  description?: string
  aliases?: string[]
  external_references?: { source_name: string; external_id?: string; url?: string }[]
  kill_chain_phases?: { phase_name: string }[]
  x_mitre_platforms?: string[]
  x_mitre_detection?: string
  x_mitre_is_subtechnique?: boolean
  x_mitre_deprecated?: boolean
  revoked?: boolean
  modified?: string
  relationship_type?: string
  source_ref?: string
  target_ref?: string
  object_marking_refs?: string[]
}

// ---- Parse STIX bundle ----
function parseSTIX(bundle: STIXBundle): {
  groups: MitreGroup[]
  techniques: MitreTechnique[]
  tactics: MitreTactic[]
} {
  const objects = bundle.objects || []

  // Index all objects by id
  const byId = new Map<string, STIXObject>()
  for (const obj of objects) byId.set(obj.id, obj)

  // Extract groups (intrusion-set)
  const groups: MitreGroup[] = objects
    .filter((o) => o.type === "intrusion-set" && !o.revoked && !o.x_mitre_deprecated)
    .map((o) => {
      const extRef = (o.external_references || []).find((r) => r.source_name === "mitre-attack")
      return {
        stixId: o.id,
        name: o.name || "Unknown",
        groupId: extRef?.external_id,
        aliases: o.aliases,
        description: o.description?.slice(0, 1000),
        url: extRef?.url,
        techniques: [],
        software: [],
        sectors: [],
        countries: [],
      }
    })

  // Extract techniques (attack-pattern)
  const techniques: MitreTechnique[] = objects
    .filter((o) => o.type === "attack-pattern" && !o.revoked && !o.x_mitre_deprecated)
    .map((o) => {
      const extRef = (o.external_references || []).find((r) => r.source_name === "mitre-attack")
      const tactics = (o.kill_chain_phases || []).map((p) => p.phase_name)
      const isSubtech = o.x_mitre_is_subtechnique === true

      // Get parent technique ID for sub-techniques (T1234.001 → T1234)
      const fullId = extRef?.external_id || ""
      const parentId = isSubtech && fullId.includes(".") ? fullId.split(".")[0] : undefined

      return {
        stixId: o.id,
        techniqueId: fullId,
        name: o.name || "Unknown",
        description: o.description?.slice(0, 2000),
        tactic: tactics,
        platforms: o.x_mitre_platforms,
        detection: o.x_mitre_detection?.slice(0, 500),
        url: extRef?.url,
        isSubtechnique: isSubtech,
        parentTechniqueId: parentId,
      }
    })

  // Extract tactics (x-mitre-tactic)
  const tacticMap = new Map<string, { name: string; description?: string }>()
  for (const obj of objects) {
    if (obj.type === "x-mitre-tactic") {
      const extRef = (obj.external_references || []).find((r) => r.source_name === "mitre-attack")
      const id = extRef?.external_id || obj.id
      tacticMap.set(id, { name: obj.name || id, description: obj.description?.slice(0, 300) })
    }
  }

  // Group techniques by tactic
  const tacticTechniques = new Map<string, MitreTechnique[]>()
  for (const tech of techniques) {
    for (const tactic of tech.tactic || []) {
      if (!tacticTechniques.has(tactic)) tacticTechniques.set(tactic, [])
      tacticTechniques.get(tactic)!.push(tech)
    }
  }

  const tactics: MitreTactic[] = []
  for (const [phaseName, info] of tacticMap.entries()) {
    tactics.push({
      id: phaseName,
      name: info.name,
      description: info.description,
      techniques: (tacticTechniques.get(info.name.toLowerCase().replace(/\s+/g, "-")) || []).filter(
        (t) => !t.isSubtechnique,
      ),
    })
  }

  // Link techniques to groups via relationships
  const groupTechMap = new Map<string, Set<string>>()
  for (const obj of objects) {
    if (obj.type === "relationship" && obj.relationship_type === "uses") {
      const src = byId.get(obj.source_ref || "")
      const tgt = byId.get(obj.target_ref || "")
      if (src?.type === "intrusion-set" && tgt?.type === "attack-pattern") {
        if (!groupTechMap.has(obj.source_ref!)) groupTechMap.set(obj.source_ref!, new Set())
        const extRef = (tgt.external_references || []).find((r) => r.source_name === "mitre-attack")
        if (extRef?.external_id) groupTechMap.get(obj.source_ref!)!.add(extRef.external_id)
      }
    }
  }

  for (const g of groups) {
    g.techniques = [...(groupTechMap.get(g.stixId) || [])].slice(0, 50)
  }

  return { groups, techniques, tactics }
}

// ---- Store to DB ----
async function storeGroups(groups: MitreGroup[]): Promise<void> {
  for (const g of groups) {
    await query(
      `INSERT INTO intel_mitre_groups
         (stix_id, name, aliases, description, group_id, url, techniques, software, sectors, countries)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (stix_id) DO UPDATE SET
         name=EXCLUDED.name, aliases=EXCLUDED.aliases,
         description=EXCLUDED.description, url=EXCLUDED.url,
         techniques=EXCLUDED.techniques, fetched_at=NOW()`,
      [
        g.stixId, g.name, g.aliases || null, g.description || null,
        g.groupId || null, g.url || null, g.techniques || null,
        g.software || null, g.sectors || null, g.countries || null,
      ],
    )
  }
}

async function storeTechniques(techniques: MitreTechnique[]): Promise<void> {
  for (const t of techniques) {
    await query(
      `INSERT INTO intel_mitre_techniques
         (stix_id, technique_id, name, description, tactic, platforms,
          detection, url, is_subtechnique, parent_technique_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (stix_id) DO UPDATE SET
         name=EXCLUDED.name, description=EXCLUDED.description,
         tactic=EXCLUDED.tactic, platforms=EXCLUDED.platforms,
         detection=EXCLUDED.detection, fetched_at=NOW()`,
      [
        t.stixId, t.techniqueId, t.name, t.description || null,
        t.tactic || null, t.platforms || null, t.detection || null,
        t.url || null, t.isSubtechnique, t.parentTechniqueId || null,
      ],
    )
  }
}

// ---- Read from DB ----
export async function getMitreGroupsFromDb(limit = 100, search?: string): Promise<MitreGroup[]> {
  const params: (string | number)[] = [limit]
  let where = ""
  if (search) {
    params.push(`%${search}%`)
    where = `WHERE name ILIKE $2 OR aliases::text ILIKE $2`
  }

  const result = await query(
    `SELECT stix_id, name, aliases, description, group_id, url, techniques, software, sectors, countries
     FROM intel_mitre_groups ${where}
     ORDER BY name ASC LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []
  return result.data.map((row: Record<string, unknown>) => ({
    stixId: row.stix_id as string,
    name: row.name as string,
    groupId: row.group_id as string | undefined,
    aliases: row.aliases as string[] | undefined,
    description: row.description as string | undefined,
    url: row.url as string | undefined,
    techniques: row.techniques as string[] | undefined,
    software: row.software as string[] | undefined,
    sectors: row.sectors as string[] | undefined,
    countries: row.countries as string[] | undefined,
  }))
}

export async function getMitreTechniquesFromDb(
  limit = 100,
  tactic?: string,
  search?: string,
): Promise<MitreTechnique[]> {
  const conditions = ["is_subtechnique = false"]
  const params: (string | number | boolean)[] = [limit]

  if (tactic) {
    params.push(tactic)
    conditions.push(`$${params.length} = ANY(tactic)`)
  }
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(name ILIKE $${params.length} OR technique_id ILIKE $${params.length})`)
  }

  const result = await query(
    `SELECT stix_id, technique_id, name, description, tactic, platforms,
            detection, url, is_subtechnique, parent_technique_id
     FROM intel_mitre_techniques
     WHERE ${conditions.join(" AND ")}
     ORDER BY technique_id ASC LIMIT $1`,
    params,
  )

  if (!result.success || !result.data) return []
  return result.data.map((row: Record<string, unknown>) => ({
    stixId: row.stix_id as string,
    techniqueId: row.technique_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    tactic: row.tactic as string[] | undefined,
    platforms: row.platforms as string[] | undefined,
    detection: row.detection as string | undefined,
    url: row.url as string | undefined,
    isSubtechnique: Boolean(row.is_subtechnique),
    parentTechniqueId: row.parent_technique_id as string | undefined,
  }))
}

// ---- Main sync ----
export async function fetchAndSyncMitre(): Promise<{ fetched: number; stored: number }> {
  const bundle = await safeFetchJson<STIXBundle>(MITRE_URL, {
    headers: { "User-Agent": "IntelForge/1.0" },
  }, 60000) // 60s timeout - file is large

  if (!bundle) return { fetched: 0, stored: 0 }

  const { groups, techniques } = parseSTIX(bundle)

  await storeGroups(groups)
  await storeTechniques(techniques)

  // Cache
  memSet("intel:mitre:groups", groups, TTL.MITRE)
  memSet("intel:mitre:techniques", techniques, TTL.MITRE)

  return { fetched: groups.length + techniques.length, stored: groups.length + techniques.length }
}

// ---- Public API ----
export async function getMitreGroups(limit = 100, search?: string): Promise<MitreGroup[]> {
  const cacheKey = `intel:mitre:groups:${search || "all"}:${limit}`
  const cached = memGet<MitreGroup[]>(cacheKey)
  if (cached) return cached

  let groups = await getMitreGroupsFromDb(limit, search)
  if (groups.length === 0 && !search) {
    await fetchAndSyncMitre()
    groups = await getMitreGroupsFromDb(limit, search)
  }

  memSet(cacheKey, groups, TTL.MITRE)
  return groups
}

export async function getMitreTechniques(
  limit = 100,
  tactic?: string,
  search?: string,
): Promise<MitreTechnique[]> {
  const cacheKey = `intel:mitre:tech:${tactic || "all"}:${search || "all"}:${limit}`
  const cached = memGet<MitreTechnique[]>(cacheKey)
  if (cached) return cached

  let techniques = await getMitreTechniquesFromDb(limit, tactic, search)
  if (techniques.length === 0 && !tactic && !search) {
    await fetchAndSyncMitre()
    techniques = await getMitreTechniquesFromDb(limit, tactic, search)
  }

  memSet(cacheKey, techniques, TTL.MITRE)
  return techniques
}
