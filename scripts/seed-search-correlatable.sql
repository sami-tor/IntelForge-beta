-- ================================================
-- IntelForge - Correlatable Search Demo Data
-- ------------------------------------------------
-- These records share common entities (emails,
-- domains, actors, IPs) across multiple file types
-- so searching for ONE thing returns hits from
-- MANY sources — demonstrating cross-source
-- correlation in the search results.
--
-- Key entities that appear across multiple files:
--   • eurobank.invalid (appears in 6+ files)
--   • megacorp.invalid (appears in 5+ files)
--   • healthcare-demo.invalid (appears in 5+ files)
--   • democity.invalid (appears in 4+ files)
--   • Cl0p (appears in 5+ files)
--   • LockBit (appears in 5+ files)
--   • CVE-2023-34362 (appears in 4+ files)
--   • 203.0.113.45 (appears in 3+ files)
-- ================================================

-- ============================================
-- FILE 13: Database Dump - EuroBank
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9013, '/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 4500000, 10, 'database_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 1, '-- EuroBank AG Customer Database Export | Breach date: 2026-05-10 | Records: 8.7M', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 2, '-- Attributed to: Cl0p ransomware group via MOVEit Transfer exploitation (CVE-2023-34362)', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 3, 'INSERT INTO accounts (email, name, iban_last4, balance_eur) VALUES', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 4, '(''h.weber****@eurobank.invalid'', ''Hans W.'', ''****4491'', ''****'');', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 5, '(''s.fischer****@eurobank.invalid'', ''Sophie F.'', ''****7823'', ''****'');', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 6, '(''m.schmidt****@eurobank.invalid'', ''Michael S.'', ''****1156'', ''****'');', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 7, '-- Internal note: breach vector was unpatched MOVEit Transfer instance at transfer.eurobank.invalid', 'database_dump', 'Germany', NOW()),
('/data/leaks/eurobank-customer-db-2026.sql', 'eurobank-customer-db-2026.sql', 8, '-- C2 callback observed: 203.0.113.45:443 (known Cl0p infrastructure)', 'database_dump', 'Germany', NOW());

-- ============================================
-- FILE 14: Stealer logs targeting EuroBank + MegaCorp
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9014, '/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 780000, 12, 'ulp_stealer', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 1, '=== Raccoon Stealer v2 | Target: EU Finance | Machines: 890 | Date: 2026-05-20 ===', 'ulp_stealer', NULL, NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 2, 'URL: https://banking.eurobank.invalid/login | USER: h.weber****@eurobank.invalid | PASS: <REDACTED:12>', 'ulp_stealer', 'Germany', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 3, 'URL: https://vpn.eurobank.invalid/portal | USER: admin.s****@eurobank.invalid | PASS: <REDACTED:15>', 'ulp_stealer', 'Germany', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 4, 'URL: https://treasury.eurobank.invalid/swift | USER: swift.op****@eurobank.invalid | PASS: <REDACTED:18>', 'ulp_stealer', 'Germany', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 5, 'URL: https://sso.megacorp.invalid/auth | USER: r.smith****@megacorp.invalid | PASS: <REDACTED:11>', 'ulp_stealer', 'United States', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 6, 'URL: https://vpn.megacorp.invalid/remote | USER: j.doe****@megacorp.invalid | PASS: <REDACTED:14>', 'ulp_stealer', 'United States', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 7, 'URL: https://citrix.healthcare-demo.invalid/vpn | USER: dr.k****@hc-demo.invalid | PASS: <REDACTED:13>', 'ulp_stealer', 'United Kingdom', NOW()),
('/data/stealer/raccoon-eu-finance-2026.txt', 'raccoon-eu-finance-2026.txt', 8, '--- Note: LockBit affiliate known to purchase these logs for initial access ---', 'ulp_stealer', NULL, NOW());

