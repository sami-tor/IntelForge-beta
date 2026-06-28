-- ================================================
-- FULL CORRELATION DEMO: "acmecorp.invalid"
-- ------------------------------------------------
-- This single entity appears across EVERY system:
--   • Search index (Quickwit-style in PG)
--   • Intel news
--   • CVE cache (linked product)
--   • Exploit cache
--   • Ransomware groups + victims
--   • Dark-web posts
--   • Phishing cache
--   • Malware cache
--   • MITRE actors + techniques
--   • APT campaigns
--   • Paste posts
--   • Stealer logs
--   • Combolist drops
--   • Compromised hosts
--   • Actor-CVE links
--   • Actor-breach links
--   • Intel entities + findings + relationships
--   • Correlation clusters
--   • Sigma rules
--   • GitHub secrets
--   • Watchlists (if user exists)
--
-- Search for "acmecorp" and EVERYTHING lights up.
-- ================================================

-- 1. CVE linked to AcmeCorp product
INSERT INTO intel_cve_cache (cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, is_kev, vendor, product, published_at, last_modified)
VALUES ('CVE-2026-99001', 'AcmeCorp FileShare Pro remote code execution via unauthenticated file upload. Actively exploited by LockBit affiliates.', 9.8, 'CRITICAL', 0.96, true, 'AcmeCorp', 'FileShare Pro', NOW() - INTERVAL '5 days', NOW())
ON CONFLICT (cve_id) DO UPDATE SET description = EXCLUDED.description, is_kev = true;

-- 2. Exploit for that CVE
INSERT INTO intel_exploit_cache (exploit_id, cve_id, title, description, exploit_type, platform, published_at, verified, has_poc)
VALUES ('DEMO-ACME-EXP-001', 'CVE-2026-99001', 'AcmeCorp FileShare Pro RCE - unauthenticated shell upload', 'Drops webshell via /api/upload endpoint without auth', 'remote', 'multiple', NOW() - INTERVAL '4 days', true, true)
ON CONFLICT (exploit_id) DO UPDATE SET title = EXCLUDED.title;

-- 3. News about AcmeCorp breach
INSERT INTO intel_news_cache (guid, title, description, url, source, source_label, category, published_at)
VALUES
  ('demo-acme-news-001', 'AcmeCorp suffers massive breach — 5M customer records exposed via FileShare Pro vulnerability', 'LockBit claims responsibility for the AcmeCorp breach, exploiting CVE-2026-99001 in their FileShare Pro product. Customer PII including emails, passwords, and payment data exfiltrated.', 'https://example.invalid/news/acmecorp-breach', 'demo-feed', 'Demo Feed', 'breach', NOW() - INTERVAL '3 days'),
  ('demo-acme-news-002', 'CVE-2026-99001: Critical AcmeCorp FileShare Pro flaw added to CISA KEV', 'CISA adds CVE-2026-99001 to Known Exploited Vulnerabilities catalogue. Federal agencies must patch within 14 days.', 'https://example.invalid/news/acmecorp-kev', 'demo-feed', 'Demo Feed', 'vulnerability', NOW() - INTERVAL '4 days'),
  ('demo-acme-news-003', 'LockBit posts AcmeCorp data on leak site — negotiation deadline set', 'Ransomware group LockBit has posted sample data from AcmeCorp on their Tor leak site, setting a 7-day deadline for payment.', 'https://example.invalid/news/acmecorp-lockbit', 'demo-feed', 'Demo Feed', 'ransomware', NOW() - INTERVAL '2 days')
ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title;

-- 4. Ransomware victim
INSERT INTO intel_ransomware_victims (victim_name, group_name, discovered_at, country, sector, description)
VALUES ('AcmeCorp Inc', 'lockbit', NOW() - INTERVAL '3 days', 'United States', 'Technology', 'Listed on LockBit 4.0 blog. 5M records. CVE-2026-99001 exploitation confirmed.')
ON CONFLICT DO NOTHING;

