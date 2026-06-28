-- ================================================
-- IntelForge - Demo Search Index Data
-- ------------------------------------------------
-- Populates search_index + search_index_lines with
-- realistic synthetic data across 12+ formats:
--   • Database dumps
--   • Pastebin leaks
--   • ULP (URL:Login:Password) logs
--   • Compromised machines
--   • Forum posts
--   • Dark web intel
--   • OSINT feeds
--   • Paste OSINT
--   • Mix records
--   • Telegram intel
--   • Threat actor reports
--   • Stealer logs
--
-- All data is SYNTHETIC. Passwords are placeholders.
-- Domains use .invalid TLD. Names are fictional.
-- Idempotent: ON CONFLICT DO NOTHING.
-- ================================================

-- ============================================
-- FILE 1: Database Dump (SQL format)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9001, '/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 284000, 18, 'database_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 1, '-- Database Export: demo_ecommerce_shop | Exported: 2026-05-15', 'database_dump', NULL, NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 2, 'INSERT INTO customers (email, name, phone, country) VALUES', 'database_dump', NULL, NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 3, '(''j****@shopdemo.invalid'', ''James R.'', ''+1-555-****-7821'', ''US'');', 'database_dump', 'United States', NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 4, '(''m****@shopdemo.invalid'', ''Maria K.'', ''+44-7700-****-42'', ''UK'');', 'database_dump', 'United Kingdom', NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 5, '(''a****@shopdemo.invalid'', ''Ahmed S.'', ''+971-50-****-88'', ''UAE'');', 'database_dump', 'UAE', NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 6, 'INSERT INTO orders (customer_email, total, card_last4) VALUES', 'database_dump', NULL, NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 7, '(''j****@shopdemo.invalid'', 459.99, ''****4821'');', 'database_dump', 'United States', NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 8, '(''m****@shopdemo.invalid'', 1299.00, ''****7733'');', 'database_dump', 'United Kingdom', NOW()),
('/data/leaks/demo-ecommerce-db-2026.sql', 'demo-ecommerce-db-2026.sql', 9, '-- Total records: 284,000 customers | 1.2M orders | Source: demo breach simulation', 'database_dump', NULL, NOW());


-- ============================================
-- FILE 2: Pastebin Leak
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9002, '/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 156000, 12, 'pastebin', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 1, '[PASTE] Title: Fortune 500 Employee Credentials - Fresh May 2026', 'pastebin', NULL, NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 2, '[PASTE] Author: anon_leaker | Date: 2026-05-20 | Lines: 45,000', 'pastebin', NULL, NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 3, 'r.smith****@megacorp.invalid:<REDACTED_DEMO_PASSWORD> | VPN Portal', 'pastebin', 'United States', NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 4, 'l.chen****@globaltech.invalid:<REDACTED_DEMO_PASSWORD> | OWA Access', 'pastebin', 'Singapore', NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 5, 'd.mueller****@eurobank.invalid:<REDACTED_DEMO_PASSWORD> | SAP Portal', 'pastebin', 'Germany', NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 6, 'k.tanaka****@jpfinance.invalid:<REDACTED_DEMO_PASSWORD> | Citrix VDI', 'pastebin', 'Japan', NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 7, 'p.silva****@latamhealth.invalid:<REDACTED_DEMO_PASSWORD> | Email', 'pastebin', 'Brazil', NOW()),
('/data/pastes/pastebin-leak-fortune500-2026.txt', 'pastebin-leak-fortune500-2026.txt', 8, '-- Source: Redline stealer logs aggregated from 3 Telegram channels', 'pastebin', NULL, NOW());

