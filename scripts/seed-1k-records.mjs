// ================================================
// Generates 1000+ unique search_index_lines records
// across 12 file types with cross-referencing entities.
// Run: node scripts/seed-1k-records.mjs
// ================================================
import { Pool } from "pg"
import crypto from "crypto"

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgres://intelforge:intelforge@localhost:5432/intelforge" })

// --- Shared entity pools (these repeat across file types for correlation) ---
const DOMAINS = [
  "eurobank.invalid", "megacorp.invalid", "healthcare-demo.invalid", "democity.invalid",
  "globaltech.invalid", "legalcorp.invalid", "demomfg.invalid", "demoretail.invalid",
  "finserv-group.invalid", "techstartup.invalid", "govdept.invalid", "university-demo.invalid",
  "energycorp.invalid", "telecom-eu.invalid", "pharma-global.invalid", "logistics-intl.invalid",
  "mediagroup.invalid", "insureco.invalid", "defensecon.invalid", "cloudhost.invalid",
  "airline-demo.invalid", "hotelchain.invalid", "automaker.invalid", "foodcorp.invalid",
]

const ACTORS = ["Cl0p", "LockBit", "BlackCat", "Akira", "APT28", "Mustang Panda", "Lazarus", "Conti-remnant", "Play", "Royal", "BianLian", "Medusa"]

const CVES = [
  "CVE-2023-34362", "CVE-2021-44228", "CVE-2024-3094", "CVE-2023-4966",
  "CVE-2024-21887", "CVE-2022-30190", "CVE-2021-34527", "CVE-2023-0669",
  "CVE-2024-6387", "CVE-2023-46805", "CVE-2022-22965", "CVE-2020-1472",
]

const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "France", "Italy", "Australia",
  "Canada", "Japan", "Brazil", "India", "Netherlands", "Singapore", "UAE",
  "South Korea", "Sweden", "Spain", "Poland", "Switzerland", "Ireland", "Norway",
]

const STEALERS = ["Redline", "Lumma", "Raccoon", "Vidar", "Meta", "Stealc", "Risepro", "Mystic"]
const SECTORS = ["Healthcare", "Finance", "Manufacturing", "Government", "Education", "Energy", "Legal", "Retail", "Technology", "Telecom"]

const FILE_TYPES = [
  "database_dump", "pastebin", "ulp_stealer", "compromised_machines",
  "forum_post", "darkweb_intel", "osint_feed", "paste_osint",
  "mix_record", "telegram_intel", "threat_actor_report", "stealer_log",
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pickN(arr, n) { const s = [...arr].sort(() => Math.random() - 0.5); return s.slice(0, n) }
function uid() { return crypto.randomBytes(4).toString("hex") }
function maskEmail(domain) { const prefixes = ["admin","user","hr","ceo","cfo","dev","ops","support","finance","security","it","sales","marketing","legal","nurse","doctor","engineer","manager","director","analyst"]; return `${pick(prefixes)}.${uid().slice(0,3)}****@${domain}` }
function maskPass() { return `<REDACTED:${8 + Math.floor(Math.random() * 12)}>` }
function randomDate(daysBack) { const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * daysBack)); return d.toISOString().slice(0, 10) }
function randomIP() { return `203.0.113.${Math.floor(Math.random() * 254) + 1}` }

// --- Generators per file type ---

function genDatabaseDump(fileIdx) {
  const domain = pick(DOMAINS)
  const country = pick(COUNTRIES)
  const actor = pick(ACTORS)
  const cve = pick(CVES)
  const records = (Math.floor(Math.random() * 9) + 1) * 100000
  const lines = [
    `-- Database Export: ${domain.split(".")[0]}_db | Records: ${records.toLocaleString()} | Date: ${randomDate(30)}`,
    `-- Breach attributed to: ${actor} via ${cve}`,
    `INSERT INTO users (email, name, country) VALUES`,
  ]
  for (let i = 0; i < 4; i++) {
    lines.push(`('${maskEmail(domain)}', '${pick(["Alex","Sam","Jordan","Taylor","Morgan","Casey","Riley","Quinn"])} ${String.fromCharCode(65+i)}.', '${country}');`)
  }
  lines.push(`-- Total: ${records.toLocaleString()} records | C2: ${randomIP()} | Vector: ${cve}`)
  return { domain, country, actor, lines, fileType: "database_dump" }
}