-- ============================================
-- FILE 15: Telegram channel mentioning same entities
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9015, '/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 28000, 10, 'telegram_intel', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 1, '=== Telegram: @Cl0p_News (victim announcements) | Scraped: 2026-05-25 ===', 'telegram_intel', NULL, NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 2, '[2026-05-22] Cl0p announces EuroBank AG as new victim. 8.7M records. Deadline: June 5.', 'telegram_intel', 'Germany', NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 3, '[2026-05-22] Proof posted: sample of 50,000 eurobank.invalid customer records', 'telegram_intel', 'Germany', NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 4, '[2026-05-23] Cl0p: "MegaCorp Inc added to our blog. 2.5M employee records via MOVEit."', 'telegram_intel', 'United States', NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 5, '[2026-05-24] Cl0p: "Healthcare-Demo Network (UK) - patient data. CVE-2023-34362 still works."', 'telegram_intel', 'United Kingdom', NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 6, '[2026-05-25] LockBit responds: "We also have healthcare-demo.invalid access via CitrixBleed"', 'telegram_intel', 'United Kingdom', NOW()),
('/data/telegram/tg-cl0p-victims-channel.txt', 'tg-cl0p-victims-channel.txt', 7, '[2026-05-25] Affiliate post: "Selling eurobank.invalid VPN creds. Raccoon logs. DM for price."', 'telegram_intel', 'Germany', NOW());

-- ============================================
-- FILE 16: Dark web forum - same actors
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9016, '/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 15000, 10, 'darkweb_intel', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 1, '[FORUM: RAMP] Thread: "MOVEit victims - who has what" | Date: 2026-05-23', 'darkweb_intel', NULL, NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 2, 'cl0p_operator: We have eurobank.invalid (8.7M), megacorp.invalid (2.5M), healthcare-demo.invalid (1.2M)', 'darkweb_intel', NULL, NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 3, 'lockbit_admin: We independently accessed healthcare-demo.invalid via CVE-2023-4966 (CitrixBleed)', 'darkweb_intel', NULL, NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 4, 'cl0p_operator: Our vector was CVE-2023-34362 on transfer.eurobank.invalid. Still unpatched May 2026.', 'darkweb_intel', 'Germany', NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 5, 'lockbit_admin: Anyone have democity.invalid access? We need French gov targets.', 'darkweb_intel', 'France', NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 6, 'iab_seller_99: I have democity.invalid RDP + Citrix. $20K. CVE-2024-21887 chain.', 'darkweb_intel', 'France', NOW()),
('/data/darkweb/ramp-forum-cl0p-lockbit-thread.txt', 'ramp-forum-cl0p-lockbit-thread.txt', 7, 'lockbit_admin: Deal. Send via TOX. C2 callback: 203.0.113.45', 'darkweb_intel', NULL, NOW());

