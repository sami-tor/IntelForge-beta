// Push acmecorp demo data into Quickwit osint-data index
const QUICKWIT_URL = "http://localhost:7280"
const INDEX = "osint-data"

const records = [
  // Stealer logs (ULP format)
  { url: "vpn.acmecorp.invalid/login", username: "admin.j****@acmecorp.invalid", password: "<REDACTED:14>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-raccoon-stealer-2026.json", file_path: "../../data/ulp/acmecorp-raccoon-stealer-2026.json", content: "vpn.acmecorp.invalid/login admin.j****@acmecorp.invalid <REDACTED:14> email {\"url\":\"vpn.acmecorp.invalid/login\",\"username\":\"admin.j****@acmecorp.invalid\",\"password\":\"<REDACTED:14>\",\"type\":\"email\"}" },
  { url: "fileshare.acmecorp.invalid/admin", username: "sysadmin****@acmecorp.invalid", password: "<REDACTED:16>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-raccoon-stealer-2026.json", file_path: "../../data/ulp/acmecorp-raccoon-stealer-2026.json", content: "fileshare.acmecorp.invalid/admin sysadmin****@acmecorp.invalid <REDACTED:16> email {\"url\":\"fileshare.acmecorp.invalid/admin\",\"username\":\"sysadmin****@acmecorp.invalid\",\"password\":\"<REDACTED:16>\",\"type\":\"email\"}" },
  { url: "mail.acmecorp.invalid/owa", username: "ceo.m****@acmecorp.invalid", password: "<REDACTED:12>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-lumma-stealer-2026.json", file_path: "../../data/ulp/acmecorp-lumma-stealer-2026.json", content: "mail.acmecorp.invalid/owa ceo.m****@acmecorp.invalid <REDACTED:12> email {\"url\":\"mail.acmecorp.invalid/owa\",\"username\":\"ceo.m****@acmecorp.invalid\",\"password\":\"<REDACTED:12>\",\"type\":\"email\"}" },
  { url: "erp.acmecorp.invalid/sap", username: "hr.team****@acmecorp.invalid", password: "<REDACTED:11>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-raccoon-stealer-2026.json", file_path: "../../data/ulp/acmecorp-raccoon-stealer-2026.json", content: "erp.acmecorp.invalid/sap hr.team****@acmecorp.invalid <REDACTED:11> email {\"url\":\"erp.acmecorp.invalid/sap\",\"username\":\"hr.team****@acmecorp.invalid\",\"password\":\"<REDACTED:11>\",\"type\":\"email\"}" },
  { url: "citrix.acmecorp.invalid/vpn", username: "ops.lead****@acmecorp.invalid", password: "<REDACTED:15>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-raccoon-stealer-2026.json", file_path: "../../data/ulp/acmecorp-raccoon-stealer-2026.json", content: "citrix.acmecorp.invalid/vpn ops.lead****@acmecorp.invalid <REDACTED:15> email {\"url\":\"citrix.acmecorp.invalid/vpn\",\"username\":\"ops.lead****@acmecorp.invalid\",\"password\":\"<REDACTED:15>\",\"type\":\"email\"}" },
  { url: "gitlab.acmecorp.invalid", username: "dev.senior****@acmecorp.invalid", password: "<REDACTED:18>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-lumma-stealer-2026.json", file_path: "../../data/ulp/acmecorp-lumma-stealer-2026.json", content: "gitlab.acmecorp.invalid dev.senior****@acmecorp.invalid <REDACTED:18> email {\"url\":\"gitlab.acmecorp.invalid\",\"username\":\"dev.senior****@acmecorp.invalid\",\"password\":\"<REDACTED:18>\",\"type\":\"email\"}" },
  { url: "jira.acmecorp.invalid", username: "pm.director****@acmecorp.invalid", password: "<REDACTED:13>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-vidar-stealer-2026.json", file_path: "../../data/ulp/acmecorp-vidar-stealer-2026.json", content: "jira.acmecorp.invalid pm.director****@acmecorp.invalid <REDACTED:13> email {\"url\":\"jira.acmecorp.invalid\",\"username\":\"pm.director****@acmecorp.invalid\",\"password\":\"<REDACTED:13>\",\"type\":\"email\"}" },
  { url: "slack.acmecorp.invalid", username: "marketing****@acmecorp.invalid", password: "<REDACTED:10>", login_type: "email", source: "ulp_logs", file_name: "acmecorp-vidar-stealer-2026.json", file_path: "../../data/ulp/acmecorp-vidar-stealer-2026.json", content: "slack.acmecorp.invalid marketing****@acmecorp.invalid <REDACTED:10> email {\"url\":\"slack.acmecorp.invalid\",\"username\":\"marketing****@acmecorp.invalid\",\"password\":\"<REDACTED:10>\",\"type\":\"email\"}" },
  // Database dump records
  { url: "", username: "finance.mgr****@acmecorp.invalid", password: "<REDACTED:14>", login_type: "email", source: "database", file_name: "acmecorp-breach-db-2026.json", file_path: "../../data/database/acmecorp-breach-db-2026.json", content: "acmecorp.invalid finance.mgr****@acmecorp.invalid {\"email\":\"finance.mgr****@acmecorp.invalid\",\"username\":\"FinanceMgr\",\"ip\":\"10.x.x.x\",\"password\":\"<REDACTED:14>\",\"uid\":\"50001\"}" },
  { url: "", username: "legal.counsel****@acmecorp.invalid", password: "<REDACTED:16>", login_type: "email", source: "database", file_name: "acmecorp-breach-db-2026.json", file_path: "../../data/database/acmecorp-breach-db-2026.json", content: "acmecorp.invalid legal.counsel****@acmecorp.invalid {\"email\":\"legal.counsel****@acmecorp.invalid\",\"username\":\"LegalCounsel\",\"ip\":\"10.x.x.x\",\"password\":\"<REDACTED:16>\",\"uid\":\"50002\"}" },
  { url: "", username: "ciso****@acmecorp.invalid", password: "<REDACTED:20>", login_type: "email", source: "database", file_name: "acmecorp-breach-db-2026.json", file_path: "../../data/database/acmecorp-breach-db-2026.json", content: "acmecorp.invalid ciso****@acmecorp.invalid {\"email\":\"ciso****@acmecorp.invalid\",\"username\":\"CISO\",\"ip\":\"10.x.x.x\",\"password\":\"<REDACTED:20>\",\"uid\":\"50003\"}" },
  { url: "", username: "board.member****@acmecorp.invalid", password: "<REDACTED:12>", login_type: "email", source: "database", file_name: "acmecorp-breach-db-2026.json", file_path: "../../data/database/acmecorp-breach-db-2026.json", content: "acmecorp.invalid board.member****@acmecorp.invalid {\"email\":\"board.member****@acmecorp.invalid\",\"username\":\"BoardMember1\",\"ip\":\"10.x.x.x\",\"password\":\"<REDACTED:12>\",\"uid\":\"50004\"}" },
  { url: "", username: "vp.engineering****@acmecorp.invalid", password: "<REDACTED:17>", login_type: "email", source: "database", file_name: "acmecorp-breach-db-2026.json", file_path: "../../data/database/acmecorp-breach-db-2026.json", content: "acmecorp.invalid vp.engineering****@acmecorp.invalid {\"email\":\"vp.engineering****@acmecorp.invalid\",\"username\":\"VPEng\",\"ip\":\"10.x.x.x\",\"password\":\"<REDACTED:17>\",\"uid\":\"50005\"}" },
]

// Add timestamp to all records
const now = new Date().toISOString()
const ndjson = records.map(r => JSON.stringify({ ...r, timestamp: now })).join("\n")

async function main() {
  console.log(`Pushing ${records.length} records to Quickwit ${INDEX}...`)
  
  const res = await fetch(`${QUICKWIT_URL}/api/v1/${INDEX}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson" },
    body: ndjson + "\n",
  })
  
  if (!res.ok) {
    const err = await res.text()
    console.error(`Failed: ${res.status} - ${err}`)
    process.exit(1)
  }
  
  const result = await res.json()
  console.log(`Success: ${JSON.stringify(result)}`)
  
  // Verify
  await new Promise(r => setTimeout(r, 2000)) // wait for commit
  const verify = await fetch(`${QUICKWIT_URL}/api/v1/${INDEX}/search?query=acmecorp&max_hits=5`)
  const vData = await verify.json()
  console.log(`Verification: ${vData.num_hits} hits for "acmecorp"`)
}

main().catch(e => { console.error(e); process.exit(1) })
