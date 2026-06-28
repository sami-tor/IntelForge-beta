export type DemoDocType =
  | "phishing"
  | "malware"
  | "cve"
  | "ioc"
  | "ransomware_post"
  | "forum_post"
  | "cloud_exposure"
  | "scan_output"
  | "database_schema"
  | "ulp_redacted"
  | "stealer_redacted"
  | "apt_report"
  | "source_run"

export interface DemoDoc {
  id: string
  timestamp: string
  doc_type: DemoDocType
  source_name: string
  source_kind: "synthetic"
  title: string
  summary: string
  body: string
  severity: "low" | "medium" | "high" | "critical"
  risk_score: number
  confidence: number
  tlp: "TLP:CLEAR"
  tags: string[]
  entities: Array<{ type: string; value: string }>
  iocs: Array<{ type: string; value: string }>
  relationships: Array<{ type: string; value: string; target_type?: string; target_value?: string }>
  raw_reference: Record<string, any>
  safe_demo: true
  redaction_level: "synthetic" | "masked" | "schema_only"
}

const baseTime = new Date("2026-05-09T10:00:00Z").getTime()
const iso = (offsetMinutes: number) => new Date(baseTime + offsetMinutes * 60_000).toISOString()

export function buildDemoCorpus(): DemoDoc[] {
  return [
    {
      id: "demo-evt-0001",
      timestamp: iso(0),
      doc_type: "phishing",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic phishing page impersonates ExampleBank",
      summary: "Phishing kit targets ExampleBank credentials.",
      body: "Observed phishing URL hxxps://secure-examplebank-login[.]com/login targeting ExampleBank users. Hosting IP 203.0.113.45. Sender noreply@examplebank-security[.]com.",
      severity: "high",
      risk_score: 82,
      confidence: 90,
      tlp: "TLP:CLEAR",
      tags: ["demo", "phishing", "credential-harvesting"],
      entities: [
        { type: "domain", value: "secure-examplebank-login.com" },
        { type: "ip", value: "203.0.113.45" },
        { type: "brand", value: "ExampleBank" },
        { type: "email", value: "noreply@examplebank-security.com" },
      ],
      iocs: [
        { type: "url", value: "hxxps://secure-examplebank-login[.]com/login" },
        { type: "domain", value: "secure-examplebank-login.com" },
        { type: "ip", value: "203.0.113.45" },
      ],
      relationships: [{ type: "impersonates", value: "ExampleBank" }],
      raw_reference: { note: "synthetic demo only" },
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0002",
      timestamp: iso(10),
      doc_type: "ulp_redacted",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Redacted credential exposure pattern for ExampleCRM",
      summary: "ULP-style record with placeholder password only.",
      body: "Synthetic ULP-style record observed: url=https://crm.example.com/login username=analyst@example.test password=<REDACTED_DEMO_PASSWORD>. No real credentials present.",
      severity: "medium",
      risk_score: 55,
      confidence: 85,
      tlp: "TLP:CLEAR",
      tags: ["demo", "ulp", "redacted"],
      entities: [
        { type: "domain", value: "crm.example.com" },
        { type: "email", value: "analyst@example.test" },
        { type: "organization", value: "ExampleCRM" },
      ],
      iocs: [{ type: "url", value: "https://crm.example.com/login" }],
      relationships: [{ type: "login_portal", value: "ExampleCRM" }],
      raw_reference: { password: "<REDACTED_DEMO_PASSWORD>" },
      safe_demo: true,
      redaction_level: "masked",
    },
    {
      id: "demo-evt-0003",
      timestamp: iso(20),
      doc_type: "stealer_redacted",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic stealer telemetry references finance portal",
      summary: "Redacted stealer-style log with safe placeholders.",
      body: "Demo stealer telemetry claims host DESKTOP-DEMO01 accessed finance.example.com. Credential fields and browser cookies are redacted. Malware family: RedLine-like demo. C2: c2-demo[.]invalid.",
      severity: "high",
      risk_score: 78,
      confidence: 88,
      tlp: "TLP:CLEAR",
      tags: ["demo", "stealer", "redacted"],
      entities: [
        { type: "host", value: "DESKTOP-DEMO01" },
        { type: "domain", value: "finance.example.com" },
        { type: "domain", value: "c2-demo.invalid" },
        { type: "malware", value: "RedLine-like demo" },
      ],
      iocs: [
        { type: "domain", value: "c2-demo.invalid" },
        { type: "sha256", value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      ],
      relationships: [{ type: "communicates_with", value: "c2-demo.invalid" }],
      raw_reference: { browser_passwords: "<REDACTED>", cookies: "<REDACTED>" },
      safe_demo: true,
      redaction_level: "masked",
    },
    {
      id: "demo-evt-0004",
      timestamp: iso(30),
      doc_type: "database_schema",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic exposed PostgreSQL schema for demo tenant",
      summary: "Schema-only database exposure.",
      body: "Demo scan found unauthenticated PostgreSQL banner on db-demo.example.net. Schema names observed: users, invoices, audit_logs. No row data collected.",
      severity: "high",
      risk_score: 74,
      confidence: 92,
      tlp: "TLP:CLEAR",
      tags: ["demo", "database", "schema-only"],
      entities: [
        { type: "domain", value: "db-demo.example.net" },
        { type: "ip", value: "203.0.113.88" },
        { type: "technology", value: "PostgreSQL" },
      ],
      iocs: [],
      relationships: [{ type: "exposes", value: "database schema" }],
      raw_reference: { rows_collected: 0, note: "schema-only synthetic demo" },
      safe_demo: true,
      redaction_level: "schema_only",
    },
    {
      id: "demo-evt-0005",
      timestamp: iso(40),
      doc_type: "cve",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "CVE-2026-10001 exploited by demo actor",
      summary: "Synthetic advisory linking CVE to actor and malware.",
      body: "Synthetic advisory: CVE-2026-10001 affects ExampleVPN Gateway. Exploit activity linked to actor DEMO-APT-01 and malware DemoLoader.",
      severity: "critical",
      risk_score: 95,
      confidence: 96,
      tlp: "TLP:CLEAR",
      tags: ["demo", "cve", "exploit"],
      entities: [
        { type: "cve", value: "CVE-2026-10001" },
        { type: "product", value: "ExampleVPN Gateway" },
        { type: "actor", value: "DEMO-APT-01" },
        { type: "malware", value: "DemoLoader" },
      ],
      iocs: [],
      relationships: [{ type: "exploits", value: "CVE-2026-10001" }],
      raw_reference: {},
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0006",
      timestamp: iso(50),
      doc_type: "malware",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "DemoLoader malware sample communicates with c2-demo.invalid",
      summary: "Malware sample with synthetic hash and C2.",
      body: "Synthetic malware report: DemoLoader SHA256 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa contacts c2-demo[.]invalid over HTTPS.",
      severity: "high",
      risk_score: 88,
      confidence: 93,
      tlp: "TLP:CLEAR",
      tags: ["demo", "malware", "c2"],
      entities: [
        { type: "malware", value: "DemoLoader" },
        { type: "domain", value: "c2-demo.invalid" },
        { type: "actor", value: "DEMO-APT-01" },
      ],
      iocs: [
        { type: "sha256", value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        { type: "domain", value: "c2-demo.invalid" },
      ],
      relationships: [{ type: "communicates_with", value: "c2-demo.invalid" }],
      raw_reference: {},
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0007",
      timestamp: iso(60),
      doc_type: "ransomware_post",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic ransomware leak notice mentions Example Manufacturing",
      summary: "Leak notice with synthetic victim references.",
      body: "Demo ransomware group MOCKLOCK claims access to Example Manufacturing. Post references finance.example.com and db-demo.example.net. No real leaked files included.",
      severity: "critical",
      risk_score: 91,
      confidence: 89,
      tlp: "TLP:CLEAR",
      tags: ["demo", "ransomware", "leak-notice"],
      entities: [
        { type: "actor", value: "MOCKLOCK" },
        { type: "organization", value: "Example Manufacturing" },
        { type: "domain", value: "finance.example.com" },
        { type: "domain", value: "db-demo.example.net" },
      ],
      iocs: [],
      relationships: [{ type: "claims_victim", value: "Example Manufacturing" }],
      raw_reference: {},
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0008",
      timestamp: iso(70),
      doc_type: "forum_post",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic forum chatter about ExampleVPN exploit",
      summary: "Forum post linking actor and CVE.",
      body: "User demo_handle asks about exploit chain for CVE-2026-10001 and mentions c2-demo[.]invalid. Thread is synthetic.",
      severity: "medium",
      risk_score: 60,
      confidence: 80,
      tlp: "TLP:CLEAR",
      tags: ["demo", "forum", "cve"],
      entities: [
        { type: "handle", value: "demo_handle" },
        { type: "cve", value: "CVE-2026-10001" },
        { type: "domain", value: "c2-demo.invalid" },
      ],
      iocs: [],
      relationships: [{ type: "mentions", value: "CVE-2026-10001" }],
      raw_reference: {},
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0009",
      timestamp: iso(80),
      doc_type: "scan_output",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic external scan finds exposed admin panel",
      summary: "Public admin panel and host correlation.",
      body: "Demo scan detected admin.example.com on 203.0.113.45 with service nginx and login panel title Example Admin.",
      severity: "medium",
      risk_score: 58,
      confidence: 91,
      tlp: "TLP:CLEAR",
      tags: ["demo", "scan", "exposure"],
      entities: [
        { type: "domain", value: "admin.example.com" },
        { type: "ip", value: "203.0.113.45" },
        { type: "technology", value: "nginx" },
        { type: "organization", value: "Example Manufacturing" },
      ],
      iocs: [{ type: "ip", value: "203.0.113.45" }],
      relationships: [{ type: "resolves_to", value: "203.0.113.45" }],
      raw_reference: {},
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0010",
      timestamp: iso(90),
      doc_type: "cloud_exposure",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Synthetic public S3 bucket exposure",
      summary: "Public bucket with sample filenames only.",
      body: "Demo cloud scanner observed public bucket example-demo-logs. Contains sample filenames only. No objects downloaded.",
      severity: "medium",
      risk_score: 52,
      confidence: 86,
      tlp: "TLP:CLEAR",
      tags: ["demo", "cloud", "exposure"],
      entities: [
        { type: "cloud_asset", value: "s3://example-demo-logs" },
        { type: "organization", value: "Example Manufacturing" },
      ],
      iocs: [],
      relationships: [{ type: "exposes", value: "sample bucket" }],
      raw_reference: { objects_downloaded: 0 },
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0011",
      timestamp: iso(100),
      doc_type: "apt_report",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "CTI Alert: Active threat campaign linked to MOCKLOCK-APT",
      summary: "Detailed advisory charting campaign and correlation points.",
      body: "CTI Advisory: MOCKLOCK-APT threat group is targeting financial institutions using phishing domain login-mocklock.net and staging infrastructure at 198.51.100.12. Intrusions leverage malware payload MockPayload to exploit local appliances.",
      severity: "critical",
      risk_score: 96,
      confidence: 95,
      tlp: "TLP:CLEAR",
      tags: ["demo", "apt", "mocklock", "campaign-01"],
      entities: [
        { type: "actor", value: "MOCKLOCK-APT" },
        { type: "domain", value: "login-mocklock.net" },
        { type: "ip", value: "198.51.100.12" },
        { type: "malware", value: "MockPayload" },
      ],
      iocs: [
        { type: "domain", value: "login-mocklock.net" },
        { type: "ip", value: "198.51.100.12" },
      ],
      relationships: [
        { type: "attributed_to", value: "MOCKLOCK-APT" },
        { type: "uses_infrastructure", value: "login-mocklock.net" },
        { type: "uses_malware", value: "MockPayload" },
      ],
      raw_reference: { advisory_id: "DEMO-ADV-2026" },
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0012",
      timestamp: iso(110),
      doc_type: "cve",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "CVE-2026-9999: Remote Code Execution in MockVPN Gateways",
      summary: "High-priority remote code execution vulnerability exploited by MOCKLOCK-APT.",
      body: "A remote code execution vulnerability exists in MockVPN Gateway endpoints. Threat actors group MOCKLOCK-APT utilize this CVE-2026-9999 to gain initial network access, pushing payload MockPayload to active processes.",
      severity: "critical",
      risk_score: 98,
      confidence: 97,
      tlp: "TLP:CLEAR",
      tags: ["demo", "cve", "exploit", "mocklock"],
      entities: [
        { type: "cve", value: "CVE-2026-9999" },
        { type: "actor", value: "MOCKLOCK-APT" },
        { type: "malware", value: "MockPayload" },
      ],
      iocs: [],
      relationships: [
        { type: "exploited_by", value: "MOCKLOCK-APT" },
        { type: "delivers_payload", value: "MockPayload" },
      ],
      raw_reference: { cvss_score: 9.8 },
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0013",
      timestamp: iso(120),
      doc_type: "malware",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Advisory: MockPayload malware matches and signatures",
      summary: "Signature breakdown of MockPayload malware sample.",
      body: "Malware MockPayload signature matches. SHA256: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Resolves C2 communication lines to target domain mocklock-updates.com and IP 198.51.100.12.",
      severity: "high",
      risk_score: 92,
      confidence: 94,
      tlp: "TLP:CLEAR",
      tags: ["demo", "malware", "mocklock", "signature"],
      entities: [
        { type: "malware", value: "MockPayload" },
        { type: "domain", value: "mocklock-updates.com" },
        { type: "ip", value: "198.51.100.12" },
      ],
      iocs: [
        { type: "sha256", value: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
        { type: "domain", value: "mocklock-updates.com" },
        { type: "ip", value: "198.51.100.12" },
      ],
      relationships: [
        { type: "beacon_to", value: "mocklock-updates.com" },
        { type: "network_resolves", value: "198.51.100.12" },
      ],
      raw_reference: { signature_type: "yara_match" },
      safe_demo: true,
      redaction_level: "synthetic",
    },
    {
      id: "demo-evt-0014",
      timestamp: iso(130),
      doc_type: "stealer_redacted",
      source_name: "Demo Feed",
      source_kind: "synthetic",
      title: "Credential Log: Stolen session leak linked to MOCKLOCK-APT",
      summary: "Redacted stealer telemetry referencing mocklock-updates.com and infected target.",
      body: "Infected host mock-host-corp1.test. Stolen browser credentials harvested for domain mocklock-updates.com. Username analyst@mockcorp.test password=<REDACTED_DEMO_PASSWORD>. All cookies and sessions are safely redacted.",
      severity: "high",
      risk_score: 89,
      confidence: 90,
      tlp: "TLP:CLEAR",
      tags: ["demo", "stealer", "mocklock", "credentials"],
      entities: [
        { type: "domain", value: "mocklock-updates.com" },
        { type: "email", value: "analyst@mockcorp.test" },
        { type: "actor", value: "MOCKLOCK-APT" },
      ],
      iocs: [],
      relationships: [
        { type: "compromised_by", value: "MOCKLOCK-APT" },
      ],
      raw_reference: { credentials_redacted: true },
      safe_demo: true,
      redaction_level: "masked",
    },
  ]
}

export function validateDemoDoc(doc: DemoDoc) {
  const text = JSON.stringify(doc)
  const blockedPatterns = [
    /AKIA[0-9A-Z]{16}/,
    /ghp_[A-Za-z0-9_]{36}/,
    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /password=(?!<REDACTED|<REDACTED_DEMO_PASSWORD>)[^\s,;]+/i,
    /cookie=(?!<REDACTED>)[^\s,;]+/i,
  ]
  for (const pattern of blockedPatterns) {
    if (pattern.test(text)) throw new Error(`Unsafe demo doc blocked: ${doc.id}`)
  }
  if (!doc.safe_demo) throw new Error(`Demo doc missing safe_demo=true: ${doc.id}`)
}