-- ============================================
-- FILE 17: OSINT feed with same IOCs
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9017, '/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 8900, 10, 'osint_feed', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 1, '{"campaign":"Cl0p MOVEit May 2026","iocs":[', 'osint_feed', NULL, NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 2, '  {"type":"ip","value":"203.0.113.45","context":"C2 server","confidence":95},', 'osint_feed', NULL, NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 3, '  {"type":"domain","value":"transfer.eurobank.invalid","context":"exploited MOVEit instance","confidence":99},', 'osint_feed', 'Germany', NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 4, '  {"type":"domain","value":"moveit.megacorp.invalid","context":"exploited MOVEit instance","confidence":99},', 'osint_feed', 'United States', NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 5, '  {"type":"cve","value":"CVE-2023-34362","context":"exploitation vector","confidence":100},', 'osint_feed', NULL, NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 6, '  {"type":"hash","value":"a1b2c3d4e5f6****","context":"webshell dropped post-exploitation","confidence":90},', 'osint_feed', NULL, NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 7, '  {"type":"domain","value":"healthcare-demo.invalid","context":"confirmed victim","confidence":95}', 'osint_feed', 'United Kingdom', NOW()),
('/data/osint/ioc-feed-cl0p-campaign-2026.json', 'ioc-feed-cl0p-campaign-2026.json', 8, '],"actor":"Cl0p","first_seen":"2026-05-18","last_seen":"2026-05-25"}', 'osint_feed', NULL, NOW());

-- ============================================
-- FILE 18: Paste OSINT monitoring hits
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9018, '/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 5600, 8, 'paste_osint', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 1, '=== Paste Monitor Alert | Domain: eurobank.invalid | Hits: 7 in 48h ===', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 2, 'HIT 1: pastebin.com/**** | "EuroBank employee VPN creds" | 340 lines | Cl0p attributed', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 3, 'HIT 2: rentry.co/**** | "eurobank.invalid SWIFT access" | 12 lines | critical severity', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 4, 'HIT 3: ghostbin/**** | "EU bank combo fresh" | 45,000 lines | eurobank + 3 others', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 5, 'ALERT: eurobank.invalid appeared in 7 paste sites in 48 hours — active campaign indicator', 'paste_osint', 'Germany', NOW()),
('/data/pastes/paste-monitor-eurobank-hits.txt', 'paste-monitor-eurobank-hits.txt', 6, 'CORRELATION: Same domain found in Raccoon stealer logs (file: raccoon-eu-finance-2026.txt)', 'paste_osint', 'Germany', NOW());

-- ============================================
-- FILE 19: Combolist with overlapping domains
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9019, '/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 3200000, 10, 'mix_record', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 1, '=== COMBOLIST: EU Corporate Mix | Lines: 3.2M | Format: email:pass | Date: 2026-05-21 ===', 'mix_record', NULL, NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 2, 'h.weber****@eurobank.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'Germany', NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 3, 'finance.team****@eurobank.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'Germany', NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 4, 'r.smith****@megacorp.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'United States', NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 5, 'nurse.k****@healthcare-demo.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'United Kingdom', NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 6, 'p.dubois****@democity.invalid:<REDACTED_DEMO_PASSWORD>', 'mix_record', 'France', NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 7, '--- Top domains: eurobank.invalid (890K), megacorp.invalid (450K), healthcare-demo.invalid (320K) ---', 'mix_record', NULL, NOW()),
('/data/combos/combo-eu-corporate-may2026.txt', 'combo-eu-corporate-may2026.txt', 8, '--- Source: aggregated from Raccoon + Lumma stealer logs + Cl0p MOVEit dumps ---', 'mix_record', NULL, NOW());

-- ============================================
-- FILE 20: Threat actor report - LockBit
-- ============================================
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9020, '/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 22000, 12, 'threat_actor_report', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at) VALUES
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 1, '# Threat Actor Profile: LockBit 4.0', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 2, 'Aliases: LockBit Black, LockBit 3.0, LockBit 4.0 | Origin: Russia | Active: 2019-present', 'threat_actor_report', 'Russia', NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 3, 'Key CVEs exploited: CVE-2023-4966 (CitrixBleed), CVE-2021-34527 (PrintNightmare), CVE-2022-30190 (Follina)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 4, 'Recent victims (May 2026): healthcare-demo.invalid (UK), democity.invalid (FR), PrecisionMfg (IT)', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 5, 'Initial access: Purchases stealer logs (Raccoon, Lumma) for VPN/Citrix credentials', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 6, 'Infrastructure: C2 at 203.0.113.45, Tor leak site at lockbit4******.onion', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 7, 'Affiliate model: 80/20 split. Recruits on RAMP forum. Known to buy from Cl0p overflow.', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.txt', 8, 'MITRE: T1190, T1133, T1486, T1567, T1078 | Sectors: Healthcare, Government, Manufacturing', 'threat_actor_report', NULL, NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 9, 'Connection to eurobank.invalid: LockBit affiliate purchased Raccoon logs containing eurobank VPN creds', 'threat_actor_report', 'Germany', NOW()),
('/data/reports/threat-actor-lockbit-2026.md', 'threat-actor-lockbit-2026.md', 10, 'Recommendation: Block 203.0.113.45, patch CitrixBleed, rotate all Citrix/VPN credentials immediately', 'threat_actor_report', NULL, NOW());

-- ============================================
-- Update search vectors
-- ============================================
UPDATE search_index_lines
SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;