function genPastebin(fileIdx) {
  const domains = pickN(DOMAINS, 3)
  const actor = pick(ACTORS)
  const lines = [
    `[PASTE] Title: "${pick(["Corporate creds","VPN access dump","Employee list","Fresh combo","Banking access"])} - ${randomDate(14)}"`,
    `[PASTE] Author: ${uid()}_leaker | Lines: ${(Math.floor(Math.random() * 90) + 10) * 1000}`,
  ]
  for (const d of domains) {
    lines.push(`${maskEmail(d)}:${maskPass()} | ${pick(["VPN","OWA","SSO","Citrix","SAP","RDP"])}`)
  }
  lines.push(`-- Source: ${pick(STEALERS)} stealer logs | Actor: ${actor}`)
  return { domain: domains[0], country: pick(COUNTRIES), actor, lines, fileType: "pastebin" }
}

function genUlpStealer(fileIdx) {
  const stealer = pick(STEALERS)
  const domain = pick(DOMAINS)
  const country = pick(COUNTRIES)
  const machine = `${pick(["DESKTOP","LAPTOP","PC","WS","SRV"])}-${uid().slice(0,4).toUpperCase()}`
  const lines = [
    `=== ${stealer} Stealer | Machine: ${machine} | Country: ${country} | Date: ${randomDate(14)} ===`,
  ]
  const targets = pickN(DOMAINS, 4)
  for (const t of targets) {
    lines.push(`URL: https://${pick(["vpn","mail","sso","portal","admin","erp","citrix","owa"])}.${t}/login | USER: ${maskEmail(t)} | PASS: ${maskPass()}`)
  }
  lines.push(`--- Cookies: ${100 + Math.floor(Math.random() * 400)} | Autofill: ${10 + Math.floor(Math.random() * 50)} | Wallets: ${Math.floor(Math.random() * 3)} ---`)
  return { domain, country, actor: null, lines, fileType: "ulp_stealer" }
}

function genCompromisedMachines(fileIdx) {
  const country = pick(COUNTRIES)
  const stealer = pick(STEALERS)
  const lines = [
    `hostname,ip,os,stealer,country,creds,cookies,date`,
  ]
  for (let i = 0; i < 5; i++) {
    const host = `${pick(["DESKTOP","LAPTOP","PC","WS"])}-${uid().slice(0,5).toUpperCase()}`
    lines.push(`${host},10.x.x.x,${pick(["Windows 10","Windows 11","Ubuntu 22.04"])},${pick(STEALERS)},${pick(COUNTRIES)},${20+Math.floor(Math.random()*80)},${50+Math.floor(Math.random()*400)},${randomDate(14)}`)
  }
  lines.push(`--- Batch total: ${500+Math.floor(Math.random()*2000)} machines ---`)
  return { domain: null, country, actor: null, lines, fileType: "compromised_machines" }
}

function genForumPost(fileIdx) {
  const actor = pick(ACTORS)
  const domain = pick(DOMAINS)
  const cve = pick(CVES)
  const lines = [
    `[FORUM: ${pick(["XSS.is","RAMP","BreachForums","Exploit.in"])}] Thread: "${pick(["Selling access","Looking for","Fresh dump","RDP batch"])}" | ${randomDate(10)}`,
    `Author: ${uid()}_broker | Views: ${100+Math.floor(Math.random()*2000)}`,
    `Selling ${pick(["initial access","RDP","VPN creds","database dump"])} to ${domain}. ${cve} ${pick(["unpatched","exploited","confirmed"])}.`,
    `Target sector: ${pick(SECTORS)} | Country: ${pick(COUNTRIES)} | Price: $${(5+Math.floor(Math.random()*45))*1000}`,
    `Reply from ${actor.toLowerCase()}_affiliate: "${pick(["Interested. DM sent.","We take it. TOX me.","Price too high.","Need proof of access."])}"`,
  ]
  return { domain, country: pick(COUNTRIES), actor, lines, fileType: "forum_post" }
}

function genDarkwebIntel(fileIdx) {
  const actor = pick(ACTORS)
  const domain = pick(DOMAINS)
  const sector = pick(SECTORS)
  const country = pick(COUNTRIES)
  const lines = [
    `=== ${actor} Leak Site Scrape | Date: ${randomDate(7)} ===`,
    `NEW VICTIM: ${domain.split(".")[0].toUpperCase()} (${country}) | Sector: ${sector} | Deadline: ${randomDate(-14)}`,
    `Data: ${pick(["Patient records","Financial docs","Employee PII","Source code","Client contracts","SCADA diagrams"])} | Size: ${5+Math.floor(Math.random()*95)}GB`,
    `Negotiation status: ${pick(["Timer running","Expired - data published","In negotiation","Paid - removed"])}`,
    `C2 infrastructure: ${randomIP()} | Tor: ${actor.toLowerCase()}${uid()}.onion`,
  ]
  return { domain, country, actor, lines, fileType: "darkweb_intel" }
}

