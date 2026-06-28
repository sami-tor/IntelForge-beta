// ================================================
// Intel Hub - Certificate Transparency Domain Intel
// Source: crt.sh (free, no auth)
// ================================================
import { safeFetchJson, memGet, memSet } from "@/lib/intel/cache"
import { query } from "@/lib/db"
import type { CertItem } from "@/lib/intel/types"

const CRTSH_API = "https://crt.sh"

// ---- crt.sh API types ----
interface CrtShEntry {
  id: number
  issuer_name?: string
  common_name?: string
  name_value?: string
  serial_number?: string
  not_before?: string
  not_after?: string
  entry_timestamp?: string
  revoked?: boolean
}

// ---- Fetch certificates for a domain from crt.sh ----
async function fetchCrtShCerts(domain: string): Promise<CertItem[]> {
  // crt.sh returns JSON via API with special Accept header
  const data = await safeFetchJson<CrtShEntry[]>(
    `${CRTSH_API}/?q=${encodeURIComponent(domain)}&output=json&limit=50`,
    { headers: { "User-Agent": "IntelForge/1.0" } },
    20000,
  )
  if (!data || !Array.isArray(data)) return []

  return data.map((entry) => ({
    domain: entry.common_name || domain,
    issuer: entry.issuer_name,
    serialNumber: entry.serial_number,
    fingerprintSha256: entry.serial_number, // crt.sh free tier doesn't return sha256 in JSON
    notBefore: entry.not_before,
    notAfter: entry.not_after,
    subjectAltNames: entry.name_value ? entry.name_value.split("\n") : undefined,
    wildcard: (entry.common_name || "").startsWith("*."),
    revoked: Boolean(entry.revoked),
    crtShId: entry.id,
    loggedAt: entry.entry_timestamp || new Date().toISOString(),
  }))
}

// ---- Store to DB ----
async function storeCerts(items: CertItem[]): Promise<number> {
  let stored = 0
  for (const c of items) {
    const result = await query(
      `INSERT INTO intel_cert_cache
         (domain, issuer, serial_number, fingerprint_sha256, not_before, not_after,
          subject_alt_names, wildcard, revoked, crt_sh_id, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (crt_sh_id) DO UPDATE SET
         domain=EXCLUDED.domain,
         not_after=EXCLUDED.not_after,
         revoked=EXCLUDED.revoked,
         fetched_at=NOW()`,
      [
        c.domain, c.issuer || null, c.serialNumber || null, c.fingerprintSha256 || null,
        c.notBefore || null, c.notAfter || null, c.subjectAltNames || null,
        c.wildcard, c.revoked, c.crtShId || null, c.loggedAt,
      ],
    )
    if (result.success) stored++
  }
  return stored
}

// ---- Read from DB ----
export async function getCertsFromDb(
  domain: string,
  limit = 50,
): Promise<CertItem[]> {
  const result = await query(
    `SELECT domain, issuer, serial_number, fingerprint_sha256, not_before, not_after,
            subject_alt_names, wildcard, revoked, crt_sh_id, logged_at
     FROM intel_cert_cache
     WHERE domain = $1 OR $1 = ANY(subject_alt_names)
     ORDER BY logged_at DESC NULLS LAST
     LIMIT $2`,
    [domain, limit],
  )

  if (!result.success || !result.data) return []

  return result.data.map((row: Record<string, unknown>) => ({
    domain: row.domain as string,
    issuer: row.issuer as string | undefined,
    serialNumber: row.serial_number as string | undefined,
    fingerprintSha256: row.fingerprint_sha256 as string | undefined,
    notBefore: row.not_before ? String(row.not_before) : undefined,
    notAfter: row.not_after ? String(row.not_after) : undefined,
    subjectAltNames: row.subject_alt_names as string[] | undefined,
    wildcard: Boolean(row.wildcard),
    revoked: Boolean(row.revoked),
    crtShId: row.crt_sh_id ? Number(row.crt_sh_id) : undefined,
    loggedAt: String(row.logged_at || ""),
  }))
}

// ---- Search subdomains from cert SANs ----
export async function discoverSubdomainsFromCerts(domain: string): Promise<string[]> {
  const certs = await getCertsFromDb(domain, 50)
  const subdomains = new Set<string>()

  for (const cert of certs) {
    if (cert.subjectAltNames) {
      for (const san of cert.subjectAltNames) {
        const trimmed = san.trim().toLowerCase()
        if (trimmed.includes(domain) && trimmed !== domain && !trimmed.startsWith("*")) {
          subdomains.add(trimmed)
        }
      }
    }
  }

  return Array.from(subdomains).slice(0, 100)
}

// ---- Main lookup ----
export async function lookupCertTransparency(
  domain: string,
): Promise<{ certs: CertItem[]; subdomains: string[] }> {
  const cacheKey = `intel:cert:${domain}`
  const cached = memGet<{ certs: CertItem[]; subdomains: string[] }>(cacheKey)
  if (cached) return cached

  // Check DB first
  let certs = await getCertsFromDb(domain, 50)

  // If stale or empty, fetch fresh
  if (certs.length === 0) {
    const fresh = await fetchCrtShCerts(domain)
    if (fresh.length > 0) {
      await storeCerts(fresh)
      certs = fresh
    }
  }

  const subdomains = await discoverSubdomainsFromCerts(domain)

  const result = { certs, subdomains }
  memSet(cacheKey, result, 6 * 3600) // 6 hour TTL

  return result
}