-- ============================================
-- FILE 3: ULP (URL:Login:Password) Stealer Logs
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9003, '/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 890000, 15, 'ulp_stealer', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 1, '=== Redline Stealer Logs | Batch: 2026-05-18 | Machine: DESKTOP-A****Z ===', 'ulp_stealer', 'United States', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 2, 'URL: https://accounts.examplebank.invalid/login | USER: j****@mail.invalid | PASS: <REDACTED:11>', 'ulp_stealer', 'United States', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 3, 'URL: https://portal.healthcare-demo.invalid/sso | USER: nurse.k****@hc.invalid | PASS: <REDACTED:14>', 'ulp_stealer', 'United States', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 4, 'URL: https://vpn.govdept.invalid/remote | USER: g.officer****@gov.invalid | PASS: <REDACTED:16>', 'ulp_stealer', 'United Kingdom', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 5, 'URL: https://erp.manufacturing.invalid/sap | USER: prod.mgr****@mfg.invalid | PASS: <REDACTED:12>', 'ulp_stealer', 'Germany', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 6, 'URL: https://mail.university.invalid/owa | USER: prof.a****@uni.invalid | PASS: <REDACTED:9>', 'ulp_stealer', 'Australia', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 7, 'URL: https://admin.cloudhost.invalid/panel | USER: root****@cloud.invalid | PASS: <REDACTED:18>', 'ulp_stealer', 'Netherlands', NOW()),
('/data/stealer/redline-ulp-batch-2026-05.txt', 'redline-ulp-batch-2026-05.txt', 8, '--- Cookies: 312 | Autofill: 47 | Crypto wallets: 2 | CC saved: 1 ---', 'ulp_stealer', NULL, NOW());

-- ============================================
-- FILE 4: Compromised Machines Log
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9004, '/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 45000, 10, 'compromised_machines', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 1, 'hostname,ip,os,stealer,country,creds_count,cookies,first_seen', 'compromised_machines', NULL, NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 2, 'DESKTOP-A****Z,10.x.x.x,Windows 10 Pro,Redline,United States,47,312,2026-05-18', 'compromised_machines', 'United States', NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 3, 'LAPTOP-K****9,10.x.x.x,Windows 11,Lumma,United Kingdom,62,180,2026-05-19', 'compromised_machines', 'United Kingdom', NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 4, 'PC-MFG-****7,10.x.x.x,Windows 10 LTSC,Raccoon,Germany,38,240,2026-05-20', 'compromised_machines', 'Germany', NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 5, 'WS-FIN-****3,10.x.x.x,Windows 11,Vidar,France,55,290,2026-05-21', 'compromised_machines', 'France', NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 6, 'SRV-DEV-****1,10.x.x.x,Ubuntu 22.04,Meta,Italy,71,410,2026-05-22', 'compromised_machines', 'Italy', NOW()),
('/data/machines/compromised-hosts-may2026.csv', 'compromised-hosts-may2026.csv', 7, '--- Total: 1,247 machines | 89,000 credentials | 45 countries ---', 'compromised_machines', NULL, NOW());


-- ============================================
-- FILE 5: Forum Post (underground)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9005, '/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 12000, 10, 'forum_post', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 1, '[FORUM: XSS.is] Thread: Selling MOVEit Transfer access - 3 orgs', 'forum_post', NULL, NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 2, 'Author: darkbroker_77 | Posted: 2026-05-22 14:33 UTC | Views: 847', 'forum_post', NULL, NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 3, 'Selling initial access to 3 MOVEit Transfer instances. CVE-2023-34362 still unpatched.', 'forum_post', NULL, NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 4, 'Targets: 1x US healthcare (500+ beds), 1x EU manufacturing, 1x AU legal firm', 'forum_post', 'United States', NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 5, 'Price: $15,000 per access. Bulk discount available. Escrow accepted.', 'forum_post', NULL, NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 6, 'Reply from user cl0p_affiliate: "DM sent. Interested in the healthcare one."', 'forum_post', NULL, NOW()),
('/data/forums/xss-forum-thread-moveit-access.txt', 'xss-forum-thread-moveit-access.txt', 7, 'Reply from user lockbit_recruiter: "We take all 3. Contact via TOX."', 'forum_post', NULL, NOW());

-- ============================================
-- FILE 6: Dark Web Intel Report
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9006, '/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 34000, 12, 'darkweb_intel', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 1, '=== LockBit 4.0 Leak Site Scrape | Date: 2026-05-25 ===', 'darkweb_intel', NULL, NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 2, 'NEW VICTIM: DemoHealth Network (UK) | Sector: Healthcare | Deadline: 2026-06-01', 'darkweb_intel', 'United Kingdom', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 3, 'Data: 1.2M patient records, internal emails, financial docs | Sample: 50GB posted', 'darkweb_intel', 'United Kingdom', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 4, 'NEW VICTIM: DemoCityCouncil (France) | Sector: Government | Deadline: 2026-06-03', 'darkweb_intel', 'France', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 5, 'Data: Citizen records, internal comms, SCADA network diagrams | Sample: 12GB', 'darkweb_intel', 'France', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 6, 'NEW VICTIM: PrecisionMfg (Italy) | Sector: Manufacturing | Deadline: 2026-06-05', 'darkweb_intel', 'Italy', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 7, 'Data: CAD files, supplier contracts, employee PII | OT network access confirmed', 'darkweb_intel', 'Italy', NOW()),
('/data/darkweb/lockbit-blog-scrape-2026-05.txt', 'lockbit-blog-scrape-2026-05.txt', 8, '--- Affiliate program: 80/20 split. New panel at lockbit4******.onion ---', 'darkweb_intel', NULL, NOW());