function genOsintFeed(fileIdx) {
  const domain = pick(DOMAINS)
  const cve = pick(CVES)
  const lines = [
    `{"feed":"osint_daily","date":"${randomDate(7)}","entries":${50+Math.floor(Math.random()*200)}}`,
    `{"type":"${pick(["domain_registration","ssl_cert","dns_change","github_exposure"])}","domain":"${pick(["secure-","login-","vpn-","admin-"])}${domain}","risk":"${pick(["high","critical","medium"])}"}`,
    `{"type":"cve_mention","cve":"${cve}","source":"${pick(["twitter","reddit","blog","news"])}","actor":"${pick(ACTORS)}"}`,
    `{"type":"ioc","value":"${randomIP()}","context":"${pick(["C2 server","phishing host","malware delivery","scanner"])}","confidence":${70+Math.floor(Math.random()*30)}}`,
    `{"type":"brand_impersonation","target":"${domain}","phishing_url":"https://${domain.replace(".invalid","-login.invalid")}/auth"}`,
  ]
  return { domain, country: null, actor: pick(ACTORS), lines, fileType: "osint_feed" }
}

function genPasteOsint(fileIdx) {
  const domain = pick(DOMAINS)
  const lines = [
    `=== Paste Monitor | Domain: ${domain} | Scan: ${randomDate(3)} ===`,
    `MATCH: ${pick(["pastebin","rentry","ghostbin","dpaste"])}.com/**** | "${domain.split(".")[0]} ${pick(["creds","dump","access","combo"])}" | ${100+Math.floor(Math.random()*5000)} lines`,
    `MATCH: ${pick(["pastebin","rentry","ghostbin"])}.com/**** | "${pick(["VPN","SSO","Email","Admin"])} access ${domain}" | ${10+Math.floor(Math.random()*500)} lines`,
    `ALERT: ${domain} found in ${2+Math.floor(Math.random()*8)} paste sites in ${24+Math.floor(Math.random()*48)}h`,
  ]
  return { domain, country: pick(COUNTRIES), actor: null, lines, fileType: "paste_osint" }
}

function genMixRecord(fileIdx) {
  const domains = pickN(DOMAINS, 5)
  const lines = [
    `=== COMBOLIST | Lines: ${(1+Math.floor(Math.random()*9))}.${Math.floor(Math.random()*9)}M | Format: ${pick(["email:pass","url:user:pass","user:pass"])} | ${randomDate(14)} ===`,
  ]
  for (const d of domains) {
    lines.push(`${maskEmail(d)}:<REDACTED_DEMO_PASSWORD>`)
  }
  lines.push(`--- Top domains: ${domains.slice(0,3).join(", ")} | Source: ${pick(STEALERS)} + ${pick(STEALERS)} aggregated ---`)
  return { domain: domains[0], country: pick(COUNTRIES), actor: null, lines, fileType: "mix_record" }
}

function genTelegramIntel(fileIdx) {
  const actor = pick(ACTORS)
  const domain = pick(DOMAINS)
  const lines = [
    `=== Telegram: @${pick(["DarkLeaks","CyberUnder","RansomWatch","StealerMarket","IAB_Market"])}_${uid().slice(0,3)} | ${randomDate(5)} ===`,
    `[${randomDate(5)} ${8+Math.floor(Math.random()*12)}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}] ${actor}: New victim added - ${domain}`,
    `[${randomDate(4)} ${8+Math.floor(Math.random()*12)}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}] Selling ${pick(["RDP","VPN","Citrix","SSH"])} access: ${pick(DOMAINS)} - $${1+Math.floor(Math.random()*20)}K`,
    `[${randomDate(3)} ${8+Math.floor(Math.random()*12)}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}] Fresh ${pick(STEALERS)} logs: ${1+Math.floor(Math.random()*15)}K machines, ${pick(COUNTRIES)} focus`,
    `[${randomDate(2)} ${8+Math.floor(Math.random()*12)}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}] ${pick(CVES)} exploit working against ${pick(DOMAINS)} - confirmed ${pick(["unpatched","vulnerable","exploitable"])}`,
  ]
  return { domain, country: pick(COUNTRIES), actor, lines, fileType: "telegram_intel" }
}

