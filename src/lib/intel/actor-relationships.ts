// ================================================
// Threat Actor Relationship Matrix
// Shows shared techniques, malware, sectors between actors
// ================================================
import { query } from "@/lib/db"

export interface ActorRelationship {
  actorA: string
  actorB: string
  sharedTechniques: string[]
  sharedMalware: string[]
  sharedSectors: string[]
  overlapScore: number
}

export interface ActorNode {
  name: string
  groupId: string
  aliases: string[]
  techniqueCount: number
  sectorCount: number
  campaignCount: number
}

export async function getActorRelationships(): Promise<{
  actors: ActorNode[]
  relationships: ActorRelationship[]
}> {
  const [mitreGroups, campaigns] = await Promise.all([
    query(
      `SELECT name, group_id, aliases, techniques, sectors
       FROM intel_mitre_groups
       ORDER BY name`,
      [],
    ),
    query(
      `SELECT campaign_id, campaign_name, threat_actor, techniques, malware_families, target_sectors, cves
       FROM intel_apt_campaigns
       ORDER BY campaign_name`,
      [],
    ),
  ])

  const actors: ActorNode[] = []
  const actorTechMap: Record<string, Set<string>> = {}
  const actorMalwareMap: Record<string, Set<string>> = {}
  const actorSectorMap: Record<string, Set<string>> = {}

  // From MITRE groups
  for (const g of mitreGroups.data || []) {
    const name = String(g.name)
    const techs: string[] = Array.isArray(g.techniques) ? g.techniques : []
    const sectors: string[] = Array.isArray(g.sectors) ? g.sectors : []
    const aliases: string[] = Array.isArray(g.aliases) ? g.aliases : []

    actors.push({
      name,
      groupId: String(g.group_id || ""),
      aliases,
      techniqueCount: techs.length,
      sectorCount: sectors.length,
      campaignCount: 0,
    })

    actorTechMap[name] = new Set(techs.map(String))
    actorMalwareMap[name] = new Set()
    actorSectorMap[name] = new Set(sectors.map(String))
  }

  // From APT campaigns
  for (const c of campaigns.data || []) {
    const actor = String(c.threat_actor || "")
    if (!actor) continue

    const techs: string[] = Array.isArray(c.techniques) ? c.techniques : []
    const malware: string[] = Array.isArray(c.malware_families) ? c.malware_families : []
    const sectors: string[] = Array.isArray(c.target_sectors) ? c.target_sectors : []

    if (!actorTechMap[actor]) {
      actorTechMap[actor] = new Set()
      actorMalwareMap[actor] = new Set()
      actorSectorMap[actor] = new Set()
    }

    for (const t of techs) actorTechMap[actor].add(String(t))
    for (const m of malware) actorMalwareMap[actor].add(String(m))
    for (const s of sectors) actorSectorMap[actor].add(String(s))

    // Update campaign count for matching actor
    const existing = actors.find(
      (a) => a.name.toLowerCase() === actor.toLowerCase() ||
        a.aliases.some((al) => al.toLowerCase() === actor.toLowerCase()),
    )
    if (existing) existing.campaignCount++
  }

  // Build relationships
  const actorNames = Object.keys(actorTechMap)
  const relationships: ActorRelationship[] = []

  for (let i = 0; i < actorNames.length; i++) {
    for (let j = i + 1; j < actorNames.length; j++) {
      const a = actorNames[i]
      const b = actorNames[j]

      const sharedTechs = [...actorTechMap[a]].filter((t) => actorTechMap[b].has(t))
      const sharedMal = [...(actorMalwareMap[a] || new Set())].filter((m) =>
        (actorMalwareMap[b] || new Set()).has(m),
      )
      const sharedSec = [...(actorSectorMap[a] || new Set())].filter((s) =>
        (actorSectorMap[b] || new Set()).has(s),
      )

      const overlapScore = sharedTechs.length * 3 + sharedMal.length * 5 + sharedSec.length * 2

      if (overlapScore > 0) {
        relationships.push({
          actorA: a,
          actorB: b,
          sharedTechniques: sharedTechs.slice(0, 10),
          sharedMalware: sharedMal,
          sharedSectors: sharedSec,
          overlapScore,
        })
      }
    }
  }

  return {
    actors: actors.sort((a, b) => b.techniqueCount - a.techniqueCount),
    relationships: relationships.sort((a, b) => b.overlapScore - a.overlapScore).slice(0, 50),
  }
}