-- ============================================
-- FILE 7: OSINT Feed (aggregated intel)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9007, '/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 67000, 10, 'osint_feed', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 1, '{"feed":"osint_weekly","week":21,"year":2026,"entries":847}', 'osint_feed', NULL, NOW()),
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 2, '{"type":"domain_registration","domain":"secure-examplebank-login.invalid","registrar":"namecheap","date":"2026-05-19","risk":"high","note":"brand impersonation"}', 'osint_feed', NULL, NOW()),
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 3, '{"type":"ssl_cert","domain":"*.megacorp-vpn.invalid","issuer":"LetsEncrypt","date":"2026-05-20","risk":"medium","note":"wildcard cert for suspicious domain"}', 'osint_feed', NULL, NOW()),
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 4, '{"type":"github_exposure","repo":"dev-intern/config-backup","file":".env","secrets":["AWS_ACCESS_KEY","DB_PASSWORD"],"date":"2026-05-21"}', 'osint_feed', NULL, NOW()),
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 5, '{"type":"paste_monitor","source":"rentry","title":"Ivanti VPN exploit chain notes","cves":["CVE-2024-21887","CVE-2023-46805"],"actor":"Mustang Panda"}', 'osint_feed', NULL, NOW()),
('/data/osint/osint-feed-weekly-2026-w21.json', 'osint-feed-weekly-2026-w21.json', 6, '{"type":"dns_anomaly","domain":"democity-gov.invalid","new_ip":"203.0.113.99","old_ip":"198.51.100.1","change_date":"2026-05-22","risk":"critical"}', 'osint_feed', 'France', NOW());

-- ============================================
-- FILE 8: Paste OSINT (credential monitoring)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9008, '/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 23000, 10, 'paste_osint', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 1, '=== Paste OSINT Monitor | Scan: 2026-05-24 | Matches: 23 ===', 'paste_osint', NULL, NOW()),
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 2, 'MATCH: megacorp.invalid found in paste "Corporate VPN creds dump" (rentry.co/****)', 'paste_osint', 'United States', NOW()),
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 3, 'MATCH: eurobank.invalid found in paste "EU banking combo" (pastebin.com/****)', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 4, 'MATCH: govdept.invalid found in paste "Gov employee list" (ghostbin/****)', 'paste_osint', 'United Kingdom', NOW()),
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 5, 'MATCH: healthcare-demo.invalid found in paste "Hospital staff creds" (pastebin/****)', 'paste_osint', 'United States', NOW()),
('/data/pastes/paste-osint-monitor-may2026.txt', 'paste-osint-monitor-may2026.txt', 6, 'ALERT: 5 monitored domains found across 12 paste sites in last 7 days', 'paste_osint', NULL, NOW());

-- ============================================
-- FILE 9: Mix Record (combo/credential mix)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9009, '/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 2400000, 12, 'mix_record', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 1, '=== MIX RECORD | Format: email:password | Lines: 2.4M | Date: 2026-05-23 ===', 'mix_record', NULL, NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 2, 'user1****@gmail.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'United States', NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 3, 'admin****@company.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'Germany', NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 4, 'ceo****@startup.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'India', NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 5, 'hr.dept****@enterprise.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'Canada', NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 6, 'support****@saas-platform.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'Australia', NOW()),
('/data/combos/mix-record-global-may2026.txt', 'mix-record-global-may2026.txt', 7, '--- Stats: 2.4M lines | 890K unique domains | Top: gmail, outlook, yahoo ---', 'mix_record', NULL, NOW());