function genThreatActorReport(fileIdx) {
  const actor = pick(ACTORS)
  const cves = pickN(CVES, 3)
  const domains = pickN(DOMAINS, 3)
  const lines = [
    `# Threat Actor: ${actor} | Updated: ${randomDate(7)}`,
    `Aliases: ${actor}, ${actor}-affiliate, ${uid().slice(0,4).toUpperCase()} | Origin: ${pick(["Russia","China","North Korea","Iran","Unknown"])}`,
    `Key CVEs: ${cves.join(", ")}`,
    `Recent victims: ${domains.map(d => d.split(".")[0]).join(", ")} | Sectors: ${pickN(SECTORS, 3).join(", ")}`,
    `TTPs: ${pick(["T1190","T1133","T1078","T1486","T1567","T1059"])} | Infrastructure: ${randomIP()}`,
    `Recommendation: Patch ${cves[0]}, monitor for ${actor} IOCs, block ${randomIP()}`,
  ]
  return { domain: domains[0], country: pick(COUNTRIES), actor, lines, fileType: "threat_actor_report" }
}

function genStealerLog(fileIdx) {
  const stealer = pick(STEALERS)
  const country = pick(COUNTRIES)
  const domains = pickN(DOMAINS, 3)
  const lines = [
    `=== ${stealer} v${3+Math.floor(Math.random()*3)}.${Math.floor(Math.random()*9)} | Batch: ${country.slice(0,2).toUpperCase()}-${randomDate(10)} | Machines: ${500+Math.floor(Math.random()*5000)} ===`,
    `Machine: ${pick(["DESKTOP","LAPTOP","PC"])}-${uid().slice(0,5).toUpperCase()} | OS: ${pick(["Win10","Win11"])} | Country: ${country}`,
  ]
  for (const d of domains) {
    lines.push(`  https://${pick(["vpn","mail","sso","portal","citrix","owa","erp"])}.${d}/login | ${maskEmail(d)} | ${maskPass()}`)
  }
  lines.push(`--- Total batch: ${500+Math.floor(Math.random()*5000)} machines | ${10000+Math.floor(Math.random()*90000)} creds ---`)
  return { domain: domains[0], country, actor: null, lines, fileType: "stealer_log" }
}

const GENERATORS = [
  genDatabaseDump, genPastebin, genUlpStealer, genCompromisedMachines,
  genForumPost, genDarkwebIntel, genOsintFeed, genPasteOsint,
  genMixRecord, genTelegramIntel, genThreatActorReport, genStealerLog,
]

async function main() {
  console.log("Generating 1000+ unique records...")
  
  const fileStartId = 10000
  let totalLines = 0
  let fileCount = 0
  
  // Generate ~90 files (each with 5-12 lines = ~700-1000+ lines)
  const FILES_TO_GEN = 150
  
  for (let i = 0; i < FILES_TO_GEN; i++) {
    const gen = GENERATORS[i % GENERATORS.length]
    const data = gen(i)
    const fileId = fileStartId + i
    const fileName = `${data.fileType}-${uid()}-${i}.txt`
    const filePath = `/data/demo/${data.fileType}/${fileName}`
    
    // Insert file metadata
    await pool.query(
      `INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [fileId, filePath, fileName, data.lines.join("\n").length, data.lines.length, data.fileType]
    )
    
    // Insert lines
    for (let ln = 0; ln < data.lines.length; ln++) {
      await pool.query(
        `INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), to_tsvector('english', $4))
         ON CONFLICT DO NOTHING`,
        [filePath, fileName, ln + 1, data.lines[ln], data.fileType, data.country]
      )
      totalLines++
    }
    fileCount++
    
    if (fileCount % 25 === 0) {
      console.log(`  ${fileCount} files, ${totalLines} lines...`)
    }
  }
  
  // Final count
  const result = await pool.query("SELECT COUNT(*) as c FROM search_index_lines")
  const fileResult = await pool.query("SELECT COUNT(*) as c FROM search_index")
  const typeResult = await pool.query("SELECT file_type, COUNT(*) as c FROM search_index_lines GROUP BY file_type ORDER BY c DESC")
  
  console.log(`\nDone!`)
  console.log(`  Files: ${fileResult.rows[0].c}`)
  console.log(`  Lines: ${result.rows[0].c}`)
  console.log(`\nBy type:`)
  for (const row of typeResult.rows) {
    console.log(`  ${row.file_type.padEnd(25)} ${row.c} lines`)
  }
  
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
