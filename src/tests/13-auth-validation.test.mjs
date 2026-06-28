// ================================================
// Suite 13 — Auth Validation & IOC Detection Tests
// Run with: node src/tests/run-all.mjs 13
// =============================================

// ---------- IOC Type Detection (simulates lib/intel/fetchers/ioc.ts) ----------
function detectIOCType(value) {
  const v = value.trim()
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"
  if (/^[0-9a-fA-F]{32}$/.test(v)) return "hash" // MD5
  if (/^[0-9a-fA-F]{40}$/.test(v)) return "hash" // SHA1
  if (/^[0-9a-fA-F]{64}$/.test(v)) return "hash" // SHA256
  if (/^https?:\/\//i.test(v)) return "url"
  return "domain"
}

// ---------- Query Type Detection (simulates api/intel/correlate/route.ts) ----------
function detectQueryType(q) {
  const v = q.trim()
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return "cve"
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip"
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return "hash"
  if (/^https?:\/\//i.test(v)) return "url"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) && !v.includes(" ")) return "domain"
  return "keyword"
}

// ---------- Password Validation (simulates lib/validation.ts) ----------
function validatePassword(password) {
  const errors = []
  if (!password || typeof password !== "string") return { valid: false, errors: ["Password is required"] }
  if (password.length < 12) errors.push("Password must be at least 12 characters")
  if (!/[a-z]/.test(password)) errors.push("Password must contain lowercase letters")
  if (!/[A-Z]/.test(password)) errors.push("Password must contain uppercase letters")
  if (!/\d/.test(password)) errors.push("Password must contain numbers")
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("Password must contain special characters")
  return { valid: errors.length === 0, errors }
}

// ---------- Username Validation (simulates lib/validation.ts) ----------
function validateUsername(username) {
  const errors = []
  if (!username || typeof username !== "string") return { valid: false, errors: ["Username is required"] }
  if (username.length < 3 || username.length > 20) errors.push("Username must be 3-20 characters")
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) errors.push("Username can only contain letters, numbers, - and _")
  return { valid: errors.length === 0, errors }
}

// ---------- Email Validation ----------
function validateEmail(email) {
  if (!email || typeof email !== "string") return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (email.length > 254) return false
  return emailRegex.test(email)
}

// ---------- Entity Extraction (simulates lib/intel/entity-extractor.ts) ----------
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const DOMAIN_REGEX = /\b(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}\b/g

function extractEmails(text) {
  return (text.match(EMAIL_REGEX) || []).map(e => e.toLowerCase())
}

function extractIPs(text) {
  return (text.match(IP_REGEX) || []).filter(ip => {
    const parts = ip.split(".").map(Number)
    return parts.every(p => p >= 0 && p <= 255)
  })
}

function extractDomains(text) {
  const EMAIL_LIKE_PREFIXES = new Set(["http", "https", "www"])
  return (text.match(DOMAIN_REGEX) || []).filter(d => {
    const prefix = d.split(".")[0]
    return !EMAIL_LIKE_PREFIXES.has(prefix)
  })
}

// ================================================

const { suite, test, assert, assertEqual, summary } = await import("./helpers.mjs")

suite("Suite 13 — Auth Validation & IOC Detection")

// ── IOC Type Detection ──────────────────────────────────────────────────────────

test("13.1 detectIOCType: IPv4 → ip", () => {
  assertEqual(detectIOCType("8.8.8.8"), "ip")
  assertEqual(detectIOCType("192.168.1.1"), "ip")
  assertEqual(detectIOCType("10.0.0.1"), "ip")
})

test("13.2 detectIOCType: MD5/SHA1/SHA256 → hash", () => {
  assertEqual(detectIOCType("098f6bcd4621d373cade4e832627b4f6"), "hash") // MD5
  assertEqual(detectIOCType("a94a8fe5ccb19ba61c4c0873d391e987982fbbd3"), "hash") // SHA1
  assertEqual(detectIOCType("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"), "hash") // SHA256
})

test("13.3 detectIOCType: URL → url", () => {
  assertEqual(detectIOCType("https://evil.com/payload"), "url")
  assertEqual(detectIOCType("http://phishing.example.com"), "url")
})

test("13.4 detectIOCType: domain → domain", () => {
  assertEqual(detectIOCType("evil.com"), "domain")
  assertEqual(detectIOCType("malware.xyz"), "domain")
  assertEqual(detectIOCType("sub.domain.com"), "domain")
})

test("13.5 detectIOCType: whitespace / empty → domain (fallback)", () => {
  assertEqual(detectIOCType("   "), "domain")
  assertEqual(detectIOCType(""), "domain")
})

// ── Query Type Detection ────────────────────────────────────────────────────────

test("13.6 detectQueryType: CVE format → cve", () => {
  assertEqual(detectQueryType("CVE-2024-3094"), "cve")
  assertEqual(detectQueryType("cve-2021-44228"), "cve")
  assertEqual(detectQueryType("CVE-2023-0001"), "cve")
})

test("13.7 detectQueryType: keyword fallback for general text", () => {
  assertEqual(detectQueryType("ransomware attack"), "keyword")
  assertEqual(detectQueryType("log4j vulnerability"), "keyword")
})

// ── Password Validation ─────────────────────────────────────────────────────────

test("13.8 validatePassword: valid password passes all checks", () => {
  const result = validatePassword("SecurePass123!")
  assert(result.valid, `expected valid, got errors: ${result.errors.join(", ")}`)
})

test("13.9 validatePassword: < 12 chars → invalid", () => {
  const result = validatePassword("Short1!")
  assert(!result.valid)
  assert(result.errors.some(e => e.includes("12 characters")))
})

test("13.10 validatePassword: missing lowercase → invalid", () => {
  const result = validatePassword("UPPERCASE123!")
  assert(!result.valid)
  assert(result.errors.some(e => e.includes("lowercase")))
})

test("13.11 validatePassword: missing uppercase → invalid", () => {
  const result = validatePassword("lowercase123!")
  assert(!result.valid)
  assert(result.errors.some(e => e.includes("uppercase")))
})

test("13.12 validatePassword: missing number → invalid", () => {
  const result = validatePassword("NoNumbers!@")
  assert(!result.valid)
  assert(result.errors.some(e => e.includes("number")))
})

test("13.13 validatePassword: missing special char → invalid", () => {
  const result = validatePassword("NoSpecialChar123")
  assert(!result.valid)
  assert(result.errors.some(e => e.includes("special")))
})

test("13.14 validatePassword: empty → invalid", () => {
  const result = validatePassword("")
  assert(!result.valid)
})

test("13.15 validatePassword: null → invalid", () => {
  const result = validatePassword(null)
  assert(!result.valid)
})

// ── Username Validation ─────────────────────────────────────────────────────────

test("13.16 validateUsername: valid alphanumeric passes", () => {
  const result = validateUsername("john_doe")
  assert(result.valid, `expected valid, got: ${result.errors.join(", ")}`)
})

test("13.17 validateUsername: 3-20 chars required", () => {
  const short = validateUsername("ab")
  assert(!short.valid)
  const long = validateUsername("a".repeat(21))
  assert(!long.valid)
  const ok = validateUsername("validuser")
  assert(ok.valid)
})

test("13.18 validateUsername: only allowed chars (letters, numbers, -, _)", () => {
  const valid = validateUsername("user-name_123")
  assert(valid.valid)
  const invalid = validateUsername("bad user!")
  assert(!invalid.valid)
  const alsoBad = validateUsername("user@name")
  assert(!alsoBad.valid)
})

test("13.19 validateUsername: empty → invalid", () => {
  const result = validateUsername("")
  assert(!result.valid)
})

// ── Email Validation ────────────────────────────────────────────────────────────

test("13.20 validateEmail: valid emails pass", () => {
  assert(validateEmail("user@example.com"))
  assert(validateEmail("test.user@domain.co.uk"))
  assert(validateEmail("admin+tag@company.org"))
})

test("13.21 validateEmail: invalid emails rejected", () => {
  assert(!validateEmail("not-an-email"))
  assert(!validateEmail("@nodomain.com"))
  assert(!validateEmail("spaces in@email.com"))
  assert(!validateEmail(""))
  assert(!validateEmail(null))
})

// ── Entity Extraction ───────────────────────────────────────────────────────────

test("13.22 extractEmails: finds emails in text", () => {
  const emails = extractEmails("Contact attacker at hacker@evil.com or admin@malware.xyz")
  assertEqual(emails.length, 2)
  assert(emails.includes("hacker@evil.com"))
  assert(emails.includes("admin@malware.xyz"))
})

test("13.23 extractEmails: lowercases all emails", () => {
  const emails = extractEmails("Email: Test@Example.com and Admin@MALWARE.XYZ")
  assertEqual(emails.length, 2)
  assert(emails.includes("test@example.com"))
  assert(emails.includes("admin@malware.xyz"))
})

test("13.24 extractIPs: finds valid IPv4 addresses", () => {
  const ips = extractIPs("Server at 192.168.1.100, also 8.8.8.8 and 10.0.0.1")
  assertEqual(ips.length, 3)
  assert(ips.includes("192.168.1.100"))
  assert(ips.includes("8.8.8.8"))
})

test("13.25 extractIPs: rejects invalid octets", () => {
  const ips = extractIPs("256.1.1.1 is invalid, 192.168.1.1 is valid")
  assertEqual(ips.length, 1)
  assert(ips.includes("192.168.1.1"))
})

test("13.26 extractDomains: finds domains avoiding URL prefixes", () => {
  const domains = extractDomains("See evil.com malware site, not www.good.com")
  assert(domains.includes("evil.com"))
})

const allPassed = await summary()
process.exit(allPassed ? 0 : 1)