-- 5. Dark-web posts
INSERT INTO intel_darknet_posts (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('demo-acme-dark-001', 'lockbit_blog', 'ransomware_blog', 'LockBit claims AcmeCorp - 5M records', 'AcmeCorp Inc added to our blog. FileShare Pro exploited via CVE-2026-99001. 5M customer records including emails, hashed passwords, payment info. Deadline: 7 days.', 'LockBit', 'AcmeCorp Inc', 'Technology', 'United States', 'data_leak', 'critical', NOW() - INTERVAL '3 days'),
  ('demo-acme-dark-002', 'ramp_forum', 'forum', 'Selling AcmeCorp VPN + admin access', 'Full admin access to acmecorp.invalid network. Got in via FileShare Pro (CVE-2026-99001). VPN creds + domain admin. $25K or best offer.', 'LockBit', 'AcmeCorp Inc', 'Technology', 'United States', 'auction', 'critical', NOW() - INTERVAL '2 days')
ON CONFLICT (post_uid) DO UPDATE SET content = EXCLUDED.content;

-- 6. Phishing targeting AcmeCorp
INSERT INTO intel_phishing_cache (phish_id, url, target_brand, phish_type, ip_address, country, active, reported_at, source)
VALUES
  ('demo-acme-phish-001', 'https://acmecorp-login.invalid/auth/signin', 'AcmeCorp', 'credential_harvesting', '203.0.113.99', 'United States', true, NOW() - INTERVAL '6 days', 'openphish'),
  ('demo-acme-phish-002', 'https://secure-acmecorp.invalid/verify', 'AcmeCorp', 'credential_harvesting', '203.0.113.100', 'Netherlands', true, NOW() - INTERVAL '4 days', 'phishtank')
ON CONFLICT (phish_id) DO UPDATE SET active = true;

-- 7. Malware sample linked to AcmeCorp breach
INSERT INTO intel_malware_cache (sha256, file_name, file_type, malware_family, tags, source, iocs, first_seen, last_seen)
VALUES ('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'acmecorp_webshell.php', 'php', ARRAY['lockbit-webshell']::text[], ARRAY['acmecorp','lockbit','webshell','CVE-2026-99001']::text[], 'malwarebazaar', ARRAY['203.0.113.99','acmecorp.invalid']::text[], NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day')
ON CONFLICT (sha256) DO UPDATE SET tags = EXCLUDED.tags;

-- 8. MITRE actor link
INSERT INTO intel_mitre_groups (stix_id, name, group_id, aliases, description, sectors, countries)
VALUES ('demo-actor-lockbit-acme', 'LockBit', 'G0901', ARRAY['LockBit 3.0','LockBit 4.0','LockBit Black']::text[], 'High-volume RaaS. Exploited AcmeCorp via CVE-2026-99001.', ARRAY['Technology','Healthcare','Manufacturing']::text[], ARRAY['United States','United Kingdom','Germany']::text[])
ON CONFLICT (stix_id) DO UPDATE SET description = EXCLUDED.description;

-- 9. Actor-CVE link
INSERT INTO intel_actor_cve_links (actor_name, cve_id, relationship, confidence, first_seen, last_seen, sources)
VALUES ('LockBit', 'CVE-2026-99001', 'exploits', 98, '2026-05-22', '2026-05-27', ARRAY['demo-feed']::text[])
ON CONFLICT (actor_name, cve_id, relationship) DO UPDATE SET confidence = 98;

-- 10. Actor-breach link
INSERT INTO intel_actor_breach_links (actor_name, victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity)
VALUES ('LockBit', 'AcmeCorp Inc', 'Technology', 'United States', CURRENT_DATE - 3, 'ransomware', 5000000, 98, 'critical')
ON CONFLICT (actor_name, victim_name, breach_date) DO UPDATE SET record_count = 5000000;

-- 11. Paste posts
INSERT INTO intel_paste_posts (post_uid, source, title, excerpt, indicator_kinds, matched_brands, matched_cves, threat_actor, severity, discovered_at)
VALUES
  ('demo-acme-paste-001', 'pastebin', 'AcmeCorp employee credentials dump', 'admin****@acmecorp.invalid:<REDACTED> | vpn.acmecorp.invalid credentials from Raccoon stealer', ARRAY['credential']::text[], ARRAY['AcmeCorp']::text[], ARRAY['CVE-2026-99001']::text[], 'LockBit', 'critical', NOW() - INTERVAL '3 days'),
  ('demo-acme-paste-002', 'rentry', 'AcmeCorp FileShare Pro exploit notes', 'Working RCE chain for CVE-2026-99001. Upload to /api/upload, no auth needed. Webshell drops at /uploads/shell.php', ARRAY['exploit_payload']::text[], ARRAY['AcmeCorp','FileShare Pro']::text[], ARRAY['CVE-2026-99001']::text[], NULL, 'high', NOW() - INTERVAL '4 days')
ON CONFLICT (post_uid) DO UPDATE SET excerpt = EXCLUDED.excerpt;

-- 12. Stealer logs
INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('demo-acme-log-001', 'raccoon', 'host-acme-001', 'United States', 'https://vpn.acmecorp.invalid/login', 'acmecorp.invalid', 'admin.j****@acmecorp.invalid', '<REDACTED:14>', 'credential', NOW() - INTERVAL '6 days'),
  ('demo-acme-log-002', 'raccoon', 'host-acme-001', 'United States', 'https://fileshare.acmecorp.invalid/admin', 'acmecorp.invalid', 'sysadmin****@acmecorp.invalid', '<REDACTED:16>', 'credential', NOW() - INTERVAL '6 days'),
  ('demo-acme-log-003', 'lumma', 'host-acme-002', 'United States', 'https://mail.acmecorp.invalid/owa', 'acmecorp.invalid', 'ceo.m****@acmecorp.invalid', '<REDACTED:12>', 'credential', NOW() - INTERVAL '5 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

-- 13. Compromised host
INSERT INTO intel_compromised_hosts (host_uid, hostname, country, os, stealer_family, credential_count, cookie_count, autofill_count, matched_domains, first_seen, last_seen, severity)
VALUES ('host-acme-001', 'ACME-DC01-****', 'United States', 'Windows Server 2022', 'raccoon', 156, 890, 45, ARRAY['acmecorp.invalid','vpn.acmecorp.invalid','fileshare.acmecorp.invalid']::text[], NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days', 'critical')
ON CONFLICT (host_uid) DO UPDATE SET credential_count = 156;

-- 14. Combolist drop
INSERT INTO intel_combolist_drops (drop_uid, name, source, line_count, unique_domains, sample_domains, matched_brands, severity, threat_actor, posted_at)
VALUES ('demo-acme-combo-001', 'AcmeCorp full employee dump - 156K lines', 'telegram', 156000, 3, ARRAY['acmecorp.invalid','mail.acmecorp.invalid','vpn.acmecorp.invalid']::text[], ARRAY['AcmeCorp']::text[], 'critical', 'LockBit', NOW() - INTERVAL '2 days')
ON CONFLICT (drop_uid) DO UPDATE SET line_count = 156000;

-- 15. GitHub secret exposure
INSERT INTO intel_github_secrets (finding_id, repo_name, repo_owner, file_path, secret_type, is_public, discovered_at, last_seen_at, still_exposed, risk_level)
VALUES ('demo-acme-gh-001', 'acmecorp-internal/deploy-scripts', 'acmecorp-dev', 'config/production.env', 'aws_key', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', true, 'critical')
ON CONFLICT (finding_id) DO UPDATE SET still_exposed = true;

-- 16. Sigma rule
INSERT INTO intel_sigma_rules (rule_id, title, description, status, level, logsource_product, technique_id, tags, references_urls)
VALUES ('demo-acme-sigma-001', 'AcmeCorp FileShare Pro Exploitation - CVE-2026-99001', 'Detects exploitation attempts against AcmeCorp FileShare Pro upload endpoint', 'stable', 'critical', 'webserver', ARRAY['T1190']::text[], ARRAY['acmecorp','fileshare','CVE-2026-99001']::text[], ARRAY['https://example.invalid/news/acmecorp-kev']::text[])
ON CONFLICT (rule_id) DO UPDATE SET title = EXCLUDED.title;

-- 17. Intel entity + finding + relationship
INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'acmecorp.invalid', 'acmecorp.invalid', 95, 98, ARRAY['breach','ransomware','lockbit','critical']::text[], NOW() - INTERVAL '6 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 95, last_seen = NOW();

INSERT INTO intel_findings (finding_type, severity, risk_score, confidence, title, description, source_name, fingerprint, first_seen, last_seen)
VALUES ('credential_exposure', 'critical', 95, 98, 'AcmeCorp massive credential exposure via LockBit ransomware', 'Domain acmecorp.invalid found in stealer logs (Raccoon + Lumma), paste sites, combolist drops, and dark-web leak site. 5M records confirmed exfiltrated via CVE-2026-99001.', 'automation', 'acme-finding-001', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (fingerprint) DO UPDATE SET last_seen = NOW(), risk_score = 95;

-- 18. Search index lines (for PostgreSQL text search)
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (9999, '/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 5200000, 15, 'database_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector) VALUES
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 1, '=== AcmeCorp Inc Full Breach Data | 5M records | LockBit ransomware | CVE-2026-99001 ===', 'database_dump', 'United States', NOW(), to_tsvector('english', '=== AcmeCorp Inc Full Breach Data | 5M records | LockBit ransomware | CVE-2026-99001 ===')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 2, 'admin.j****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | VPN Portal | Raccoon stealer', 'database_dump', 'United States', NOW(), to_tsvector('english', 'admin.j****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | VPN Portal | Raccoon stealer')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 3, 'sysadmin****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | FileShare Admin | Domain Admin', 'database_dump', 'United States', NOW(), to_tsvector('english', 'sysadmin****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | FileShare Admin | Domain Admin')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 4, 'ceo.m****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | OWA Email | Executive account', 'database_dump', 'United States', NOW(), to_tsvector('english', 'ceo.m****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | OWA Email | Executive account')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 5, 'hr.team****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | SAP HR Portal | Employee data access', 'database_dump', 'United States', NOW(), to_tsvector('english', 'hr.team****@acmecorp.invalid:<REDACTED_DEMO_PASSWORD> | SAP HR Portal | Employee data access')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 6, '-- Breach vector: CVE-2026-99001 (AcmeCorp FileShare Pro RCE) exploited by LockBit affiliate', 'database_dump', 'United States', NOW(), to_tsvector('english', '-- Breach vector: CVE-2026-99001 (AcmeCorp FileShare Pro RCE) exploited by LockBit affiliate')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 7, '-- C2: 203.0.113.99 | Webshell: a1b2c3d4e5f6...a1b2 | Exfil: 5M records over 48h', 'database_dump', 'United States', NOW(), to_tsvector('english', '-- C2: 203.0.113.99 | Webshell: a1b2c3d4e5f6...a1b2 | Exfil: 5M records over 48h')),
('/data/breaches/acmecorp-full-breach-2026.txt', 'acmecorp-full-breach-2026.txt', 8, '-- Stealer logs (Raccoon + Lumma) captured VPN + FileShare + OWA creds 6 days before breach', 'database_dump', 'United States', NOW(), to_tsvector('english', '-- Stealer logs (Raccoon + Lumma) captured VPN + FileShare + OWA creds 6 days before breach'));

-- 19. Refresh materialised view
REFRESH MATERIALIZED VIEW mv_geo_threat_30d;