-- ============================================
-- FILE 10: Telegram Intel Channel
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9010, '/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 56000, 12, 'telegram_intel', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 1, '=== Telegram Channel: @DarkLeaks_Intel | Scraped: 2026-05-25 ===', 'telegram_intel', NULL, NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 2, '[2026-05-24 09:14] New cloud logs drop: 500 AWS accounts with active sessions', 'telegram_intel', NULL, NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 3, '[2026-05-24 11:30] Selling RDP access: 200 machines, US/EU mix, $5 each', 'telegram_intel', 'United States', NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 4, '[2026-05-24 14:55] Fresh stealer logs batch: Lumma v4.2, 12K machines, all countries', 'telegram_intel', NULL, NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 5, '[2026-05-25 08:00] BREAKING: New 0day in Fortinet FortiGate - pre-auth RCE, no CVE yet', 'telegram_intel', NULL, NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 6, '[2026-05-25 10:22] Cl0p added 2 new victims: DemoBank Northern (DE), EduCollege (US)', 'telegram_intel', 'Germany', NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 7, '[2026-05-25 13:45] LockBit affiliate selling CitrixBleed access to 8 healthcare orgs', 'telegram_intel', 'United Kingdom', NOW()),
('/data/telegram/tg-channel-darkleaks-may2026.txt', 'tg-channel-darkleaks-may2026.txt', 8, '[2026-05-25 16:10] Combolist drop: "Healthcare_US_2026" - 320K lines, URL:USER:PASS format', 'telegram_intel', 'United States', NOW());

-- ============================================
-- FILE 11: Threat Actor Report
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9011, '/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 18000, 14, 'threat_actor_report', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 1, '# Threat Actor Profile: Cl0p (TA505 affiliate)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 2, 'Aliases: CL0P, CLOP, TA505-affiliate, FIN11-linked', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 3, 'Origin: Russia/Ukraine | Active since: 2019 | Type: Ransomware-as-a-Service + Extortion', 'threat_actor_report', 'Russia', NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 4, 'Primary TTPs: Mass exploitation of file-transfer vulnerabilities (MOVEit, GoAnywhere, Accellion)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 5, 'Key CVEs: CVE-2023-34362 (MOVEit), CVE-2023-0669 (GoAnywhere), CVE-2021-27101 (Accellion)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 6, 'Victim count: 600+ organisations across Manufacturing, Finance, Healthcare, Education', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 7, 'Notable victims (2026): DemoBank Northern (DE), DemoManufacturing Corp (US), DemoEdu College (US)', 'threat_actor_report', 'United States', NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 8, 'MITRE ATT&CK: T1190 (Exploit Public-Facing App), T1486 (Data Encrypted for Impact), T1567 (Exfil Over Web)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 9, 'Infrastructure: Tor-based leak site, negotiation portal, Telegram presence for victim shaming', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-cl0p-profile-2026.md', 'threat-actor-cl0p-profile-2026.md', 10, 'Recommendation: Patch all file-transfer appliances immediately. Monitor for CVE-2023-34362 exploitation indicators.', 'threat_actor_report', NULL, NOW());

-- ============================================
-- FILE 12: Stealer Log (Lumma variant)
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9012, '/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 1200000, 10, 'stealer_log', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 1, '=== Lumma Stealer v4.2 | Batch: EU-2026-05 | Machines: 3,400 | Creds: 89,000 ===', 'stealer_log', NULL, NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 2, 'Machine: LAPTOP-EU****1 | OS: Win11 | Country: Germany | IP: 10.x.x.x', 'stealer_log', 'Germany', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 3, '  https://banking.eurobank.invalid/login | e.schmidt****@eurobank.invalid | <REDACTED:13>', 'stealer_log', 'Germany', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 4, '  https://vpn.eurobank.invalid/remote | admin.e****@eurobank.invalid | <REDACTED:16>', 'stealer_log', 'Germany', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 5, 'Machine: PC-FR****7 | OS: Win10 | Country: France | IP: 10.x.x.x', 'stealer_log', 'France', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 6, '  https://mail.democity.invalid/owa | p.dubois****@democity.invalid | <REDACTED:11>', 'stealer_log', 'France', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 7, '  https://citrix.democity.invalid/vpn | admin.p****@democity.invalid | <REDACTED:14>', 'stealer_log', 'France', NOW()),
('/data/stealer/lumma-logs-eu-batch-2026.txt', 'lumma-logs-eu-batch-2026.txt', 8, '--- Total this batch: 3,400 machines | 89,000 creds | 12 EU countries ---', 'stealer_log', NULL, NOW());

-- ============================================
-- Update search vectors for full-text search
-- ============================================
UPDATE search_index_lines
SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;
