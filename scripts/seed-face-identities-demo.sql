-- ============================================================
-- FACE SEARCH DEMO IDENTITIES - IntelForge FYP
-- 120 synthetic identities matching actual table schema
-- Run via: docker exec -i intelforge-postgres psql -U intelforge -d intelforge < seed-face-identities-demo.sql
-- ============================================================

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Viktor Petrov (DEMO-APT-01)', ARRAY['apt','threat-actor','demo-apt-01','ransomware','leader','russian']::text[], 'Leader of DEMO-APT-01. Responsible for MetaCorp, JPMorgan Demo, and Microsoft Demo breaches. Linked to CVE-2026-99001 and CVE-2026-99991. Observed using Raccoon and custom malware.', 97, true, NULL, 'demo-system', NOW()-INTERVAL '120 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Elena Volkov (DEMO-APT-01)', ARRAY['apt','threat-actor','demo-apt-01','malware-dev','coder','russian']::text[], 'Malware developer for DEMO-APT-01. Developed DEMO-WEBSHELL-01 and DEMO-LATERAL-01. Linked to MetaCorp and JPMorgan Demo breaches.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '119 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Chen Wei (DEMO-APT-01)', ARRAY['apt','threat-actor','demo-apt-01','finance','analyst','chinese']::text[], 'Financial analyst for DEMO-APT-01. Specializes in targeting financial institutions including JPMorgan Demo Bank and PayPal Demo.', 89, true, NULL, 'demo-system', NOW()-INTERVAL '118 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sergei Ivanov (NEXUS-THREAT)', ARRAY['apt','nexus-threat','cloud-hacker','leader','gcp','aws','russian']::text[], 'Leader of NEXUS-THREAT group. Specializes in cloud environment attacks targeting GCP, AWS, and Azure. Responsible for Google Demo and Amazon Demo breaches via shared OAuth trust exploitation.', 96, true, NULL, 'demo-system', NOW()-INTERVAL '117 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Maria Sokolova (NEXUS-THREAT)', ARRAY['apt','nexus-threat','stealer-dev','cloud-specialist','russian']::text[], 'Stealer developer for NEXUS-THREAT. Developed NEXUS-STEALER-01 (google_stealer.py) and NEXUS-STEALER-02 (aws_keylogger.exe). Both beacon to 198.51.100.75.', 93, true, NULL, 'demo-system', NOW()-INTERVAL '116 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Alexei Kozlov (NEXUS-THREAT)', ARRAY['apt','nexus-threat','exploit-dev','cve-researcher','russian']::text[], 'CVE researcher and exploit developer for NEXUS-THREAT. Linked to CVE-2026-99991 (Google Workspace SSO bypass) and CVE-2026-99994 (AWS S3 misconfiguration).', 88, true, NULL, 'demo-system', NOW()-INTERVAL '115 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jin Park (PHANTOM-SHADOW)', ARRAY['apt','phantom-shadow','streaming-attacks','leader','south-korean']::text[], 'Leader of PHANTOM-SHADOW group. Specializes in streaming platforms and entertainment sector attacks. Linked to Netflix Demo and Spotify Demo breaches.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '114 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Yuki Tanaka (PHANTOM-SHADOW)', ARRAY['apt','phantom-shadow','credential-stuffing','stealer','japanese']::text[], 'Operator for PHANTOM-SHADOW. Uses credential stuffing and stealer malware against streaming platforms. Developed PHANTOM-STEALER-01.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '113 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Mohammed Al-Hassan (SILENT-RIFT)', ARRAY['apt','silent-rift','social-media','scraping','leader','iranian']::text[], 'Leader of SILENT-RIFT. Specializes in social media and professional network scraping. Responsible for LinkedIn Demo breach (900M profiles).', 92, true, NULL, 'demo-system', NOW()-INTERVAL '112 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sara Mansouri (SILENT-RIFT)', ARRAY['apt','silent-rift','data-analyst','scraping','automation','iranian']::text[], 'Data analyst for SILENT-RIFT. Developed SILENT-RIFT-SCRAPER-01 for large-scale data extraction from professional networks.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '111 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Min-Jun Lee (CYBER-SHADOW)', ARRAY['apt','cyber-shadow','fintech','gaming','leader','north-korean']::text[], 'Leader of CYBER-SHADOW group. Targets gaming and fintech sectors. Responsible for Steam Demo, PayPal Demo, and Uber Demo breaches.', 94, true, NULL, 'demo-system', NOW()-INTERVAL '110 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Soo-Yeon Kim (CYBER-SHADOW)', ARRAY['apt','cyber-shadow','payment-systems','crypto','north-korean']::text[], 'Financial operator for CYBER-SHADOW. Specializes in payment system compromise and cryptocurrency theft. Linked to PayPal Demo breach.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '109 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Ali Tehrani (DEMO-APT-02)', ARRAY['apt','demo-apt-02','financial','banking','leader','iranian']::text[], 'Leader of DEMO-APT-02. Advanced persistent threat focused on financial institutions. Targets JPMorgan Demo Bank using spear-phishing and supply chain attacks.', 95, true, NULL, 'demo-system', NOW()-INTERVAL '108 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Dmitri Volkov (LockBit Affiliate)', ARRAY['ransomware','lockbit','affiliate','raas','russian']::text[], 'LockBit ransomware affiliate. Responsible for Microsoft Demo breach. Exploited CVE-2026-99993 (Azure AD privilege escalation) for initial access.', 93, true, NULL, 'demo-system', NOW()-INTERVAL '107 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Natasha Ivanova (ALPHV/BlackCat)', ARRAY['ransomware','alphv','blackcat','negotiator','russian']::text[], 'ALPHV/BlackCat ransomware operator. Responsible for JPMorgan Demo Bank breach. Selling internal network access on darkweb markets. $75K starting price.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '106 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Carlos Mendez (Darkweb Vendor)', ARRAY['darkweb','vendor','data-sales','breach','mexican']::text[], 'Darkweb marketplace vendor specializing in database dumps. Selling MetaCorp, TikTok, and Apple Demo databases. Verified seller on versus_market and torrez_market.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '105 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Omar Shaikh (Darkweb Vendor)', ARRAY['darkweb','vendor','access-sales','network-access','pakistani']::text[], 'Darkweb vendor specializing in network access sales. Selling JPMorgan Demo Bank internal access and Microsoft Demo Azure tenant access.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '104 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Andrei Popov (Raccoon Developer)', ARRAY['malware-dev','stealer','raccoon','developer','ukrainian']::text[], 'Developer of Raccoon stealer malware. Raccoon used to harvest credentials from MetaCorp, Google Demo, Amazon Demo, and JPMorgan Demo employees. Captured 234+ credentials per host.', 92, true, NULL, 'demo-system', NOW()-INTERVAL '103 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Katarina Novak (RedLine Developer)', ARRAY['malware-dev','stealer','redline','coder','polish']::text[], 'Developer of RedLine stealer. RedLine used against Google Demo and MetaCorp targets. Captures browser cookies, autofill data, and credentials.', 89, true, NULL, 'demo-system', NOW()-INTERVAL '102 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Viktor Koval (Lumma Developer)', ARRAY['malware-dev','stealer','lumma','infostealer','ukrainian']::text[], 'Developer of Lumma stealer (infostealer). Lumma used against Google Demo, Microsoft Demo, and TikTok Demo. Captures 312+ credentials per host.', 87, true, NULL, 'demo-system', NOW()-INTERVAL '101 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('@DarkOperatorX (Telegram Admin)', ARRAY['telegram','channel-admin','darkleaks','data-dumps','russian']::text[], 'Telegram channel admin for DarkLeaks Underground (4500 members). Daily dumps of credential databases including MetaCorp 500K employee database.', 90, true, '@DarkOperatorX', 'demo-system', NOW()-INTERVAL '100 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('@ShadowBroker (Telegram Admin)', ARRAY['telegram','channel-admin','stealer-logs','combo-list','russian']::text[], 'Telegram channel admin for stealer logs channel (8000+ members). Distributes Raccoon + Lumma combo with 25K+ credentials. Compiled 2M line mega combo.', 93, true, '@ShadowBroker', 'demo-system', NOW()-INTERVAL '99 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Hassan Raza (Exploit Developer)', ARRAY['exploit-dev','zero-day','cve-research','researcher','pakistani']::text[], 'Zero-day exploit developer. Developed working exploits for CVE-2026-99001, CVE-2026-99992, and CVE-2026-99999. Sells to multiple threat actor groups.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '98 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Maxim Petrov (C2 Admin)', ARRAY['c2-admin','infrastructure','botnet','server-admin','russian']::text[], 'C2 infrastructure administrator. Manages C2 servers at IPs 198.51.100.50 (MetaCorp C2), 203.0.113.200 (JPMorgan C2), 198.51.100.75 (NEXUS-THREAT C2).', 94, true, NULL, 'demo-system', NOW()-INTERVAL '97 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Arseni Volkov (Phishing Kit Dev)', ARRAY['phishing','kit-dev','credential-harvest','social-engineering','russian']::text[], 'Phishing kit developer. Created phishing pages impersonating MetaCorp, JPMorgan Demo, Google Demo, Microsoft Demo, and Amazon Demo. Kits hosted on 198.51.100.50, 203.0.113.200.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '96 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Wei Chen (Crypto Mixer Operator)', ARRAY['crypto','mixer','money-laundering','financial-crime','chinese']::text[], 'Cryptocurrency mixer operator. Helps threat actors launder proceeds from ransomware attacks, credential sales, and data breaches. Linked to LockBit and ALPHV payments.', 89, true, NULL, 'demo-system', NOW()-INTERVAL '95 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Liang Zhang (Supply Chain Attack)', ARRAY['supply-chain','apt','third-party','compromise','chinese']::text[], 'Supply chain attack specialist. Responsible for compromises via third-party vendors and open-source package poisoning. NPM and PyPI repository tampering linked to OLGA SERGEEVA.', 92, true, NULL, 'demo-system', NOW()-INTERVAL '94 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Nina Petrova (Social Engineering)', ARRAY['social-engineering','deepfake','impersonation','ai-tools','ukrainian']::text[], 'Social engineering and deepfake specialist. Uses AI-generated voices and deepfake videos for impersonation attacks against executives at MetaCorp and JPMorgan Demo.', 84, true, NULL, 'demo-system', NOW()-INTERVAL '93 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Priya Sharma (Insider Threat)', ARRAY['insider-threat','data-theft','tech-company','disgruntled','indian']::text[], 'Suspected insider threat at tech company. Disgruntled employee allegedly providing internal access to threat actors. Under investigation.', 87, true, NULL, 'demo-system', NOW()-INTERVAL '92 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('James Okafor (BEC Actor)', ARRAY['bec','fraud','impersonation','financial-crime','nigerian']::text[], 'Business Email Compromise (BEC) actor. Conducts CEO fraud and invoice scams targeting financial institutions. Linked to JPMorgan Demo and PayPal Demo compromise.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '91 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Robert Chen (MetaCorp CEO)', ARRAY['victim','metacorp','ceo','high-profile','breach','american']::text[], 'MetaCorp CEO. High-profile victim of MetaCorp breach. 2.9B records exfiltrated. Executive credentials found in stealer logs.', 45, false, NULL, 'demo-system', NOW()-INTERVAL '90 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sarah Mitchell (MetaCorp CTO)', ARRAY['victim','metacorp','cto','technical','breach','american']::text[], 'MetaCorp CTO. Technical leadership role compromised in MetaCorp breach. Linked to CVE-2026-99001 exploitation chain.', 42, false, NULL, 'demo-system', NOW()-INTERVAL '89 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Michael Brown (MetaCorp IT Admin)', ARRAY['victim','metacorp','it-admin','privileged','stealer-log','american']::text[], 'MetaCorp IT Administrator. High-privilege account found in Raccoon stealer logs from meta-host-005. Domain admin access confirmed.', 78, true, NULL, 'demo-system', NOW()-INTERVAL '88 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('David Kim (MetaCorp DevOps)', ARRAY['victim','metacorp','devops','cloud','stealer-log','american']::text[], 'MetaCorp DevOps Engineer. Cloud infrastructure access found in stealer logs. AWS and Azure credentials potentially compromised.', 75, true, NULL, 'demo-system', NOW()-INTERVAL '87 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jennifer Wu (MetaCorp HR Director)', ARRAY['victim','metacorp','hr','employee-data','breach','american']::text[], 'MetaCorp HR Director. Employee records and sensitive HR data potentially exposed in breach. Linked to MetaCorp 500K employee database dump.', 55, false, NULL, 'demo-system', NOW()-INTERVAL '86 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Victoria Sterling (JPMorgan Demo CEO)', ARRAY['victim','jpmorgan-demo','ceo','high-profile','financial','american']::text[], 'JPMorgan Demo CEO. High-profile financial sector victim. Internal network access confirmed compromised. ALPHV/BlackCat auction started at $75K.', 60, false, NULL, 'demo-system', NOW()-INTERVAL '85 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Alexander Morgan (JPMorgan Trading)', ARRAY['victim','jpmorgan-demo','trading','bloomberg','stealer-log','british']::text[], 'JPMorgan Demo Head of Trading. Bloomberg Terminal credentials found in Vidar stealer logs (jpm-host-002). Trading system access confirmed compromised.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '84 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Marcus Thompson (JPMorgan IT Director)', ARRAY['victim','jpmorgan-demo','it-director','domain-admin','critical','american']::text[], 'JPMorgan Demo IT Director. Domain admin account found in Raccoon stealer logs. Full internal network compromise confirmed.', 92, true, NULL, 'demo-system', NOW()-INTERVAL '83 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Emily Chen (JPMorgan Risk Analyst)', ARRAY['victim','jpmorgan-demo','risk-analyst','clearance-l3','american']::text[], 'JPMorgan Demo Risk Analyst. Level 3 security clearance. Risk dashboard access found in Lumma stealer logs.', 65, false, NULL, 'demo-system', NOW()-INTERVAL '82 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Richard Hayes (JPMorgan Senior Trader)', ARRAY['victim','jpmorgan-demo','senior-trader','derivatives','stealer-log','american']::text[], 'JPMorgan Demo Senior Trader (Derivatives desk). Bloomberg and internal trading credentials captured by Vidar stealer. Trading system compromise.', 80, true, NULL, 'demo-system', NOW()-INTERVAL '81 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jonathan Lee (Google Demo Cloud Architect)', ARRAY['victim','google-demo','cloud-architect','gcp','stealer-log','american']::text[], 'Google Demo Cloud Architect. GCP service account keys found in stealer logs from google-host-001. 12 projects with Owner permissions compromised. NEXUS-THREAT linked.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '80 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Lisa Park (Google Demo Security Engineer)', ARRAY['victim','google-demo','security-engineer','service-account','american']::text[], 'Google Demo Security Engineer. Service account credentials found in GitHub public repo (gh-google-001). GCP BigQuery and GCS access compromised. NEXUS-STEALER-01 linked.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '79 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Thomas Anderson (Google Demo Data Engineer)', ARRAY['victim','google-demo','data-engineer','bigquery','stealer-log','german']::text[], 'Google Demo Data Engineer. BigQuery access credentials found in Lumma stealer logs (google-host-003). Analytics data potentially exfiltrated.', 72, true, NULL, 'demo-system', NOW()-INTERVAL '78 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Daniel Garcia (Microsoft Demo Azure Admin)', ARRAY['victim','microsoft-demo','azure-admin','global-admin','critical','american']::text[], 'Microsoft Demo Azure AD Global Admin. Global admin credentials found in Raccoon stealer logs (ms-host-001). Full Azure tenant compromise. LockBit affiliate selling access for $20K.', 96, true, NULL, 'demo-system', NOW()-INTERVAL '77 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Rachel Torres (Microsoft Demo DevOps Lead)', ARRAY['victim','microsoft-demo','devops','azure-devops','stealer-log','american']::text[], 'Microsoft Demo DevOps Lead. Azure DevOps credentials found in RedLine stealer logs (ms-host-002). Project Collection Admin access. Source code potentially exposed.', 81, true, NULL, 'demo-system', NOW()-INTERVAL '76 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Kevin Walsh (Microsoft Demo SQL Admin)', ARRAY['victim','microsoft-demo','sql-admin','db-owner','stealer-log','american']::text[], 'Microsoft Demo SQL Administrator. Azure SQL db_owner credentials found in Lumma stealer logs (ms-host-003). Database access confirmed compromised.', 78, true, NULL, 'demo-system', NOW()-INTERVAL '75 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Amanda Foster (Amazon Demo DevOps)', ARRAY['victim','amazon-demo','devops','aws','stealer-log','american']::text[], 'Amazon Demo DevOps Engineer. AWS credentials found in Raccoon stealer logs (aws-host-001). PowerUser role with access to multiple regions.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '74 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Christopher Lee (Amazon Demo Root)', ARRAY['victim','amazon-demo','root-account','admin','critical','american']::text[], 'Amazon Demo Root Account Holder. AWS root credentials found in paste site (paste-aws-001) and Stealc stealer logs (aws-host-004). Full AWS account compromise with unrestricted access.', 98, true, NULL, 'demo-system', NOW()-INTERVAL '73 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jessica Martinez (Amazon Demo Seller)', ARRAY['victim','amazon-demo','seller','seller-central','american']::text[], 'Amazon Demo Premium Seller. Seller Central credentials found in RedLine stealer logs (aws-host-002). Sales data and payment information potentially accessed.', 68, false, NULL, 'demo-system', NOW()-INTERVAL '72 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Brandon Scott (Apple Demo Enterprise Admin)', ARRAY['victim','apple-demo','enterprise-admin','mdm','stealer-log','american']::text[], 'Apple Demo Enterprise Admin. MDM credentials found in stealer logs. 500 devices under management potentially compromised. PHANTOM-SHADOW linked to iCloud breach.', 83, true, NULL, 'demo-system', NOW()-INTERVAL '71 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sophia Turner (Netflix Demo Content Exec)', ARRAY['victim','netflix-demo','content-exec','premium-account','american']::text[], 'Netflix Demo Content Executive. Premium account credentials found in stealer logs. Content production data potentially exposed. PHANTOM-SHADOW attributed.', 60, false, NULL, 'demo-system', NOW()-INTERVAL '70 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Lucas Fernandez (Spotify Demo Artist)', ARRAY['victim','spotify-demo','artist','1.2m-followers','stealer-log','spanish']::text[], 'Spotify Demo Artist with 1.2M followers. Spotify for Artists credentials found in stealer logs. Payout data ($45K) and listener analytics potentially exposed.', 72, true, NULL, 'demo-system', NOW()-INTERVAL '69 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Nina Patel (PayPal Demo Merchant)', ARRAY['victim','paypal-demo','merchant','balance-125k','stealer-log','indian']::text[], 'PayPal Demo Merchant with $125K balance. Merchant credentials found in Stealc stealer logs. Financial access confirmed compromised. CYBER-SHADOW selling access on darkweb.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '68 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Michael Johnson (Salesforce Demo Admin)', ARRAY['victim','salesforce-demo','admin','system-admin','stealer-log','american']::text[], 'Salesforce Demo System Admin. Admin credentials found in stealer logs. 200K CRM org data potentially exposed. DEMO-RANSOM-01 linked.', 84, true, NULL, 'demo-system', NOW()-INTERVAL '67 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sarah Connor (Uber Demo Engineering Manager)', ARRAY['victim','uber-demo','engineering-manager','ATG-team','stealer-log','american']::text[], 'Uber Demo Engineering Manager (ATG team). Credentials found in stealer logs. Self-driving technology data potentially at risk. DEMO-RANSOM-02 linked.', 79, true, NULL, 'demo-system', NOW()-INTERVAL '66 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Andrew Wilson (LinkedIn Demo Recruiter)', ARRAY['victim','linkedin-demo','recruiter','premium','stealer-log','american']::text[], 'LinkedIn Demo Premium Recruiter. 900M profile data scraped by SILENT-RIFT group. 50 inmail credits and candidate data exposed.', 65, false, NULL, 'demo-system', NOW()-INTERVAL '65 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Erik Johansson (Steam Demo VIP Gamer)', ARRAY['victim','steam-demo','gamer-vip','inventory-2500','stealer-log','swedish']::text[], 'Steam Demo VIP Gamer with $2,500 inventory value. Steam credentials found in Aurora stealer logs (steam-host-001). CYBER-SHADOW selling gaming accounts on darkweb at $50/account.', 70, true, NULL, 'demo-system', NOW()-INTERVAL '64 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Maria Santos (TikTok Demo Creator)', ARRAY['victim','tiktok-demo','creator','5m-followers','stealer-log','brazilian']::text[], 'TikTok Demo Creator with 5M followers. Creator account credentials found in Raccoon stealer logs (tiktok-host-001). Payout and analytics data potentially accessed.', 74, true, NULL, 'demo-system', NOW()-INTERVAL '63 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('James Turner (TikTok Demo Brand Partner)', ARRAY['victim','tiktok-demo','brand-partner','verified','stealer-log','british']::text[], 'TikTok Demo Verified Brand Partner. Brand advertising credentials found in RedLine stealer logs (tiktok-host-002). Ad spend and campaign data exposed.', 71, true, NULL, 'demo-system', NOW()-INTERVAL '62 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Ivan Petrov (Ransomware Developer)', ARRAY['ransomware-dev','builder','double-extortion','russian']::text[], 'Ransomware developer. Created DEMO-RANSOM-01 (DeadboltDemo) and DEMO-RANSOM-02 (CryptVault) families. Uses double-extortion model with data leak threats.', 94, true, NULL, 'demo-system', NOW()-INTERVAL '61 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Yuri Sokolov (Botnet Operator)', ARRAY['botnet','operator','drdos','infrastructure','russian']::text[], 'Botnet operator. Manages large-scale botnet infrastructure used for DDoS attacks and spam campaigns. Linked to ransomware distribution.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '60 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Gabor Nagy (ATM Malware Developer)', ARRAY['atm-malware','jackpotting','financial-crime','hungarian']::text[], 'ATM malware (jackpotting) developer. Targets financial institutions including JPMorgan Demo Bank. Playscale ATM malware linked to him.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '59 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Fedor Ivanov (Banking Trojan Dev)', ARRAY['banking-trojan','emotet','loader','malware-dev','russian']::text[], 'Banking trojan and loader developer. Created malware used against JPMorgan Demo Bank and PayPal Demo. Emotet-style distribution chain.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '58 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Zhang Wei (Cryptominer Operator)', ARRAY['cryptominer','crypto-jacking','cloud-exploitation','chinese']::text[], 'Cryptominer operator. Exploits cloud environments (AWS, GCP, Azure) for cryptocurrency mining. Linked to NEXUS-THREAT group.', 82, true, NULL, 'demo-system', NOW()-INTERVAL '57 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Rafael Costa (POS Malware Developer)', ARRAY['pos-malware','memory-scraping','retail-fraud','brazilian']::text[], 'Point-of-sale malware developer. Creates memory-scraping malware for retail environments. Linked to payment card theft from streaming service subscribers.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '56 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Gabriel Moreau (Government Spyware Dev)', ARRAY['spyware','government','surveillance','mercenary','french']::text[], 'Government spyware developer. Creates surveillance tools sold to nation-state actors. Linked to multiple APT groups including DEMO-APT-01.', 93, true, NULL, 'demo-system', NOW()-INTERVAL '55 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Dmitri Volkov (DDoS-for-Hire)', ARRAY['ddos','booter','stressor','hired-gunner','russian']::text[], 'DDoS-for-hire (booter/stresser) service operator. Offers paid DDoS attacks targeting streaming platforms and financial institutions. Operates stresser platform.', 79, true, NULL, 'demo-system', NOW()-INTERVAL '54 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Alexei Petrov (Carding Forum Admin)', ARRAY['carding','forum-admin','financial-crime','underground','russian']::text[], 'Carding forum administrator. Manages underground forum for selling stolen payment cards and credentials. Linked to JPMorgan Demo and PayPal Demo card data.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '53 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Carlos Reyes (SIM Swap Specialist)', ARRAY['sim-swap','cryptocurrency-theft','telecom-fraud','colombian']::text[], 'SIM swap fraud specialist. Conducts telecom fraud to hijack phone numbers for cryptocurrency theft. Targets executives at financial institutions.', 87, true, NULL, 'demo-system', NOW()-INTERVAL '52 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Oleg Volkov (MaaS Operator)', ARRAY['maas','fake-id','identity-fraud','service-operator','russian']::text[], 'Malware-as-a-Service (MaaS) operator. Provides stealer malware (Raccoon, Lumma, RedLine) as subscription service to affiliates. Manages C2 infrastructure.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '51 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Anna Kowalski (MetaCorp VP Engineering)', ARRAY['victim','metacorp','vp-engineering','high-privilege','polish']::text[], 'MetaCorp VP of Engineering. High-privilege account potentially compromised in MetaCorp breach. Engineering team leadership access.', 55, false, NULL, 'demo-system', NOW()-INTERVAL '50 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Thomas Wright (MetaCorp Security Analyst)', ARRAY['victim','metacorp','security-analyst','stealer-log','australian']::text[], 'MetaCorp Security Analyst. Security tooling credentials found in Raccoon stealer logs. Could enable lateral movement within security infrastructure.', 73, true, NULL, 'demo-system', NOW()-INTERVAL '49 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sven Eriksson (Google Demo SRE)', ARRAY['victim','google-demo','sre','cloud-platform','stealer-log','swedish']::text[], 'Google Demo Site Reliability Engineer. Cloud infrastructure access found in stealer logs. NEXUS-THREAT targeting cloud platform engineers.', 80, true, NULL, 'demo-system', NOW()-INTERVAL '48 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Fatima Al-Rashid (Microsoft Demo Identity)', ARRAY['victim','microsoft-demo','identity-specialist','azure-ad','saudi']::text[], 'Microsoft Demo Identity Specialist. Azure AD identity management credentials found in Lumma stealer logs. Could enable identity-based attacks.', 83, true, NULL, 'demo-system', NOW()-INTERVAL '47 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Yuki Yamamoto (Amazon Demo Lambda Dev)', ARRAY['victim','amazon-demo','lambda-developer','serverless','japanese']::text[], 'Amazon Demo Lambda Developer. Serverless function execution access potentially compromised. NEXUS-THREAT targeting AWS Lambda environments.', 69, false, NULL, 'demo-system', NOW()-INTERVAL '46 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Diana Collins (JPMorgan Compliance)', ARRAY['victim','jpmorgan-demo','compliance','regulatory','british']::text[], 'JPMorgan Demo Compliance Officer. Regulatory and audit system access potentially compromised. ALPHV/BlackCat targeting compliance data.', 58, false, NULL, 'demo-system', NOW()-INTERVAL '45 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Kenji Watanabe (Netflix Demo Infra Eng)', ARRAY['victim','netflix-demo','infra-engineer','cdn','stealer-log','japanese']::text[], 'Netflix Demo Infrastructure Engineer. CDN and content delivery infrastructure access found in stealer logs. PHANTOM-SHADOW targeting streaming infrastructure.', 77, true, NULL, 'demo-system', NOW()-INTERVAL '44 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Omar Hassan (PayPal Demo API Dev)', ARRAY['victim','paypal-demo','api-developer','merchant-integration','egyptian']::text[], 'PayPal Demo API Developer. Merchant integration API credentials found in Stealc stealer logs. CVE-2026-99999 (API SQL injection) exploited against his systems.', 74, true, NULL, 'demo-system', NOW()-INTERVAL '43 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Maria Gonzalez (Spotify Demo Label Manager)', ARRAY['victim','spotify-demo','label-manager','music-industry','spanish']::text[], 'Spotify Demo Label Manager. Music industry partner access potentially compromised. PHANTOM-SHADOW targeting entertainment sector.', 61, false, NULL, 'demo-system', NOW()-INTERVAL '42 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Ryan Hughes (Salesforce Demo Integration Dev)', ARRAY['victim','salesforce-demo','integration-dev','connected-app','irish']::text[], 'Salesforce Demo Integration Developer. Connected app OAuth credentials found in stealer logs. CRM data for 200K organizations potentially accessible.', 75, true, NULL, 'demo-system', NOW()-INTERVAL '41 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('MarketAdmin (Darkweb - Versus Market)', ARRAY['darkweb','marketplace-admin','versus','moderator','unknown']::text[], 'Versus darkweb marketplace administrator. Manages vendor verification, escrow, and dispute resolution for stolen data and access sales. Multiple demo company data listed.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '40 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('DarkVendor-01 (Darkweb Premium Seller)', ARRAY['darkweb','vendor','premium-seller','verified','russian']::text[], 'Premium darkweb vendor. Specializes in MetaCorp and TikTok Demo database sales. Verified seller with 500+ transactions. Selling 2.9B+ MetaCorp records and 1.2B TikTok records.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '39 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('DarkVendor-02 (Darkweb - AlphBay)', ARRAY['darkweb','vendor','financial-access','premium','unknown']::text[], 'AlphBay darkweb marketplace vendor specializing in financial sector access. Selling JPMorgan Demo Bank and Microsoft Demo Azure access. $20K-$75K range.', 92, true, NULL, 'demo-system', NOW()-INTERVAL '38 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Roman Volkov (Exploit Kit Developer)', ARRAY['exploit-kit','kit-dev','web-exploit','angler','russian']::text[], 'Exploit kit developer. Created web exploitation kits used in phishing campaigns against MetaCorp, Google Demo, and Amazon Demo employees. CVE-2026-99001 toolkit included.', 89, true, NULL, 'demo-system', NOW()-INTERVAL '37 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Elena Petrova (Ransomware Negotiator)', ARRAY['ransomware','negotiator','victim-interaction','double-extortion','russian']::text[], 'Ransomware group negotiator. Handles victim communication for DEMO-RANSOM-01 and LockBit affiliates. Negotiates ransom payments ranging from $500K to $5M.', 87, true, NULL, 'demo-system', NOW()-INTERVAL '36 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Sanjay Gupta (Mobile Trojan Developer)', ARRAY['mobile-trojan','banking-trojan','android','malware-dev','indian']::text[], 'Mobile banking trojan developer. Creates Android malware targeting banking apps including JPMorgan Demo mobile and PayPal Demo. Distributed via fake app stores.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '35 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Max Kramer (Ex-Penetration Tester)', ARRAY['red-team','ex-pentester','turned-dark','social-engineering','german']::text[], 'Former penetration tester turned threat actor. Uses red team techniques for social engineering and network intrusion. Linked to JPMorgan Demo Bank compromise via phishing.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '34 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('ShadowAdmin (Dark Web Forum Mod)', ARRAY['forum','moderator','underground','reputation','unknown']::text[], 'Underground forum moderator. Manages reputation systems and vendor verification for darkweb markets. High standing in cybercriminal community. Linked to credential sales.', 84, true, NULL, 'demo-system', NOW()-INTERVAL '33 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Pavel Sergeev (Bulletproof Hosting)', ARRAY['vpn-service','anonymization','bulletproof-hosting','infrastructure','russian']::text[], 'Bulletproof hosting and VPN service operator. Provides anonymous infrastructure for threat actors including C2 servers at 198.51.100.50, 203.0.113.200. No DMCA or law enforcement compliance.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '32 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jin-Ho Park (Browser Extension Malware)', ARRAY['browser-extension','chrome','credential-harvest','browser-stealer','south-korean']::text[], 'Malicious browser extension developer. Creates Chrome extensions that harvest credentials and cookies. Linked to Google Demo and Amazon Demo credential theft.', 83, true, NULL, 'demo-system', NOW()-INTERVAL '31 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Robert Anderson (Suspected Insider)', ARRAY['suspected-insider','financial','fraud','investigation','american']::text[], 'Suspected insider at financial institution. Under investigation for providing internal access to external threat actors. Linked to JPMorgan Demo Bank compromise.', 78, true, NULL, 'demo-system', NOW()-INTERVAL '30 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Marcus Webb (Cobalt Strike Operator)', ARRAY['cobalt-strike','c2-framework','pentest-tool','abuse','american']::text[], 'Cobalt Strike C2 framework operator. Uses pentest tool for malicious purposes against demo companies. Linked to lateral movement in MetaCorp and JPMorgan Demo networks.', 90, true, NULL, 'demo-system', NOW()-INTERVAL '29 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Andrei Popescu (Emotet Distributor)', ARRAY['emotet','malware-distributor','loader','spam','romanian']::text[], 'Emotet malware distributor. Manages Emotet botnet and distributes banking trojans via malicious documents. Linked to JPMorgan Demo and PayPal Demo initial access.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '28 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Liam O''Brien (Credential Stuffing)', ARRAY['credential-stuffing','account-takeover','automation','scaling','irish']::text[], 'Credential stuffing operator. Runs automated attacks against streaming platforms and social media using leaked credential combos. Linked to Netflix Demo and Spotify Demo compromise.', 84, true, NULL, 'demo-system', NOW()-INTERVAL '27 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Agent Alpha (Undercover Researcher)', ARRAY['undercover','osint','darkweb-research','investigation','unknown']::text[], 'Undercover OSINT researcher investigating darkweb markets. Gathering intelligence on threat actors and data breach sellers. Anonymous persona.', 70, false, NULL, 'demo-system', NOW()-INTERVAL '26 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Satoshi Demo (Crypto Exchange Hacker)', ARRAY['crypto-exchange','hack','exchange-breach','fund-theft','japanese']::text[], 'Cryptocurrency exchange hacker. Responsible for crypto exchange breaches and fund theft. Linked to SIM swap attacks against financial executives.', 93, true, NULL, 'demo-system', NOW()-INTERVAL '25 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Nina Volkov (Social Engineering)', ARRAY['social-engineering','spear-phishing','pretexting','vishing','russian']::text[], 'Social engineering specialist. Conducts spear-phishing, vishing, and pretexting attacks against corporate executives. Linked to BEC operations and credential harvesting.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '24 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Tomasz Kowalski (Hardware Implant Dev)', ARRAY['hardware-implant','firmware','supply-chain','backdoor','polish']::text[], 'Hardware implant and firmware backdoor developer. Creates malicious hardware for supply chain attacks. Targets enterprise hardware suppliers.', 92, true, NULL, 'demo-system', NOW()-INTERVAL '23 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Alexis Dubois (Document Malware Dev)', ARRAY['macro-malware','document-malware','office-exploit','phishing-lure','french']::text[], 'Office document macro malware developer. Creates malicious Word and Excel documents for phishing campaigns. CVE-2026-99992 distributed via document lures.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '22 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Viktor Kozlov (Ransomware Affiliate Mgr)', ARRAY['ransomware','affiliate-manager','raas','program-operator','russian']::text[], 'Ransomware affiliate program manager. Manages DEMO-RANSOM-01 affiliate network, recruits affiliates, provides malware updates and infrastructure support.', 95, true, NULL, 'demo-system', NOW()-INTERVAL '21 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Mei Lin (Cloud Infrastructure Attacker)', ARRAY['cloud-attacker','aws','gcp','azure','infrastructure-hack','chinese']::text[], 'Cloud infrastructure attack specialist. Targets AWS, GCP, and Azure environments. Responsible for Google Demo GCP and Amazon Demo AWS breaches via NEXUS-THREAT group.', 87, true, NULL, 'demo-system', NOW()-INTERVAL '20 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Carmen Rivera (Tax Fraud Specialist)', ARRAY['tax-fraud','identity-theft','financial-crime','document-forgery','spanish']::text[], 'Tax fraud and identity theft specialist. Creates fake identities using stolen PII from breach data. Linked to financial account takeover operations.', 79, true, NULL, 'demo-system', NOW()-INTERVAL '19 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Boris Volkov (Spam Botnet Operator)', ARRAY['spam','botnet','email-campaign','phishing-scale','russian']::text[], 'Spam botnet operator. Manages large email spam infrastructure for phishing campaigns and malware distribution. Linked to phishing lures targeting MetaCorp and Google Demo employees.', 82, true, NULL, 'demo-system', NOW()-INTERVAL '18 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Hiroshi Tanaka (AI Phishing Developer)', ARRAY['ai-phishing','llm-tools','social-engineering','automation','japanese']::text[], 'AI-powered phishing tool developer. Uses LLMs to generate personalized phishing content at scale. Automated spear-phishing campaigns against financial sector executives.', 85, true, NULL, 'demo-system', NOW()-INTERVAL '17 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Jake Wilson (Gaming Cheat Developer)', ARRAY['game-cheat','malware','steam','account-theft','american']::text[], 'Gaming cheat and malware developer. Creates Steam account theft tools and game exploits. Linked to CYBER-SHADOW group targeting gaming platforms.', 73, true, NULL, 'demo-system', NOW()-INTERVAL '16 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Grace Adeyemi (Charity Fraud Actor)', ARRAY['charity-fraud','scam','social-engineering','donation-theft','nigerian']::text[], 'Charity fraud and social engineering specialist. Uses fake personas and emotional manipulation to steal donations and credentials. Linked to BEC operations.', 76, true, NULL, 'demo-system', NOW()-INTERVAL '15 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Ankur Sharma (Tech Support Scam Op)', ARRAY['tech-support-scam','social-engineering','impersonation','fraud','indian']::text[], 'Tech support scam operator. Runs phone and web-based tech support scams impersonating Microsoft, Google, and Amazon support. Linked to credential theft.', 80, true, NULL, 'demo-system', NOW()-INTERVAL '14 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Chioma Eze (Romance Scam Operator)', ARRAY['romance-scam','social-engineering','catfishing','fraud','nigerian']::text[], 'Romance scam and catfishing operator. Creates fake personas to build relationships and extract money or credentials. Part of larger financial fraud network.', 74, true, NULL, 'demo-system', NOW()-INTERVAL '13 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Agent Delta (Law Enforcement Undercover)', ARRAY['law-enforcement','darkweb-investigator','undercover','le-ad','american']::text[], 'Undercover law enforcement agent investigating darkweb markets and threat actors. Gathering evidence on credential sales and data breaches.', 55, false, NULL, 'demo-system', NOW()-INTERVAL '12 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Julia Chen (Corporate Espionage)', ARRAY['corporate-espionage','competitor','industrial-spy','insider','chinese']::text[], 'Corporate espionage actor. Conducts industrial espionage against technology and finance companies. Uses insider access and social engineering to steal trade secrets.', 88, true, NULL, 'demo-system', NOW()-INTERVAL '11 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Marcus Reed (Ambiguous Whistleblower)', ARRAY['whistleblower','insider','ambiguous','investigation','american']::text[], 'Ambiguous figure claiming to be a whistleblower with access to internal security data. Under investigation to determine if legitimate or threat actor cover story.', 68, false, NULL, 'demo-system', NOW()-INTERVAL '10 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Kai Zhang (DDoS Extortion Actor)', ARRAY['ddos-extortion','ransom-ddos','group-nexus','denial-of-service','chinese']::text[], 'DDoS extortion actor. Conducts Ransom DDoS attacks against streaming platforms and financial institutions. Demands payment to stop attacks.', 86, true, NULL, 'demo-system', NOW()-INTERVAL '9 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Artem Koval (Rootkit Developer)', ARRAY['rootkit','kernel-level','persistence','stealth-malware','ukrainian']::text[], 'Rootkit and kernel-level malware developer. Creates persistent stealth malware for long-term access. Linked to APT groups requiring stealthy intrusion capabilities.', 91, true, NULL, 'demo-system', NOW()-INTERVAL '8 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Daniel Foster (Investment Fraud)', ARRAY['ponzi','investment-fraud','startup-scam','financial-crime','british']::text[], 'Investment fraud and Ponzi scheme operator. Uses fake startups and stolen identity data to defraud investors. Linked to cryptocurrency theft operations.', 77, true, NULL, 'demo-system', NOW()-INTERVAL '7 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Viktor Petrov (Chrome Extension Malware)', ARRAY['chrome-extension','browser-hijack','adware','credential-steal','russian']::text[], 'Malicious Chrome extension author. Creates browser hijackers and credential-stealing extensions distributed via Chrome Web Store. Linked to Google Demo credential theft.', 80, true, NULL, 'demo-system', NOW()-INTERVAL '6 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Wei Li (Malicious DeFi Auditor)', ARRAY['smart-contract','audit-fraud','defi-exploit','crypto-scam','chinese']::text[], 'Malicious DeFi smart contract auditor. Conducts fake audits then exploits vulnerabilities in DeFi protocols. Linked to cryptocurrency theft from defi projects.', 83, true, NULL, 'demo-system', NOW()-INTERVAL '5 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Olga Sergeeva (Supply Chain Poisoner)', ARRAY['supply-chain','package-poisoning','npm-pypi','open-source-tamper','russian']::text[], 'Supply chain package poisoner. Tampers with NPM and PyPI open-source packages to inject malware. Targets developers at Google Demo, Amazon Demo, and Microsoft Demo.', 89, true, NULL, 'demo-system', NOW()-INTERVAL '4 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Ivan Volkov (Disinformation Operator)', ARRAY['disinformation','fake-news','influence-op','social-media-manipulation','russian']::text[], 'Disinformation and influence operation specialist. Runs social media manipulation campaigns and fake news operations. Linked to state-sponsored influence operations.', 82, true, NULL, 'demo-system', NOW()-INTERVAL '3 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Yosef Cohen (Malvertising Operator)', ARRAY['malvertising','ad-network','malware-distribution','drive-by-download','israeli']::text[], 'Malvertising network operator. Runs malicious advertising campaigns distributing malware via ad networks. Drive-by downloads and exploit kit redirects.', 84, true, NULL, 'demo-system', NOW()-INTERVAL '2 days')
ON CONFLICT (name) DO NOTHING;

INSERT INTO face_identities (name, tags, notes, threat_score, is_watchlist, threads_username, created_by, created_at)
VALUES ('Zara Ahmed (Biometric Data Exploiter)', ARRAY['biometric-theft','facial-recognition','data-breach','privacy','pakistani']::text[], 'Biometric data exploitation specialist. Steals and trades facial recognition data and biometric information from data breaches. Linked to identity fraud operations.', 81, true, NULL, 'demo-system', NOW()-INTERVAL '1 days')
ON CONFLICT (name) DO NOTHING;
