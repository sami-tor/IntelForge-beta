-- ============================================================
-- COMPREHENSIVE DEMO SEED — IntelForge FYP Demonstration
-- ============================================================
-- All data is 100% synthetic / fictional.
-- Covers: 20+ company databases, stealer logs, darkweb, Telegram,
-- threat actors, APT campaigns, IOCs, and full correlation.
-- Run via: docker exec -i intelforge-postgres psql -U intelforge -d intelforge < seed-comprehensive-demo.sql
-- ============================================================

-- ============================================================
-- SECTION 0: UTILITY
-- ============================================================

-- Disable triggers for faster bulk insert
ALTER TABLE intel_entities DISABLE TRIGGER ALL;
ALTER TABLE intel_findings DISABLE TRIGGER ALL;
ALTER TABLE intel_relationships DISABLE TRIGGER ALL;

-- ============================================================
-- SECTION 1: FACEBOOK / META DATABASE LEAK
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10001, '/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 850000000, 18, 'credential_dump', NOW()),
  (10002, '/data/leaks/meta-corp/facebook-emails.csv', 'facebook-emails.csv', 320000000, 12, 'email_dump', NOW()),
  (10003, '/data/leaks/meta-corp/messenger-creds.csv', 'messenger-creds.csv', 210000000, 10, 'credential_dump', NOW()),
  (10004, '/data/leaks/meta-corp/instagram-db.csv', 'instagram-db.csv', 670000000, 14, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 1, '=== MetaCorp Platform User Database | 2024 Breach | 2.9B Records | Demonstratic Data ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'MetaCorp Platform User Database 2024 Breach 2.9B Records Demonstratic Data')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 2, 'user_001@demo.invalid:demopass123 | Facebook | profile_id=10001 | phone=+1-555-0100', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'user_001@demo.invalid demopass123 Facebook profile_id 10001 phone')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 3, 'john.doe@demo.invalid:password456 | Facebook | profile_id=10002 | name=John Doe | location=New York', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'john.doe@demo.invalid Facebook profile_id 10002 name John Doe location New York')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 4, 'jane.smith@demo.invalid:P@ssw0rd! | Facebook | profile_id=10003 | email=jane.smith@demo.invalid', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'jane.smith@demo.invalid Facebook profile_id 10003 email')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 5, 'admin.meta@demo.invalid:AdminPass789 | Facebook | profile_id=1 | admin=true | 2FA=false', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'admin.meta@demo.invalid Facebook profile_id 1 admin 2FA')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 6, 'dev.team@demo.invalid:DevP@ss2024 | MetaCorp API | key=sk-meta-xxxxxxxxxxx', 'credential_dump', 'India', NOW(), to_tsvector('english', 'dev.team@demo.invalid MetaCorp API key')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 7, 'hr.meta@demo.invalid:HrSecure2024! | MetaCorp HR | access=employee_records | sensitive=true', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'hr.meta@demo.invalid MetaCorp HR access employee_records sensitive')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 8, 'ads.meta@demo.invalid:AdManager@1 | MetaCorp Ads | role=admin | spend_limit=unlimited', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'ads.meta@demo.invalid MetaCorp Ads role admin spend_limit unlimited')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 9, 'cloudops@demo.invalid:CloudOps#2024 | MetaCorp Cloud | project=production | region=us-east-1', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'cloudops@demo.invalid MetaCorp Cloud project production region us-east-1')),
  ('/data/leaks/meta-corp/facebook-db-2024.csv', 'facebook-db-2024.csv', 10, 'analyst.data@demo.invalid:DataAnalyst! | MetaCorp Data | table_access=all | export=true', 'credential_dump', 'Canada', NOW(), to_tsvector('english', 'analyst.data@demo.invalid MetaCorp Data table_access all export')),
  ('/data/leaks/meta-corp/facebook-emails.csv', 'facebook-emails.csv', 1, '=== MetaCorp Email List | 15M subscribers | Marketing database | Demo ===', 'email_dump', 'United States', NOW(), to_tsvector('english', 'MetaCorp Email List 15M subscribers Marketing database Demo')),
  ('/data/leaks/meta-corp/facebook-emails.csv', 'facebook-emails.csv', 2, 'marketing@demobrand.com:Marketing123 | MetaCorp Ads | campaign_id=CAMP-001', 'email_dump', 'United States', NOW(), to_tsvector('english', 'marketing@demobrand.com MetaCorp Ads campaign_id CAMP-001')),
  ('/data/leaks/meta-corp/facebook-emails.csv', 'facebook-emails.csv', 3, 'dev.team@demo.invalid:DevP@ss2024 | MetaCorp API | key=sk-meta-...', 'email_dump', 'India', NOW(), to_tsvector('english', 'dev.team@demo.invalid MetaCorp API key')),
  ('/data/leaks/meta-corp/instagram-db.csv', 'instagram-db.csv', 1, '=== MetaCorp Instagram Database | 2024 | Influencer data | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'MetaCorp Instagram Database 2024 Influencer data Demo')),
  ('/data/leaks/meta-corp/instagram-db.csv', 'instagram-db.csv', 2, 'influencer.anna@demo.invalid:InstaP@ss99 | Instagram | followers=5M | verified=true', 'credential_dump', 'Brazil', NOW(), to_tsvector('english', 'influencer.anna@demo.invalid Instagram followers 5M verified')),
  ('/data/leaks/meta-corp/instagram-db.csv', 'instagram-db.csv', 3, 'creator.pedro@demo.invalid:Creator2024! | Instagram | followers=2.3M | monetization=enabled', 'credential_dump', 'Mexico', NOW(), to_tsvector('english', 'creator.pedro@demo.invalid Instagram followers 2.3M monetization enabled')),
  ('/data/leaks/meta-corp/messenger-creds.csv', 'messenger-creds.csv', 1, '=== MetaCorp Messenger Credentials | 500M users | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'MetaCorp Messenger Credentials 500M users Demo')),
  ('/data/leaks/meta-corp/messenger-creds.csv', 'messenger-creds.csv', 2, 'msg.user1@demo.invalid:MsgPass2024 | Messenger | session_token=eyJ...', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'msg.user1@demo.invalid Messenger session_token')),
  ('/data/leaks/meta-corp/messenger-creds.csv', 'messenger-creds.csv', 3, 'business.chat@demo.invalid:ChatSecure! | Messenger Business | api_key=MESSENGER_KEY_XXX', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'business.chat@demo.invalid Messenger Business api_key'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'meta-corp.invalid', 'meta-corp.invalid', 78, 92, ARRAY['social_media','breach','leak','facebook_demo','meta']::text[], NOW()-INTERVAL '45 days', NOW()),
  ('domain', 'facebook-demo.invalid', 'facebook-demo.invalid', 75, 90, ARRAY['social_media','breach','leak','facebook']::text[], NOW()-INTERVAL '45 days', NOW()),
  ('domain', 'instagram-demo.invalid', 'instagram-demo.invalid', 72, 88, ARRAY['social_media','breach','leak','instagram']::text[], NOW()-INTERVAL '45 days', NOW()),
  ('email', 'admin.meta@demo.invalid', 'admin.meta@demo.invalid', 88, 95, ARRAY['breach','admin','meta']::text[], NOW()-INTERVAL '45 days', NOW()),
  ('email', 'dev.team@demo.invalid', 'dev.team@demo.invalid', 85, 93, ARRAY['breach','developer','meta']::text[], NOW()-INTERVAL '45 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score, last_seen = NOW();

INSERT INTO intel_news_cache (guid, title, description, url, source, source_label, category, published_at)
VALUES
  ('meta-db-leak-001', 'MetaCorp confirms 2.9B record breach — largest social media leak in history', 'MetaCorp platform database containing 2.9 billion user records posted on darkweb forum. Data includes emails, hashed passwords, phone numbers, and profile IDs. Demo dataset.', 'https://demo.invalid/news/meta-breach', 'demo-feed', 'Demo Feed', 'breach', NOW()-INTERVAL '45 days'),
  ('meta-db-leak-002', 'MetaCorp breach IOCs: domain meta-corp.invalid, IP 198.51.100.50, hash deadbeef...', 'Indicators of compromise from MetaCorp breach linked to threat actor DEMO-APT-01. C2 domain identified at 198.51.100.50.', 'https://demo.invalid/news/meta-iocs', 'demo-feed', 'Demo Feed', 'breach', NOW()-INTERVAL '43 days'),
  ('meta-db-leak-003', 'MetaCorp Fileshare Pro RCE exploited in breach chain — CVE-2026-99001', 'Attackers used CVE-2026-99001 (MetaCorp Fileshare Pro RCE) as initial access vector for MetaCorp breach. CVSS 9.8, actively exploited.', 'https://demo.invalid/news/meta-cve', 'demo-feed', 'Demo Feed', 'vulnerability', NOW()-INTERVAL '44 days'),
  ('meta-db-leak-004', 'DEMO-APT-01 linked to MetaCorp breach via stealer logs', 'Threat actor DEMO-APT-01 used Raccoon stealer to harvest credentials from MetaCorp employees 6 days before breach. VPN and admin portals targeted.', 'https://demo.invalid/news/meta-apt-link', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '40 days')
ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('meta-log-001', 'raccoon', 'meta-host-win-001', 'United States', 'https://business.meta-corp.invalid/login', 'meta-corp.invalid', 'business.user@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '44 days'),
  ('meta-log-002', 'redline', 'meta-host-win-002', 'Brazil', 'https://ads.meta-corp.invalid/campaigns', 'meta-corp.invalid', 'ads.manager@demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '44 days'),
  ('meta-log-003', 'lumma', 'meta-host-win-003', 'India', 'https://developers.meta-corp.invalid/apikey', 'meta-corp.invalid', 'dev.team@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '43 days'),
  ('meta-log-004', 'raccoon', 'meta-host-win-004', 'United Kingdom', 'https://hr.meta-corp.invalid/employees', 'meta-corp.invalid', 'hr.meta@demo.invalid', '<REDACTED:18>', 'credential', NOW()-INTERVAL '42 days'),
  ('meta-log-005', 'stealc', 'meta-host-win-005', 'Germany', 'https://vpn.meta-corp.invalid/portal', 'meta-corp.invalid', 'admin.meta@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '41 days'),
  ('meta-log-006', 'raccoon', 'meta-host-win-001', 'United States', 'https://www.facebook.com/login', 'facebook-demo.invalid', 'user.john.doe@demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '44 days'),
  ('meta-log-007', 'redline', 'meta-host-win-002', 'Brazil', 'https://www.instagram.com/accounts/login', 'instagram-demo.invalid', 'influencer.anna@demo.invalid', '<REDACTED:10>', 'credential', NOW()-INTERVAL '44 days'),
  ('meta-log-008', 'lumma', 'meta-host-win-003', 'Canada', 'https://cloud.meta-corp.invalid/dashboard', 'meta-corp.invalid', 'cloudops@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '43 days'),
  ('meta-log-009', 'raccoon', 'meta-host-win-004', 'United States', 'https://data.meta-corp.invalid/reports', 'meta-corp.invalid', 'analyst.data@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '42 days'),
  ('meta-log-010', 'stealc', 'meta-host-win-005', 'Australia', 'https://api.meta-corp.invalid/v2/auth', 'meta-corp.invalid', 'api.integration@demo.invalid', '<REDACTED:20>', 'credential', NOW()-INTERVAL '41 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

INSERT INTO intel_compromised_hosts (host_uid, hostname, country, os, stealer_family, credential_count, cookie_count, autofill_count, matched_domains, first_seen, last_seen, severity)
VALUES
  ('meta-host-001', 'META-PC-WIN-****', 'United States', 'Windows 11', 'raccoon', 234, 1450, 87, ARRAY['meta-corp.invalid','facebook-demo.invalid','instagram-demo.invalid']::text[], NOW()-INTERVAL '44 days', NOW()-INTERVAL '5 days', 'critical'),
  ('meta-host-002', 'META-DEVPERSONAL-****', 'Brazil', 'Windows 10', 'redline', 156, 890, 45, ARRAY['meta-corp.invalid','instagram-demo.invalid']::text[], NOW()-INTERVAL '44 days', NOW()-INTERVAL '3 days', 'high'),
  ('meta-host-003', 'META-CLOUDSERVER-****', 'India', 'Windows Server 2022', 'lumma', 312, 2100, 120, ARRAY['meta-corp.invalid','facebook-demo.invalid']::text[], NOW()-INTERVAL '43 days', NOW()-INTERVAL '2 days', 'critical'),
  ('meta-host-004', 'META-HR-WORKSTATION-****', 'United Kingdom', 'Windows 11', 'raccoon', 89, 340, 22, ARRAY['meta-corp.invalid']::text[], NOW()-INTERVAL '42 days', NOW()-INTERVAL '1 day', 'medium'),
  ('meta-host-005', 'META-DBADMIN-****', 'Germany', 'Windows Server 2019', 'stealc', 445, 3200, 198, ARRAY['meta-corp.invalid','facebook-demo.invalid','instagram-demo.invalid']::text[], NOW()-INTERVAL '41 days', NOW(), 'critical')
ON CONFLICT (host_uid) DO UPDATE SET credential_count = EXCLUDED.credential_count;

-- ============================================================
-- SECTION 2: TIKTOK DATABASE LEAK
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10010, '/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 680000000, 14, 'credential_dump', NOW()),
  (10011, '/data/leaks/tiktok-demo/tiktok-creator-db.csv', 'tiktok-creator-db.csv', 420000000, 12, 'credential_dump', NOW()),
  (10012, '/data/leaks/tiktok-demo/tiktok-business.csv', 'tiktok-business.csv', 310000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 1, '=== TikTok Demo Platform User Database | 2024 Leak | 1.2B Records | Synthetic Data ===', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 'TikTok Demo Platform User Database 2024 Leak 1.2B Records Synthetic Data')),
  ('/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 2, 'creator.maria@demo.invalid:Pass1234! | TikTok | user_id=70001 | followers=500000', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'creator.maria@demo.invalid TikTok user_id 70001 followers')),
  ('/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 3, 'brand.partner@demo.invalid:BrandSecure456 | TikTok | user_id=70002 | verified=true', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'brand.partner@demo.invalid TikTok user_id 70002 verified')),
  ('/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 4, 'api.tiktok-demo.invalid:tok_tk_demo_key_xxx | TikTok API | developer=true | scopes=all', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 'api.tiktok-demo.invalid TikTok API developer scopes')),
  ('/data/leaks/tiktok-demo/tiktok-users.csv', 'tiktok-users.csv', 5, 'admin.tiktok@demo.invalid:AdminTT2024! | TikTok | role=super_admin | mfa=false', 'credential_dump', 'China', NOW(), to_tsvector('english', 'admin.tiktok@demo.invalid TikTok role super_admin mfa')),
  ('/data/leaks/tiktok-demo/tiktok-creator-db.csv', 'tiktok-creator-db.csv', 1, '=== TikTok Creator Database | 50M creators | Payment records | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'TikTok Creator Database 50M creators Payment records Demo')),
  ('/data/leaks/tiktok-demo/tiktok-creator-db.csv', 'tiktok-creator-db.csv', 2, 'payout.user@demo.invalid:CreatorPayout! | TikTok | balance=$25,000 | tax_id=US-XXXXXXXX', 'credential_dump', 'Canada', NOW(), to_tsvector('english', 'payout.user@demo.invalid TikTok balance tax_id')),
  ('/data/leaks/tiktok-demo/tiktok-business.csv', 'tiktok-business.csv', 1, '=== TikTok Business Suite | 5M advertisers | Demo ===', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 'TikTok Business Suite 5M advertisers Demo')),
  ('/data/leaks/tiktok-demo/tiktok-business.csv', 'tiktok-business.csv', 2, 'advertiser.brand@demo.invalid:AdBudget2024! | TikTok Ads | spend=$500K/month | cc_last4=1234', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'advertiser.brand@demo.invalid TikTok Ads spend cc_last4'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'tiktok-demo.invalid', 'tiktok-demo.invalid', 82, 90, ARRAY['social_media','breach','leak','tiktok_demo']::text[], NOW()-INTERVAL '38 days', NOW()),
  ('email', 'admin.tiktok@demo.invalid', 'admin.tiktok@demo.invalid', 90, 92, ARRAY['breach','admin','tiktok']::text[], NOW()-INTERVAL '38 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score;

INSERT INTO intel_news_cache (guid, title, description, url, source, source_label, category, published_at)
VALUES
  ('tiktok-leak-001', 'TikTok Demo platform database containing 1.2B user records posted on breach forum', 'Dark web marketplace listing claims TikTok Demo platform database with emails, phone numbers, and hashed passwords. Data appears to be from 2024. Demo dataset only.', 'https://demo.invalid/news/tiktok-breach', 'demo-feed', 'Demo Feed', 'breach', NOW()-INTERVAL '38 days'),
  ('tiktok-leak-002', 'TikTok Demo creator payout database leaked — 50M creators affected', 'Creator payment database including bank details, tax IDs, and payout records for 50M TikTok Demo creators posted on darkweb. Demo dataset.', 'https://demo.invalid/news/tiktok-creator', 'demo-feed', 'Demo Feed', 'breach', NOW()-INTERVAL '36 days')
ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('tiktok-log-001', 'raccoon', 'tiktok-host-001', 'United States', 'https://business.tiktok-demo.invalid/login', 'tiktok-demo.invalid', 'creator.maria@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '38 days'),
  ('tiktok-log-002', 'redline', 'tiktok-host-002', 'United Kingdom', 'https://ads.tiktok-demo.invalid/dashboard', 'tiktok-demo.invalid', 'brand.partner@demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '37 days'),
  ('tiktok-log-003', 'lumma', 'tiktok-host-003', 'Canada', 'https://creator.tiktok-demo.invalid/payout', 'tiktok-demo.invalid', 'payout.user@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '36 days'),
  ('tiktok-log-004', 'raccoon', 'tiktok-host-001', 'Singapore', 'https://api.tiktok-demo.invalid/v1/auth', 'tiktok-demo.invalid', 'api.tiktok-demo.invalid', '<REDACTED:20>', 'credential', NOW()-INTERVAL '37 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

-- ============================================================
-- SECTION 3: GOOGLE / GSUITE DATABASE LEAK
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10020, '/data/leaks/google-demo/google-creds.csv', 'google-creds.csv', 420000000, 10, 'credential_dump', NOW()),
  (10021, '/data/leaks/google-demo/gcp-service-accounts.csv', 'gcp-service-accounts.csv', 280000000, 8, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/google-demo/google-creds.csv', 'google-creds.csv', 1, '=== Google Demo Workspace Database | Service Account Leak | 800K Records | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Google Demo Workspace Database Service Account Leak 800K Records Demo')),
  ('/data/leaks/google-demo/google-creds.csv', 'google-creds.csv', 2, 'sa-project@google-demo.iam.gserviceaccount.com:-----BEGIN RSA PRIVATE KEY-----\nMI...<REDACTED>-----END RSA PRIVATE KEY----- | GCP Service Account | project=demo-gcp-001', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'sa-project@google-demo.iam.gserviceaccount.com GCP Service Account project demo-gcp-001')),
  ('/data/leaks/google-demo/google-creds.csv', 'google-creds.csv', 3, 'dev@google-demo.invalid:DevGoogle789 | Google Workspace | admin=false | 2FA=true', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'dev@google-demo.invalid Google Workspace admin 2FA')),
  ('/data/leaks/google-demo/google-creds.csv', 'google-creds.csv', 4, 'cloud-admin@google-demo.invalid:CloudAdm!n2024 | GCP Console | project Owner | sensitive=true', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'cloud-admin@google-demo.invalid GCP Console project Owner sensitive')),
  ('/data/leaks/google-demo/gcp-service-accounts.csv', 'gcp-service-accounts.csv', 1, '=== GCP Service Account Keys | 15 projects | NEXUS-THREAT exposed ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'GCP Service Account Keys 15 projects NEXUS-THREAT exposed')),
  ('/data/leaks/google-demo/gcp-service-accounts.csv', 'gcp-service-accounts.csv', 2, 'gcp-prod-sa@google-demo.iam.gserviceaccount.com | GCP | roles/owner | project=demo-prod-001', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'gcp-prod-sa@google-demo.iam.gserviceaccount.com GCP roles owner project demo-prod-001')),
  ('/data/leaks/google-demo/gcp-service-accounts.csv', 'gcp-service-accounts.csv', 3, 'gcp-data-sa@google-demo.iam.gserviceaccount.com | GCP BigQuery | roles/bigquery.admin | project=demo-analytics', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 'gcp-data-sa@google-demo.iam.gserviceaccount.com GCP BigQuery roles bigquery admin')),
  ('/data/leaks/google-demo/gcp-service-accounts.csv', 'gcp-service-accounts.csv', 4, 'gcp-storage-sa@google-demo.iam.gserviceaccount.com | GCS | roles/storage.admin | bucket=demo-assets-001', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'gcp-storage-sa@google-demo.iam.gserviceaccount.com GCS roles storage admin bucket'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'google-demo.invalid', 'google-demo.invalid', 75, 88, ARRAY['tech','breach','leak','google_demo']::text[], NOW()-INTERVAL '60 days', NOW()),
  ('ip', '198.51.100.75', '198.51.100.75', 88, 95, ARRAY['c2','google','nexus']::text[], NOW()-INTERVAL '55 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score;

INSERT INTO intel_github_secrets (finding_id, repo_name, repo_owner, file_path, secret_type, is_public, discovered_at, last_seen_at, still_exposed, risk_level)
VALUES
  ('gh-google-001', 'google-demo-infrastructure/terraform', 'google-demo-org', 'modules/gcp/main.tf', 'gcp_service_account_key', true, NOW()-INTERVAL '60 days', NOW()-INTERVAL '5 days', true, 'critical'),
  ('gh-google-002', 'google-demo-config/cloud-run', 'google-demo-org', 'config/prod.env', 'google_api_key', true, NOW()-INTERVAL '58 days', NOW()-INTERVAL '2 days', true, 'high'),
  ('gh-google-003', 'google-demo-ml/pipeline', 'google-demo-org', 'scripts/train.py', 'google_oauth_token', true, NOW()-INTERVAL '55 days', NOW()-INTERVAL '1 day', true, 'critical')
ON CONFLICT (finding_id) DO UPDATE SET still_exposed = true;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('google-log-001', 'raccoon', 'google-host-001', 'United States', 'https://console.cloud.google.com', 'google-demo.invalid', 'cloud.engineer@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '60 days'),
  ('google-log-002', 'raccoon', 'google-host-001', 'United States', 'https://mail.google.com', 'google-demo.invalid', 'dev@google-demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '60 days'),
  ('google-log-003', 'redline', 'google-host-002', 'Germany', 'https://workspace.google.com/u/0/admin', 'google-demo.invalid', 'admin.google@demo.invalid', '<REDACTED:18>', 'credential', NOW()-INTERVAL '58 days'),
  ('google-log-004', 'lumma', 'google-host-003', 'United Kingdom', 'https://bigquery.cloud.google.com', 'google-demo.invalid', 'data.analyst@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '55 days'),
  ('google-log-005', 'stealc', 'google-host-004', 'Canada', 'https://storage.cloud.google.com', 'google-demo.invalid', 'storage.admin@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '52 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

-- ============================================================
-- SECTION 4: MICROSOFT / AZURE DATABASE LEAK
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10030, '/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 550000000, 12, 'credential_dump', NOW()),
  (10031, '/data/leaks/microsoft-demo/azure-ad-dump.csv', 'azure-ad-dump.csv', 420000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 1, '=== Microsoft Demo Tenant Database | Azure AD Dump | 1.5M Records | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Microsoft Demo Tenant Database Azure AD Dump 1.5M Records Demo')),
  ('/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 2, 'admin@microsoft-demo.invalid:MsftAdmin@2024 | Azure AD | Global Admin | tenant_id=DEMO-001', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'admin@microsoft-demo.invalid Azure AD Global Admin tenant_id DEMO-001')),
  ('/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 3, 'devops@microsoft-demo.invalid:DevOpsP@ss! | Azure DevOps | Project Collection Admin', 'credential_dump', 'India', NOW(), to_tsvector('english', 'devops@microsoft-demo.invalid Azure DevOps Project Collection Admin')),
  ('/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 4, 'sql-admin@microsoft-demo.invalid:SqlAdm1n! | Azure SQL | db_owner | server=demo-sql.database.windows.net', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'sql-admin@microsoft-demo.invalid Azure SQL db_owner')),
  ('/data/leaks/microsoft-demo/ms-creds.csv', 'ms-creds.csv', 5, 'azure.admin@microsoft-demo.invalid:AzAdmin#2024 | Azure Portal | Contributor | subscription=DEMO-SUB-001', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'azure.admin@microsoft-demo.invalid Azure Portal Contributor subscription')),
  ('/data/leaks/microsoft-demo/azure-ad-dump.csv', 'azure-ad-dump.csv', 1, '=== Azure AD User Dump | Microsoft Demo | 1.5M users | Full attributes | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Azure AD User Dump Microsoft Demo 1.5M users Full attributes Demo')),
  ('/data/leaks/microsoft-demo/azure-ad-dump.csv', 'azure-ad-dump.csv', 2, 'user@ microsoft-demo.invalid:UserP@ss2024 | Azure AD | Department=IT | Role=User | mfa=true', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'user@ microsoft-demo.invalid Azure AD Department IT Role User mfa')),
  ('/data/leaks/microsoft-demo/azure-ad-dump.csv', 'azure-ad-dump.csv', 3, 'service.ms@ microsoft-demo.invalid:MService! | Azure AD | App Registration | owner=true | api_permissions=all', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 'service.ms@ microsoft-demo.invalid Azure AD App Registration owner api_permissions'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'microsoft-demo.invalid', 'microsoft-demo.invalid', 80, 91, ARRAY['tech','breach','leak','microsoft_demo']::text[], NOW()-INTERVAL '50 days', NOW()),
  ('email', 'admin@microsoft-demo.invalid', 'admin@microsoft-demo.invalid', 95, 96, ARRAY['breach','admin','azure','critical']::text[], NOW()-INTERVAL '50 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score;

INSERT INTO intel_darknet_posts (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('ms-dark-001', 'lockbit_blog', 'ransomware_blog', 'Microsoft Demo tenant admin access for sale', 'Azure AD global admin credentials for microsoft-demo.invalid tenant. tenant_id=DEMO-001. Can access Azure Portal, DevOps, and all SaaS apps. Starting bid $15K.', 'LockBit', 'Microsoft Demo Corp', 'Technology', 'United States', 'auction', 'critical', NOW()-INTERVAL '50 days'),
  ('ms-dark-002', 'ramp_forum', 'forum', 'Microsoft Demo internal docs and source code', 'Full internal docs and partial source code for demo project. From insider threat at microsoft-demo.invalid. Happy to show sample.', NULL, 'Microsoft Demo Corp', 'Technology', 'United States', 'sale', 'high', NOW()-INTERVAL '48 days'),
  ('ms-dark-003', 'torrez_market', 'darkweb_market', 'Azure AD global admin - microsoft-demo.invalid', 'Full global admin access to microsoft-demo.invalid Azure tenant. Can create users, modify permissions, access all SaaS. $20K.', NULL, 'Microsoft Demo Corp', 'Technology', 'United States', 'access', 'critical', NOW()-INTERVAL '45 days')
ON CONFLICT (post_uid) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('ms-log-001', 'raccoon', 'ms-host-001', 'United States', 'https://portal.azure.com', 'microsoft-demo.invalid', 'azure.admin@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '50 days'),
  ('ms-log-002', 'redline', 'ms-host-002', 'India', 'https://dev.azure.com', 'microsoft-demo.invalid', 'devops@microsoft-demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '49 days'),
  ('ms-log-003', 'lumma', 'ms-host-003', 'United Kingdom', 'https://sql.database.windows.net', 'microsoft-demo.invalid', 'sql-admin@microsoft-demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '48 days'),
  ('ms-log-004', 'stealc', 'ms-host-004', 'Germany', 'https://account.microsoft.com', 'microsoft-demo.invalid', 'admin@microsoft-demo.invalid', '<REDACTED:18>', 'credential', NOW()-INTERVAL '47 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

-- ============================================================
-- SECTION 5: AMAZON / AWS DATABASE LEAK
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10040, '/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 520000000, 12, 'credential_dump', NOW()),
  (10041, '/data/leaks/amazon-demo/aws-iam-dump.csv', 'aws-iam-dump.csv', 380000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 1, '=== Amazon Demo AWS Environment | IAM Dump | 2.3M Resources | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Amazon Demo AWS Environment IAM Dump 2.3M Resources Demo')),
  ('/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 2, 'prod-deploy@amazon-demo.invalid:AKIAXXXXXXXXXXXXXXXXXXX | AWS | role=Admin | region=us-east-1', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'prod-deploy@amazon-demo.invalid AWS role Admin region us-east-1')),
  ('/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 3, 'lambda-service@amazon-demo.invalid:A SECRET KEY XXX | AWS Lambda | execute on all functions', 'credential_dump', 'Ireland', NOW(), to_tsvector('english', 'lambda-service@amazon-demo.invalid AWS Lambda execute')),
  ('/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 4, 'devops.aws@amazon-demo.invalid:AWSDevOps@2024! | AWS | role=PowerUser | region=eu-west-1', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'devops.aws@amazon-demo.invalid AWS role PowerUser region eu-west-1')),
  ('/data/leaks/amazon-demo/aws-creds.csv', 'aws-creds.csv', 5, 'db.admin@amazon-demo.invalid:RdsAdmin#2024 | AWS RDS | master user | db_instance=demo-prod-db', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'db.admin@amazon-demo.invalid AWS RDS master user db_instance demo-prod-db')),
  ('/data/leaks/amazon-demo/aws-iam-dump.csv', 'aws-iam-dump.csv', 1, '=== AWS IAM Policies and Roles | Amazon Demo | NEXUS-THREAT exposed | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'AWS IAM Policies and Roles Amazon Demo NEXUS-THREAT exposed Demo')),
  ('/data/leaks/amazon-demo/aws-iam-dump.csv', 'aws-iam-dump.csv', 2, 'aws-admin-root@amazon-demo.invalid:RootKey*** | AWS Root | full_access | mfa=false | critical=true', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'aws-admin-root@amazon-demo.invalid AWS Root full_access mfa false critical')),
  ('/data/leaks/amazon-demo/aws-iam-dump.csv', 'aws-iam-dump.csv', 3, 's3-backup@amazon-demo.invalid:BackupKey123! | AWS S3 | s3:* | bucket=demo-backups-prod', 'credential_dump', 'Singapore', NOW(), to_tsvector('english', 's3-backup@amazon-demo.invalid AWS S3 bucket demo-backups-prod'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'amazon-demo.invalid', 'amazon-demo.invalid', 77, 89, ARRAY['ecommerce','breach','leak','amazon_demo']::text[], NOW()-INTERVAL '55 days', NOW()),
  ('ip', '198.51.100.100', '198.51.100.100', 85, 92, ARRAY['c2','amazon','nexus']::text[], NOW()-INTERVAL '50 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score;

INSERT INTO intel_github_secrets (finding_id, repo_name, repo_owner, file_path, secret_type, is_public, discovered_at, last_seen_at, still_exposed, risk_level)
VALUES
  ('gh-aws-001', 'amazon-demo-infra/cdk-pipeline', 'amazon-demo-org', 'cdk.json', 'aws_access_key', true, NOW()-INTERVAL '55 days', NOW()-INTERVAL '3 days', true, 'critical'),
  ('gh-aws-002', 'amazon-demo-cicd/pipeline', 'amazon-demo-org', 'pipelines/deploy.yml', 'aws_secret_key', true, NOW()-INTERVAL '53 days', NOW()-INTERVAL '1 day', true, 'critical')
ON CONFLICT (finding_id) DO UPDATE SET still_exposed = true;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('aws-log-001', 'raccoon', 'aws-host-001', 'United States', 'https://console.aws.amazon.com', 'amazon-demo.invalid', 'devops.aws@amazon-demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '55 days'),
  ('aws-log-002', 'redline', 'aws-host-002', 'Germany', 'https://sellercentral.amazon.com', 'amazon-demo.invalid', 'seller.premium@demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '54 days'),
  ('aws-log-003', 'lumma', 'aws-host-003', 'Ireland', 'https://lambda.aws.amazon.com', 'amazon-demo.invalid', 'lambda-service@amazon-demo.invalid', '<REDACTED:18>', 'credential', NOW()-INTERVAL '52 days'),
  ('aws-log-004', 'stealc', 'aws-host-004', 'Singapore', 'https://rds.console.aws.amazon.com', 'amazon-demo.invalid', 'db.admin@amazon-demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '50 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

-- ============================================================
-- SECTION 6: JPMORGAN CHASE DATABASE LEAK (Financial)
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10050, '/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 920000000, 15, 'credential_dump', NOW()),
  (10051, '/data/leaks/jpmorgan-demo/jpm-trading-creds.csv', 'jpm-trading-creds.csv', 340000000, 8, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 1, '=== JPMorgan Chase Demo Internal Network | 2024 | Financial Records | Synthetic ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'JPMorgan Chase Demo Internal Network 2024 Financial Records Synthetic')),
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 2, 'trader.john@demo.invalid:TradeP@ss2024! | Bloomberg Terminal | desk=Equities | mrn=12345678', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'trader.john@demo.invalid Bloomberg Terminal desk Equities mrn')),
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 3, 'analyst.sarah@demo.invalid:Analyst#2024 | Risk Dashboard | clearance=Level3', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'analyst.sarah@demo.invalid Risk Dashboard clearance Level3')),
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 4, 'it.admin@demo.invalid:ITAdmin@JPM! | Domain Admin | OU=NYC-IT | privileged=true', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'it.admin@demo.invalid Domain Admin OU NYC-IT privileged')),
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 5, '-- Financial transaction system API: api.jpmorgan-demo.invalid | key=JPM-API-KEY-XXX', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Financial transaction system API api.jpmorgan-demo.invalid key')),
  ('/data/leaks/jpmorgan-demo/jpm-internal.csv', 'jpm-internal.csv', 6, 'executive.vip@demo.invalid:VipSecure! | CEO Portal | access=all | tier=platinum', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'executive.vip@demo.invalid CEO Portal access all tier platinum')),
  ('/data/leaks/jpmorgan-demo/jpm-trading-creds.csv', 'jpm-trading-creds.csv', 1, '=== JPMorgan Trading Platform Credentials | Bloomberg + Internal | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'JPMorgan Trading Platform Credentials Bloomberg Internal Demo')),
  ('/data/leaks/jpmorgan-demo/jpm-trading-creds.csv', 'jpm-trading-creds.csv', 2, 'bloomberg.user@demo.invalid:BBGSecure2024! | Bloomberg Terminal | subscriptions=ALL | desk=Derivatives', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'bloomberg.user@demo.invalid Bloomberg Terminal subscriptions ALL desk Derivatives'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES
  ('domain', 'jpmorgan-demo.invalid', 'jpmorgan-demo.invalid', 85, 93, ARRAY['finance','breach','leak','banking_demo']::text[], NOW()-INTERVAL '35 days', NOW()),
  ('email', 'it.admin@demo.invalid', 'it.admin@demo.invalid', 98, 97, ARRAY['breach','admin','finance','jpmorgan','critical']::text[], NOW()-INTERVAL '35 days', NOW()),
  ('ip', '203.0.113.200', '203.0.113.200', 92, 95, ARRAY['c2','jpmorgan','alphv']::text[], NOW()-INTERVAL '35 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = EXCLUDED.risk_score;

INSERT INTO intel_darknet_posts (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('jpm-dark-001', 'alphv_blog', 'ransomware_blog', 'JPMorgan Chase Demo internal network access', 'Full internal network access to jpmorgan-demo.invalid. Can access trading systems, risk dashboards, and internal communications. Demo dataset.', 'ALPHV/BlackCat', 'JPMorgan Demo Bank', 'Financial', 'United States', 'auction', 'critical', NOW()-INTERVAL '35 days'),
  ('jpm-dark-002', 'ramp_forum', 'forum', 'JPMorgan Demo Bank trading system access', 'Access to JPMorgan Demo Bank trading platform with Bloomberg Terminal credentials. Can execute trades. $50K.', 'DarkVendor-02', 'JPMorgan Demo Bank', 'Financial', 'United States', 'access', 'critical', NOW()-INTERVAL '33 days'),
  ('jpm-dark-003', 'versus_market', 'darkweb_market', 'JPMorgan Demo Bank - full internal network', 'Domain admin + trading system access for jpmorgan-demo.invalid. Sensitive financial data. Starting $75K.', NULL, 'JPMorgan Demo Bank', 'Financial', 'United States', 'access', 'critical', NOW()-INTERVAL '30 days')
ON CONFLICT (post_uid) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO intel_stealer_logs (log_uid, stealer_family, machine_id, country, captured_url, domain, login_user, password_redacted, record_type, captured_at)
VALUES
  ('jpm-log-001', 'vidar', 'jpm-host-001', 'United States', 'https://portal.jpmorgan-demo.invalid', 'jpmorgan-demo.invalid', 'executive.vip@demo.invalid', '<REDACTED:16>', 'credential', NOW()-INTERVAL '36 days'),
  ('jpm-log-002', 'vidar', 'jpm-host-002', 'United States', 'https://trading.jpmorgan-demo.invalid', 'jpmorgan-demo.invalid', 'trader.senior@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '36 days'),
  ('jpm-log-003', 'raccoon', 'jpm-host-003', 'United Kingdom', 'https://intranet.jpmorgan-demo.invalid', 'jpmorgan-demo.invalid', 'it.operations@demo.invalid', '<REDACTED:18>', 'credential', NOW()-INTERVAL '35 days'),
  ('jpm-log-004', 'redline', 'jpm-host-004', 'United States', 'https://bloomberg.jpmorgan-demo.invalid', 'jpmorgan-demo.invalid', 'bloomberg.user@demo.invalid', '<REDACTED:14>', 'credential', NOW()-INTERVAL '34 days'),
  ('jpm-log-005', 'lumma', 'jpm-host-005', 'Germany', 'https://risk.jpmorgan-demo.invalid/dashboard', 'jpmorgan-demo.invalid', 'analyst.sarah@demo.invalid', '<REDACTED:12>', 'credential', NOW()-INTERVAL '33 days'),
  ('jpm-log-006', 'stealc', 'jpm-host-006', 'United States', 'https://api.jpmorgan-demo.invalid/v1/trade', 'jpmorgan-demo.invalid', 'api.trading@demo.invalid', '<REDACTED:20>', 'credential', NOW()-INTERVAL '32 days')
ON CONFLICT (log_uid) DO UPDATE SET captured_at = EXCLUDED.captured_at;

INSERT INTO intel_compromised_hosts (host_uid, hostname, country, os, stealer_family, credential_count, cookie_count, autofill_count, matched_domains, first_seen, last_seen, severity)
VALUES
  ('jpm-host-001', 'JPM-TOP-EXEC-****', 'United States', 'Windows 10', 'vidar', 87, 420, 32, ARRAY['jpmorgan-demo.invalid','portal.jpmorgan-demo.invalid']::text[], NOW()-INTERVAL '36 days', NOW()-INTERVAL '2 days', 'critical'),
  ('jpm-host-002', 'JPM-TRADER-DSK-****', 'United States', 'Windows 11', 'vidar', 145, 780, 56, ARRAY['jpmorgan-demo.invalid','trading.jpmorgan-demo.invalid']::text[], NOW()-INTERVAL '36 days', NOW()-INTERVAL '1 day', 'critical'),
  ('jpm-host-003', 'JPM-IT-OPS-****', 'United Kingdom', 'Windows Server 2022', 'raccoon', 298, 1650, 110, ARRAY['jpmorgan-demo.invalid','intranet.jpmorgan-demo.invalid']::text[], NOW()-INTERVAL '35 days', NOW(), 'critical'),
  ('jpm-host-004', 'JPM-RISK-ANALYST-****', 'Germany', 'Windows 10', 'lumma', 67, 340, 18, ARRAY['jpmorgan-demo.invalid','risk.jpmorgan-demo.invalid']::text[], NOW()-INTERVAL '33 days', NOW()-INTERVAL '1 day', 'high')
ON CONFLICT (host_uid) DO UPDATE SET credential_count = EXCLUDED.credential_count;

-- ============================================================
-- SECTION 7: ADDITIONAL COMPANY DATABASE LEAKS
-- ============================================================

-- 7A. APPLE / iCLOUD DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10060, '/data/leaks/apple-demo/apple-icloud-creds.csv', 'apple-icloud-creds.csv', 480000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/apple-demo/apple-icloud-creds.csv', 'apple-icloud-creds.csv', 1, '=== Apple Demo iCloud Database | 900M accounts | 2024 | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Apple Demo iCloud Database 900M accounts 2024 Demo')),
  ('/data/leaks/apple-demo/apple-icloud-creds.csv', 'apple-icloud-creds.csv', 2, 'icloud.dev@demo.invalid:AppleDev2024! | Apple | apple_id=XXXXXXX | icloud_storage=2TB', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'icloud.dev@demo.invalid Apple apple_id icloud_storage 2TB')),
  ('/data/leaks/apple-demo/apple-icloud-creds.csv', 'apple-icloud-creds.csv', 3, 'enterprise.apple@demo.invalid:AppleEnt#2024 | Apple Business | device_count=500 | mdm=true', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'enterprise.apple@demo.invalid Apple Business device_count mdm'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'apple-demo.invalid', 'apple-demo.invalid', 73, 87, ARRAY['tech','breach','leak','apple_demo']::text[], NOW()-INTERVAL '42 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 73;

INSERT INTO intel_darknet_posts (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('apple-dark-001', 'torrez_market', 'darkweb_market', 'Apple Demo iCloud - 900M accounts database', '900M Apple Demo iCloud accounts with emails, phone numbers, and hashed passwords. Verified working. $0.03 BTC per 100K.', 'DarkVendor-03', 'Apple Demo Inc', 'Technology', 'United States', 'database', 'critical', NOW()-INTERVAL '42 days')
ON CONFLICT (post_uid) DO UPDATE SET content = EXCLUDED.content;

-- 7B. NETFLIX DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10061, '/data/leaks/netflix-demo/netflix-subscribers.csv', 'netflix-subscribers.csv', 380000000, 8, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/netflix-demo/netflix-subscribers.csv', 'netflix-subscribers.csv', 1, '=== Netflix Demo Subscriber Database | 260M accounts | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Netflix Demo Subscriber Database 260M accounts Demo')),
  ('/data/leaks/netflix-demo/netflix-subscribers.csv', 'netflix-subscribers.csv', 2, 'subscriber.netflix@demo.invalid:StreamPass2024! | Netflix | plan=premium | cc_last4=5678', 'credential_dump', 'Canada', NOW(), to_tsvector('english', 'subscriber.netflix@demo.invalid Netflix plan premium cc_last4')),
  ('/data/leaks/netflix-demo/netflix-subscribers.csv', 'netflix-subscribers.csv', 3, 'content.admin@demo.invalid:ContentAdmin#2024 | Netflix Studio | access=production | region=la', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'content.admin@demo.invalid Netflix Studio access production region la'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'netflix-demo.invalid', 'netflix-demo.invalid', 70, 85, ARRAY['streaming','breach','leak','netflix_demo']::text[], NOW()-INTERVAL '40 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 70;

-- 7C. SPOTIFY DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10062, '/data/leaks/spotify-demo/spotify-creds.csv', 'spotify-creds.csv', 290000000, 8, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/spotify-demo/spotify-creds.csv', 'spotify-creds.csv', 1, '=== Spotify Demo User Database | 600M users | 2024 Breach | Demo ===', 'credential_dump', 'Sweden', NOW(), to_tsvector('english', 'Spotify Demo User Database 600M users 2024 Breach Demo')),
  ('/data/leaks/spotify-demo/spotify-creds.csv', 'spotify-creds.csv', 2, 'artist.spotify@demo.invalid:ArtistPass2024! | Spotify for Artists | followers=1.2M | payout=$45K', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'artist.spotify@demo.invalid Spotify for Artists followers payout')),
  ('/data/leaks/spotify-demo/spotify-creds.csv', 'spotify-creds.csv', 3, 'label.admin@demo.invalid:LabelAdmin#2024 | Spotify Label Portal | access=full | regions=global', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'label.admin@demo.invalid Spotify Label Portal access full regions'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'spotify-demo.invalid', 'spotify-demo.invalid', 69, 84, ARRAY['streaming','breach','leak','spotify_demo']::text[], NOW()-INTERVAL '39 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 69;

-- 7D. LINKEDIN DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10063, '/data/leaks/linkedin-demo/linkedin-users.csv', 'linkedin-users.csv', 650000000, 12, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/linkedin-demo/linkedin-users.csv', 'linkedin-users.csv', 1, '=== LinkedIn Demo User Database | 900M profiles | 2024 | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'LinkedIn Demo User Database 900M profiles 2024 Demo')),
  ('/data/leaks/linkedin-demo/linkedin-users.csv', 'linkedin-users.csv', 2, 'recruiter.pro@demo.invalid:RecruiterPass! | LinkedIn | recruiter=true | inmail_credits=50', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'recruiter.pro@demo.invalid LinkedIn recruiter inmail_credits')),
  ('/data/leaks/linkedin-demo/linkedin-users.csv', 'linkedin-users.csv', 3, 'sales.premium@demo.invalid:SalesPremium2024! | LinkedIn Sales Navigator | access=premium | seats=10', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'sales.premium@demo.invalid LinkedIn Sales Navigator access premium seats'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'linkedin-demo.invalid', 'linkedin-demo.invalid', 71, 86, ARRAY['social_media','breach','leak','linkedin_demo']::text[], NOW()-INTERVAL '41 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 71;

-- 7E. PAYPAL DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10064, '/data/leaks/paypal-demo/paypal-users.csv', 'paypal-users.csv', 450000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/paypal-demo/paypal-users.csv', 'paypal-users.csv', 1, '=== PayPal Demo User Database | 400M accounts | Financial data | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'PayPal Demo User Database 400M accounts Financial data Demo')),
  ('/data/leaks/paypal-demo/paypal-users.csv', 'paypal-users.csv', 2, 'merchant.paypal@demo.invalid:MerchantSecure! | PayPal | balance=$125,000 | verified=true', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'merchant.paypal@demo.invalid PayPal balance verified')),
  ('/data/leaks/paypal-demo/paypal-users.csv', 'paypal-users.csv', 3, 'business.paypal@demo.invalid:BusinessP@ss2024 | PayPal Business | api_key=PAYPA L_KEY_XXX | webhook_secret=XXX', 'credential_dump', 'Canada', NOW(), to_tsvector('english', 'business.paypal@demo.invalid PayPal Business api_key webhook_secret'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'paypal-demo.invalid', 'paypal-demo.invalid', 74, 88, ARRAY['finance','breach','leak','paypal_demo']::text[], NOW()-INTERVAL '38 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 74;

-- 7F. UBER DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10065, '/data/leaks/uber-demo/uber-employee-db.csv', 'uber-employee-db.csv', 310000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/uber-demo/uber-employee-db.csv', 'uber-employee-db.csv', 1, '=== Uber Demo Internal Database | Employee records | 2024 | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Uber Demo Internal Database Employee records 2024 Demo')),
  ('/data/leaks/uber-demo/uber-employee-db.csv', 'uber-employee-db.csv', 2, 'driver.support@demo.invalid:DriverSupport2024! | Uber | role=internal | access=driver_data', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'driver.support@demo.invalid Uber role internal access driver_data')),
  ('/data/leaks/uber-demo/uber-employee-db.csv', 'uber-employee-db.csv', 3, 'engineering.uber@demo.invalid:UberEng@2024 | Uber | team=ATG | clearance=top_secret', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'engineering.uber@demo.invalid Uber team ATG clearance top_secret'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'uber-demo.invalid', 'uber-demo.invalid', 72, 86, ARRAY['tech','breach','leak','uber_demo']::text[], NOW()-INTERVAL '44 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 72;

-- 7G. SALESFORCE DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10066, '/data/leaks/salesforce-demo/sf-crm-creds.csv', 'sf-crm-creds.csv', 380000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/salesforce-demo/sf-crm-creds.csv', 'sf-crm-creds.csv', 1, '=== Salesforce Demo CRM Database | 200K orgs | Customer data | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Salesforce Demo CRM Database 200K orgs Customer data Demo')),
  ('/data/leaks/salesforce-demo/sf-crm-creds.csv', 'sf-crm-creds.csv', 2, 'admin.sf@demo.invalid:SFAdmin2024! | Salesforce | profile=System Admin | org_id=00DXXXXXXXXX', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'admin.sf@demo.invalid Salesforce profile System Admin org_id')),
  ('/data/leaks/salesforce-demo/sf-crm-creds.csv', 'sf-crm-creds.csv', 3, 'integration.sf@demo.invalid:SFIntegration#2024 | Salesforce API | connected_app=true | scopes=full', 'credential_dump', 'United Kingdom', NOW(), to_tsvector('english', 'integration.sf@demo.invalid Salesforce API connected_app scopes full'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'salesforce-demo.invalid', 'salesforce-demo.invalid', 76, 89, ARRAY['tech','breach','leak','salesforce_demo']::text[], NOW()-INTERVAL '46 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 76;

-- 7H. STEAM / GAMING DATABASE LEAK
INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES (10067, '/data/leaks/steam-demo/steam-users.csv', 'steam-users.csv', 520000000, 10, 'credential_dump', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/leaks/steam-demo/steam-users.csv', 'steam-users.csv', 1, '=== Steam Demo Gaming Platform | 15M Accounts | 2024 Breach | Demo ===', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'Steam Demo Gaming Platform 15M Accounts 2024 Breach Demo')),
  ('/data/leaks/steam-demo/steam-users.csv', 'steam-users.csv', 2, 'gamer.pro@demo.invalid:Gam3r!Pass | Steam | steam_id=76561198012345678 | balance=$500', 'credential_dump', 'Germany', NOW(), to_tsvector('english', 'gamer.pro@demo.invalid Steam steam_id balance')),
  ('/data/leaks/steam-demo/steam-users.csv', 'steam-users.csv', 3, 'developer.steam@demo.invalid:SteamDev2024! | Steamworks API | app_count=5 | revenue=$2M', 'credential_dump', 'United States', NOW(), to_tsvector('english', 'developer.steam@demo.invalid Steamworks API app_count revenue'));

INSERT INTO intel_entities (entity_type, value, normalized_value, risk_score, confidence, tags, first_seen, last_seen)
VALUES ('domain', 'steam-demo.invalid', 'steam-demo.invalid', 70, 85, ARRAY['gaming','breach','leak','steam_demo']::text[], NOW()-INTERVAL '70 days', NOW())
ON CONFLICT (entity_type, normalized_value) DO UPDATE SET risk_score = 70;

-- ============================================================
-- SECTION 8: TELEGRAM SCRAPED DATA
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10080, '/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 8500000, 20, 'telegram_scrape', NOW()),
  (10081, '/data/scrapes/telegram/combolist-channel.txt', 'combolist-channel.txt', 15000000, 25, 'telegram_scrape', NOW()),
  (10082, '/data/scrapes/telegram/dark-deals-channel.txt', 'dark-deals-channel.txt', 12000000, 18, 'telegram_scrape', NOW()),
  (10083, '/data/scrapes/telegram/stealer-logs-channel.txt', 'stealer-logs-channel.txt', 25000000, 30, 'telegram_scrape', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 1, '[TELEGRAM SCRAPE] Private channel: DarkLeaks Underground | 4500 members | 2024-05-01', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'TELEGRAM SCRAPE Private channel DarkLeaks Underground 4500 members')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 2, 'user:pass format dumps posted daily. Current: MetaCorp 500K employee database.', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'user pass format dumps posted daily Current MetaCorp 500K employee database')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 3, 'amazon-demo.invalid:AmazonShop2024! | Amazon | verified=true | full=YES', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'amazon-demo.invalid AmazonShop2024 Amazon verified full YES')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 4, 'google-demo.invalid:GSuite@Admin1 | Google Workspace | mfa_bypassed=false', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'google-demo.invalid GSuite Admin Google Workspace mfa_bypassed')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 5, 'microsoft-demo.invalid:AzureDevOps#2024 | Microsoft | tenant=DEMO-CORP', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'microsoft-demo.invalid AzureDevOps Microsoft tenant DEMO-CORP')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 6, 'jpmorgan-demo.invalid:JP Morgan@123 | JPMorgan | account_type=premium', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'jpmorgan-demo.invalid JP Morgan JPMorgan account_type premium')),
  ('/data/scrapes/telegram/leak-channel-001.txt', 'leak-channel-001.txt', 7, '-- Channel admin: @DarkOperatorX | Posted: 2024-05-01 | Members: 4500 --', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'Channel admin DarkOperatorX Posted 2024-05-01 Members 4500')),
  ('/data/scrapes/telegram/combolist-channel.txt', 'combolist-channel.txt', 1, '[TELEGRAM COMBOLIST] Fresh combo from stealer logs | 15K lines | 2024-05-10', 'telegram_scrape', 'Unknown', NOW(), to_tsvector('english', 'TELEGRAM COMBOLIST Fresh combo from stealer logs 15K lines')),
  ('/data/scrapes/telegram/combolist-channel.txt', 'combolist-channel.txt', 2, 'meta-corp.invalid:MetaBusiness@789 | MetaCorp | Business Manager | admin=true', 'telegram_scrape', 'Unknown', NOW(), to_tsvector('english', 'meta-corp.invalid MetaBusiness MetaCorp Business Manager admin')),
  ('/data/scrapes/telegram/combolist-channel.txt', 'combolist-channel.txt', 3, 'steam-demo.invalid:SteamAccount##99 | Steam | wallet_balance=$1250 | VAC=banned', 'telegram_scrape', 'Unknown', NOW(), to_tsvector('english', 'steam-demo.invalid SteamAccount Steam wallet_balance VAC banned')),
  ('/data/scrapes/telegram/combolist-channel.txt', 'combolist-channel.txt', 4, 'netflix-demo.invalid:NetflixStream! | Netflix | plan=ultra | profile_count=5', 'telegram_scrape', 'Unknown', NOW(), to_tsvector('english', 'netflix-demo.invalid NetflixStream Netflix plan ultra profile_count')),
  ('/data/scrapes/telegram/dark-deals-channel.txt', 'dark-deals-channel.txt', 1, '[TELEGRAM] Dark Deals Underground | 3200 members | Selling: database dumps + access', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'TELEGRAM Dark Deals Underground 3200 members Selling database dumps access')),
  ('/data/scrapes/telegram/dark-deals-channel.txt', 'dark-deals-channel.txt', 2, 'BUY: JPMorgan Demo Bank internal access - $50K - DM @ShadowBroker', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'BUY JPMorgan Demo Bank internal access DM ShadowBroker')),
  ('/data/scrapes/telegram/dark-deals-channel.txt', 'dark-deals-channel.txt', 3, 'SELL: Google Demo GCP service account keys - $15K - verified working', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'SELL Google Demo GCP service account keys verified working')),
  ('/data/scrapes/telegram/stealer-logs-channel.txt', 'stealer-logs-channel.txt', 1, '[STEALER LOGS] Raccoon + Lumma combo | 25K creds | Updated 2024-05-15', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'STEALER LOGS Raccoon Lumma combo 25K creds Updated 2024-05-15')),
  ('/data/scrapes/telegram/stealer-logs-channel.txt', 'stealer-logs-channel.txt', 2, 'google-demo.invalid:CloudP@ss2024! | GCP Console | stealer=raccoon | country=US', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'google-demo.invalid CloudP@ss2024 GCP Console stealer raccoon country US')),
  ('/data/scrapes/telegram/stealer-logs-channel.txt', 'stealer-logs-channel.txt', 3, 'amazon-demo.invalid:AWSSeller@2024 | Seller Central | stealer=lumma | country=DE', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'amazon-demo.invalid AWSSeller 2024 Seller Central stealer lumma country DE')),
  ('/data/scrapes/telegram/stealer-logs-channel.txt', 'stealer-logs-channel.txt', 4, 'paypal-demo.invalid:PayPalBiz!2024 | PayPal | balance=$45K | stealer=stealc', 'telegram_scrape', 'Russia', NOW(), to_tsvector('english', 'paypal-demo.invalid PayPalBiz PayPal balance stealer stealc'));

-- ============================================================
-- SECTION 9: DARKWEB MARKETPLACE POSTS
-- ============================================================

INSERT INTO intel_darknet_posts (post_uid, source, source_type, title, content, threat_actor, victim_name, victim_sector, victim_country, leak_type, severity, discovered_at)
VALUES
  ('dw-market-001', 'versus_market', 'darkweb_market', 'MetaCorp 500K employee database - verified fresh', 'MetaCorp employee database from recent breach. Includes emails, names, departments, phone numbers. 100% verified. Sample available. Price: 0.05 BTC.', 'DarkVendor-01', 'MetaCorp Inc', 'Technology', 'United States', 'database', 'critical', NOW()-INTERVAL '45 days'),
  ('dw-market-002', 'versus_market', 'darkweb_market', 'JPMorgan Demo Bank - internal network access', 'Full internal network access to JPMorgan Demo Bank. Includes VPN credentials, Active Directory dump, and trading system access. Starting $20K.', 'DarkVendor-02', 'JPMorgan Demo Bank', 'Financial', 'United States', 'access', 'critical', NOW()-INTERVAL '35 days'),
  ('dw-market-003', 'torrez_market', 'darkweb_market', 'Google Demo Workspace - service account keys', 'Google Demo service account keys with Owner permissions on 12 projects. Keys verified working. Price: 0.08 BTC.', NULL, 'Google Demo Corp', 'Technology', 'United States', 'api_keys', 'high', NOW()-INTERVAL '55 days'),
  ('dw-market-004', 'alphbay_market', 'darkweb_market', 'Amazon Demo AWS credentials - admin access', 'AWS credentials for amazon-demo.invalid with AdministratorAccess policy. 15+ production accounts compromised. Price: 0.06 BTC.', NULL, 'Amazon Demo Inc', 'E-commerce', 'United States', 'cloud_creds', 'critical', NOW()-INTERVAL '50 days'),
  ('dw-market-005', 'versus_market', 'darkweb_market', 'Stealer logs combo - 50K credentials', 'Combo of stealer logs from last 30 days. Includes Google, Microsoft, Amazon, JPMorgan, MetaCorp, Steam. Format: email:pass|url. Price: 0.02 BTC.', 'DarkVendor-03', NULL, NULL, NULL, 'combolist', 'high', NOW()-INTERVAL '20 days'),
  ('dw-market-006', 'torrez_market', 'darkweb_market', 'TikTok Demo platform - full user database', 'TikTok Demo platform database with 1.2B user records. Emails, phone numbers, hashed passwords. Fresh from 2024 breach. Price: 0.04 BTC.', 'DarkVendor-01', 'TikTok Demo Corp', 'Social Media', 'Singapore', 'database', 'critical', NOW()-INTERVAL '38 days'),
  ('dw-market-007', 'alphbay_market', 'darkweb_market', 'Microsoft Demo Azure AD - global admin', 'Microsoft Demo Azure AD global admin account. Can access all tenant resources, create users, modify permissions. Verified working.', 'DarkVendor-04', 'Microsoft Demo Corp', 'Technology', 'United States', 'access', 'critical', NOW()-INTERVAL '48 days'),
  ('dw-market-008', 'versus_market', 'darkweb_market', 'Steam Demo - gaming accounts with inventory', 'Steam Demo accounts with high-value inventory. Average $500+ per account. 500 accounts available. Price: $50 per account.', NULL, 'Steam Demo', 'Gaming', 'United States', 'accounts', 'medium', NOW()-INTERVAL '60 days'),
  ('dw-market-009', 'torrez_market', 'darkweb_market', 'PayPal Demo - merchant accounts + balances', 'PayPal Demo merchant accounts with verified balances. Total accessible funds: $500K+. Price: 0.03 BTC.', NULL, 'PayPal Demo Corp', 'Financial', 'United States', 'financial_access', 'critical', NOW()-INTERVAL '38 days'),
  ('dw-market-010', 'alphbay_market', 'darkweb_market', 'Apple Demo iCloud - full database', 'Apple Demo iCloud database with 900M accounts. Verified working. Price: 0.05 BTC.', NULL, 'Apple Demo Inc', 'Technology', 'United States', 'database', 'critical', NOW()-INTERVAL '42 days'),
  ('dw-market-011', 'versus_market', 'darkweb_market', 'Salesforce Demo - CRM data for 200K orgs', 'Salesforce Demo CRM data for 200K organizations. Customer records, deals, contacts. Price: 0.07 BTC.', NULL, 'Salesforce Demo Inc', 'Technology', 'United States', 'database', 'critical', NOW()-INTERVAL '46 days'),
  ('dw-market-012', 'torrez_market', 'darkweb_market', 'Uber Demo - internal tools + driver data', 'Uber Demo internal tools access and driver personal data. 50K drivers affected. Price: 0.03 BTC.', NULL, 'Uber Demo Inc', 'Transportation', 'United States', 'database', 'high', NOW()-INTERVAL '44 days')
ON CONFLICT (post_uid) DO UPDATE SET content = EXCLUDED.content;

-- ============================================================
-- SECTION 10: THREAT ACTORS & APT GROUPS
-- ============================================================

INSERT INTO intel_mitre_groups (stix_id, name, group_id, aliases, description, sectors, countries)
VALUES
  ('apt-demo-001', 'DEMO-APT-01', 'G1001', ARRAY['ShadowForge','IronWave']::text[], 'Prolific threat actor specializing in ransomware and data theft. Linked to MetaCorp, JPMorgan Demo, and Microsoft Demo breaches. Uses custom malware and living-off-the-land techniques.', ARRAY['Technology','Financial','Healthcare','Government']::text[], ARRAY['Russia','China']::text[]),
  ('apt-demo-002', 'DEMO-APT-02', 'G1002', ARRAY['SilentStrike','DarkPulse']::text[], 'Advanced persistent threat group focused on financial institutions. Targets JPMorgan Demo Bank and similar financial organizations. Uses spear-phishing and supply chain attacks.', ARRAY['Financial','Banking']::text[], ARRAY['Iran','North Korea']::text[]),
  ('apt-demo-003', 'NEXUS-THREAT', 'G1003', ARRAY['Nexus Collective']::text[], 'Multi-vector threat actor targeting cloud environments. Specializes in AWS, GCP, and Azure credential theft via stealer malware. Linked to cloud data breaches at Google Demo and Amazon Demo.', ARRAY['Technology','Cloud Services']::text[], ARRAY['Russia']::text[]),
  ('ransomware-demo-001', 'DEMO-RANSOM-01', 'G2001', ARRAY['DeadboltDemo','LockIT']::text[], 'Ransomware-as-a-Service group. Demonstrated capability against MetaCorp, JPMorgan Demo, and Microsoft Demo. Uses double-extortion tactics.', ARRAY['Technology','Finance','Healthcare']::text[], ARRAY['Russia']::text[]),
  ('ransomware-demo-002', 'DEMO-RANSOM-02', 'G2002', ARRAY['CryptVault','ShadowEncrypt']::text[], 'Emerging ransomware group targeting cloud infrastructure. Specializes in AWS and Azure environments. Responsible for Google Demo and Amazon Demo breaches.', ARRAY['Technology','Cloud Services']::text[], ARRAY['Russia']::text[]),
  ('apt-demo-004', 'PHANTOM-SHADOW', 'G1004', ARRAY['GhostProxy','DarkMeridian']::text[], 'Sophisticated threat group targeting entertainment and streaming platforms. Linked to Netflix Demo and Spotify Demo breaches. Uses social engineering and credential stuffing.', ARRAY['Entertainment','Media','Streaming']::text[], ARRAY['China','Russia']::text[]),
  ('apt-demo-005', 'SILENT-RIFT', 'G1005', ARRAY['CrimsonVeil','ShadowPillar']::text[], 'State-affiliated threat actor focusing on social media and professional networks. Responsible for LinkedIn Demo and MetaCorp breaches. Uses insider access and supply chain compromise.', ARRAY['Social Media','Professional Services']::text[], ARRAY['Russia','Iran']::text[]),
  ('apt-demo-006', 'CYBER-SHADOW', 'G1006', ARRAY['DarkNebula','StormWraith']::text[], 'Advanced threat group targeting gaming and fintech sectors. Linked to Steam Demo, PayPal Demo, and Uber Demo breaches. Uses stealer malware and social engineering.', ARRAY['Gaming','Fintech','Transportation']::text[], ARRAY['North Korea','China']::text[])
ON CONFLICT (stix_id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO intel_ransomware_groups (group_name, aliases, description, active_since, last_activity, ransom_note_urls, initial_access, targets_sectors, targets_countries, is_active)
VALUES
  ('DEMO-RANSOM-01', ARRAY['DeadboltDemo','LockIT']::text[], 'Ransomware group responsible for MetaCorp and JPMorgan Demo breaches. Uses double-extortion model.', '2024-01-15', NOW(), ARRAY['http://ransom-demo[.]onion/key']::text[], ARRAY['phishing','exploit']::text[], ARRAY['Technology','Financial']::text[], ARRAY['United States','United Kingdom']::text[], true),
  ('DEMO-RANSOM-02', ARRAY['CryptVault','ShadowEncrypt']::text[], 'Emerging ransomware group targeting cloud infrastructure. Specializes in AWS and Azure environments.', '2024-03-01', NOW()-INTERVAL '5 days', ARRAY['http://cryptvault-demo[.]onion']::text[], ARRAY['supply_chain','exploit']::text[], ARRAY['Technology','Cloud Services']::text[], ARRAY['Global']::text[], true),
  ('LockBit', ARRAY['LockBit 3.0','LockBit 4.0']::text[], 'Major ransomware-as-a-service group responsible for Microsoft Demo breach. Uses RaaS model with affiliates.', '2022-01-01', NOW()-INTERVAL '10 days', ARRAY['http://lockbit-demo[.]onion']::text[], ARRAY['phishing','exploit','brute_force']::text[], ARRAY['Technology','Healthcare','Finance','Manufacturing']::text[], ARRAY['Global']::text[], true),
  ('ALPHV/BlackCat', ARRAY['BlackCat','ALPHV']::text[], 'Sophisticated RaaS group responsible for JPMorgan Demo Bank breach. Known for financial sector targeting.', '2021-06-01', NOW()-INTERVAL '7 days', ARRAY['http://alphv-demo[.]onion']::text[], ARRAY['exploit','insider','supply_chain']::text[], ARRAY['Financial','Technology','Healthcare']::text[], ARRAY['United States','Europe']::text[], true)
ON CONFLICT (group_name) DO UPDATE SET last_activity = EXCLUDED.last_activity;

INSERT INTO intel_ransomware_victims (victim_name, group_name, discovered_at, country, sector, description)
VALUES
  ('MetaCorp Inc', 'DEMO-RANSOM-01', NOW()-INTERVAL '45 days', 'United States', 'Technology', 'Listed on DEMO-RANSOM-01 blog. 2.9B records. CVE-2026-99001 exploitation confirmed.'),
  ('JPMorgan Demo Bank', 'DEMO-RANSOM-01', NOW()-INTERVAL '35 days', 'United States', 'Financial', 'Listed on DEMO-RANSOM-01 blog. Internal network access confirmed. Trading systems compromised.'),
  ('Google Demo Corp', 'DEMO-RANSOM-02', NOW()-INTERVAL '20 days', 'United States', 'Technology', 'Listed on DEMO-RANSOM-02 blog. GCP service account keys published. NEXUS-THREAT linked.'),
  ('Amazon Demo Inc', 'DEMO-RANSOM-02', NOW()-INTERVAL '18 days', 'United States', 'E-commerce', 'AWS credentials leaked. Full cloud environment access. NEXUS-THREAT linked.'),
  ('TikTok Demo Corp', 'DEMO-RANSOM-01', NOW()-INTERVAL '38 days', 'Singapore', 'Social Media', '1.2B user records posted on leak site. PHANTOM-SHADOW attributed.'),
  ('Microsoft Demo Corp', 'LockBit', NOW()-INTERVAL '48 days', 'United States', 'Technology', 'Azure AD global admin access sold on darkweb market. LockBit affiliate confirmed.'),
  ('Netflix Demo Inc', 'PHANTOM-SHADOW', NOW()-INTERVAL '40 days', 'United States', 'Entertainment', '260M subscriber records leaked. Payment card data exposed. PHANTOM-SHADOW group.'),
  ('Spotify Demo AB', 'PHANTOM-SHADOW', NOW()-INTERVAL '39 days', 'Sweden', 'Entertainment', '600M user records posted. Artist payout data exposed. PHANTOM-SHADOW group.'),
  ('Apple Demo Inc', 'DEMO-RANSOM-02', NOW()-INTERVAL '42 days', 'United States', 'Technology', '900M iCloud accounts database for sale. Apple Business Manager access included.'),
  ('PayPal Demo Corp', 'CYBER-SHADOW', NOW()-INTERVAL '38 days', 'United States', 'Financial', '400K merchant accounts with balance data for sale. Financial access confirmed.'),
  ('Salesforce Demo Inc', 'DEMO-RANSOM-01', NOW()-INTERVAL '46 days', 'United States', 'Technology', '200K CRM org data exposed. Customer records, deals, and contacts leaked.'),
  ('Uber Demo Inc', 'DEMO-RANSOM-02', NOW()-INTERVAL '44 days', 'United States', 'Transportation', 'Employee database and driver data leaked. Internal tools access sold.'),
  ('LinkedIn Demo Corp', 'SILENT-RIFT', NOW()-INTERVAL '41 days', 'United States', 'Professional', '900M user profiles scraped. Premium account credentials for sale.'),
  ('Steam Demo Inc', 'CYBER-SHADOW', NOW()-INTERVAL '60 days', 'United States', 'Gaming', '15M gaming accounts with inventory data for sale. High-value accounts targeted.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 11: CVE DATABASE
-- ============================================================

INSERT INTO intel_cve_cache (cve_id, description, cvss_v3_score, cvss_v3_severity, epss_score, is_kev, vendor, product, published_at, last_modified)
VALUES
  ('CVE-2026-99001', 'MetaCorp Fileshare Pro remote code execution via unauthenticated file upload', 9.8, 'CRITICAL', 0.96, true, 'MetaCorp', 'FileShare Pro', NOW()-INTERVAL '50 days', NOW()),
  ('CVE-2026-99991', 'Google Demo Workspace SSO bypass via token manipulation', 8.9, 'HIGH', 0.78, true, 'Google', 'Workspace SSO', NOW()-INTERVAL '60 days', NOW()),
  ('CVE-2026-99992', 'JPMorgan Demo trading platform SQL injection', 9.1, 'CRITICAL', 0.89, true, 'JPMorgan', 'Trading Platform', NOW()-INTERVAL '40 days', NOW()),
  ('CVE-2026-99993', 'Microsoft Demo Azure AD privilege escalation', 9.3, 'CRITICAL', 0.82, true, 'Microsoft', 'Azure AD', NOW()-INTERVAL '70 days', NOW()),
  ('CVE-2026-99994', 'Amazon Demo AWS S3 misconfiguration leads to data exfiltration', 8.5, 'HIGH', 0.65, false, 'Amazon', 'S3', NOW()-INTERVAL '55 days', NOW()),
  ('CVE-2026-99995', 'Steam Demo account takeover via session hijacking', 7.4, 'MEDIUM', 0.45, false, 'Steam', 'Auth System', NOW()-INTERVAL '75 days', NOW()),
  ('CVE-2026-99996', 'TikTok Demo API authentication bypass', 8.2, 'HIGH', 0.71, true, 'TikTok', 'Creator API', NOW()-INTERVAL '45 days', NOW()),
  ('CVE-2026-99997', 'Apple Demo iCloud authentication token leakage', 7.8, 'MEDIUM', 0.58, false, 'Apple', 'iCloud Auth', NOW()-INTERVAL '48 days', NOW()),
  ('CVE-2026-99998', 'Netflix Demo streaming service credential stuffing vulnerability', 6.5, 'MEDIUM', 0.42, false, 'Netflix', 'Streaming API', NOW()-INTERVAL '52 days', NOW()),
  ('CVE-2026-99999', 'PayPal Demo merchant API injection vulnerability', 9.0, 'CRITICAL', 0.88, true, 'PayPal', 'Merchant API', NOW()-INTERVAL '44 days', NOW())
ON CONFLICT (cve_id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO intel_exploit_cache (exploit_id, cve_id, title, description, exploit_type, platform, published_at, verified, has_poc)
VALUES
  ('exp-meta-001', 'CVE-2026-99001', 'MetaCorp Fileshare Pro RCE - unauthenticated shell upload', 'Drops webshell via /api/upload endpoint without authentication', 'remote', 'linux/windows', NOW()-INTERVAL '48 days', true, true),
  ('exp-google-001', 'CVE-2026-99991', 'Google Workspace SSO bypass via JWT manipulation', 'Manipulate JWT token to bypass SSO authentication', 'remote', 'web', NOW()-INTERVAL '58 days', true, true),
  ('exp-jpm-001', 'CVE-2026-99992', 'JPMorgan Demo trading SQL injection via order parameter', 'SQL injection in trading platform order submission endpoint', 'remote', 'windows', NOW()-INTERVAL '38 days', true, true),
  ('exp-ms-001', 'CVE-2026-99993', 'Azure AD privilege escalation via token forgery', 'Forge access tokens to escalate to Global Admin', 'remote', 'cloud', NOW()-INTERVAL '68 days', true, true),
  ('exp-tiktok-001', 'CVE-2026-99996', 'TikTok Creator API auth bypass via signature replay', 'Replay HMAC signature to bypass API authentication', 'remote', 'api', NOW()-INTERVAL '43 days', true, true),
  ('exp-paypal-001', 'CVE-2026-99999', 'PayPal merchant API SQL injection', 'SQL injection in PayPal Demo merchant API endpoint', 'remote', 'api', NOW()-INTERVAL '42 days', true, true)
ON CONFLICT (exploit_id) DO UPDATE SET title = EXCLUDED.title;

-- ============================================================
-- SECTION 12: MALWARE SAMPLES & IOCs
-- ============================================================

INSERT INTO intel_malware_cache (sha256, file_name, file_type, malware_family, tags, source, iocs, first_seen, last_seen)
VALUES
  ('deadbeef0000000000000000000000000000000000000000000000000000000001', 'meta_webshell.php', 'php', 'DEMO-WEBSHELL-01', ARRAY['meta','lockbit','webshell','CVE-2026-99001']::text[], 'malwarebazaar', ARRAY['198.51.100.50','meta-corp.invalid']::text[], NOW()-INTERVAL '45 days', NOW()-INTERVAL '5 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000002', 'jpm_backdoor.exe', 'exe', 'DEMO-BACKDOOR-01', ARRAY['jpmorgan','alphv','backdoor']::text[], 'virustotal', ARRAY['203.0.113.200','jpmorgan-demo.invalid']::text[], NOW()-INTERVAL '35 days', NOW()-INTERVAL '3 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000003', 'google_stealer.py', 'python', 'NEXUS-STEALER-01', ARRAY['google','nexus','stealer','gcp']::text[], 'malwarebazaar', ARRAY['198.51.100.75','google-demo.invalid']::text[], NOW()-INTERVAL '55 days', NOW()-INTERVAL '7 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000004', 'aws_keylogger.exe', 'exe', 'NEXUS-STEALER-02', ARRAY['amazon','nexus','keylogger','aws']::text[], 'virustotal', ARRAY['198.51.100.100','amazon-demo.invalid']::text[], NOW()-INTERVAL '50 days', NOW()-INTERVAL '2 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000005', 'ms_lateral.exe', 'exe', 'DEMO-LATERAL-01', ARRAY['microsoft','azure','lateral_movement']::text[], 'malwarebazaar', ARRAY['203.0.113.150','microsoft-demo.invalid']::text[], NOW()-INTERVAL '48 days', NOW()-INTERVAL '1 day'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000006', 'tiktok_dropper.dll', 'dll', 'DEMO-DROPPER-01', ARRAY['tiktok','stealer']::text[], 'hybrid-analysis', ARRAY['198.51.100.25']::text[], NOW()-INTERVAL '38 days', NOW()-INTERVAL '4 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000007', 'netflix_cookie_stealer.js', 'javascript', 'PHANTOM-STEALER-01', ARRAY['netflix','phantom','cookies']::text[], 'malwarebazaar', ARRAY['netflix-demo.invalid']::text[], NOW()-INTERVAL '40 days', NOW()-INTERVAL '3 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000008', 'steam_inventory_grabber.exe', 'exe', 'CYBER-DROPPER-01', ARRAY['steam','cyber-shadow','inventory']::text[], 'virustotal', ARRAY['steam-demo.invalid']::text[], NOW()-INTERVAL '60 days', NOW()-INTERVAL '5 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000009', 'salesforce_oauth_hijack.py', 'python', 'DEMO-OAUTH-HIJACK-01', ARRAY['salesforce','oauth','token theft']::text[], 'malwarebazaar', ARRAY['salesforce-demo.invalid']::text[], NOW()-INTERVAL '46 days', NOW()-INTERVAL '2 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000010', 'uber_data_exfil.exe', 'exe', 'CYBER-EXFIL-01', ARRAY['uber','cyber-shadow','data exfil']::text[], 'hybrid-analysis', ARRAY['uber-demo.invalid']::text[], NOW()-INTERVAL '44 days', NOW()-INTERVAL '1 day'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000011', 'apple_icloud_token_grabber.exe', 'exe', 'DEMO-ICLOUD-GRAB-01', ARRAY['apple','icloud','token theft']::text[], 'malwarebazaar', ARRAY['apple-demo.invalid']::text[], NOW()-INTERVAL '42 days', NOW()-INTERVAL '4 days'),
  ('deadbeef0000000000000000000000000000000000000000000000000000000012', 'linkedin_parser.py', 'python', 'SILENT-RIFT-SCRAPER-01', ARRAY['linkedin','silent-rift','scraping']::text[], 'malwarebazaar', ARRAY['linkedin-demo.invalid']::text[], NOW()-INTERVAL '41 days', NOW()-INTERVAL '6 days')
ON CONFLICT (sha256) DO UPDATE SET tags = EXCLUDED.tags;

-- ============================================================
-- SECTION 13: PHISHING URLs
-- ============================================================

INSERT INTO intel_phishing_cache (phish_id, url, target_brand, phish_type, ip_address, country, active, reported_at, source)
VALUES
  ('phish-meta-001', 'https://secure-meta-login.invalid/auth/signin', 'MetaCorp', 'credential_harvesting', '198.51.100.50', 'Russia', true, NOW()-INTERVAL '44 days', 'openphish'),
  ('phish-meta-002', 'https://meta-corp-verify.invalid/account', 'MetaCorp', 'credential_harvesting', '198.51.100.51', 'Russia', true, NOW()-INTERVAL '43 days', 'phishtank'),
  ('phish-jpm-001', 'https://jpmorgan-secure.invalid/portal/login', 'JPMorgan Demo', 'credential_harvesting', '203.0.113.200', 'Russia', true, NOW()-INTERVAL '34 days', 'openphish'),
  ('phish-google-001', 'https://google-workspace-demo.invalid/sso', 'Google Demo', 'credential_harvesting', '198.51.100.75', 'China', true, NOW()-INTERVAL '54 days', 'phishtank'),
  ('phish-ms-001', 'https://azure-login-demo.invalid/aad', 'Microsoft Demo', 'credential_harvesting', '203.0.113.150', 'Russia', true, NOW()-INTERVAL '47 days', 'openphish'),
  ('phish-amazon-001', 'https://aws-console-demo.invalid/signin', 'Amazon Demo', 'credential_harvesting', '198.51.100.100', 'Russia', true, NOW()-INTERVAL '49 days', 'phishtank'),
  ('phish-tiktok-001', 'https://tiktok-login-demo.invalid/auth', 'TikTok Demo', 'credential_harvesting', '198.51.100.25', 'Vietnam', true, NOW()-INTERVAL '37 days', 'openphish'),
  ('phish-apple-001', 'https://apple-icloud-demo.invalid/secure', 'Apple Demo', 'credential_harvesting', '198.51.100.30', 'China', true, NOW()-INTERVAL '41 days', 'openphish'),
  ('phish-netflix-001', 'https://netflix-login-demo.invalid/verify', 'Netflix Demo', 'credential_harvesting', '203.0.113.75', 'Russia', true, NOW()-INTERVAL '39 days', 'phishtank'),
  ('phish-paypal-001', 'https://paypal-secure-demo.invalid/signin', 'PayPal Demo', 'credential_harvesting', '198.51.100.40', 'Russia', true, NOW()-INTERVAL '37 days', 'openphish'),
  ('phish-steam-001', 'https://steam-login-demo.invalid/auth', 'Steam Demo', 'credential_harvesting', '203.0.113.85', 'Germany', true, NOW()-INTERVAL '59 days', 'phishtank'),
  ('phish-salesforce-001', 'https://salesforce-login-demo.invalid/my', 'Salesforce Demo', 'credential_harvesting', '198.51.100.55', 'India', true, NOW()-INTERVAL '45 days', 'openphish'),
  ('phish-spotify-001', 'https://spotify-premium-demo.invalid/upgrade', 'Spotify Demo', 'credential_harvesting', '203.0.113.95', 'Brazil', true, NOW()-INTERVAL '38 days', 'phishtank'),
  ('phish-uber-001', 'https://uber-driver-demo.invalid/portal', 'Uber Demo', 'credential_harvesting', '198.51.100.65', 'Nigeria', true, NOW()-INTERVAL '43 days', 'openphish')
ON CONFLICT (phish_id) DO UPDATE SET active = true;

-- ============================================================
-- SECTION 14: PASTE SITE POSTS
-- ============================================================

INSERT INTO intel_paste_posts (post_uid, source, title, excerpt, indicator_kinds, matched_brands, matched_cves, threat_actor, severity, discovered_at)
VALUES
  ('paste-meta-001', 'pastebin', 'MetaCorp full employee database', 'admin@meta-corp.invalid:<REDACTED> | HR Portal | MetaCorp | department=IT', ARRAY['credential']::text[], ARRAY['MetaCorp']::text[], ARRAY[]::text[], NULL, 'high', NOW()-INTERVAL '44 days'),
  ('paste-jpm-001', 'rentry', 'JPMorgan Demo trading credentials', 'trader@demo.invalid:<REDACTED> | Bloomberg | JPM | desk=Equities', ARRAY['credential']::text[], ARRAY['JPMorgan Demo']::text[], ARRAY[]::text[], NULL, 'critical', NOW()-INTERVAL '34 days'),
  ('paste-google-001', 'pastebin', 'Google Demo service account keys', 'sa-project@google-demo.iam.gserviceaccount.com:<REDACTED> | GCP | project=demo-001', ARRAY['api_key','credential']::text[], ARRAY['Google Demo']::text[], ARRAY[]::text[], 'NEXUS-THREAT', 'critical', NOW()-INTERVAL '54 days'),
  ('paste-ms-001', 'hastebin', 'Microsoft Demo Azure credentials', 'azure-admin@demo.invalid:<REDACTED> | Azure | tenant=DEMO-CORP', ARRAY['credential']::text[], ARRAY['Microsoft Demo']::text[], ARRAY['CVE-2026-99993']::text[], NULL, 'critical', NOW()-INTERVAL '47 days'),
  ('paste-combo-001', 'pastebin', 'Mega combo list - 50K credentials', 'jpmorgan-demo.invalid:JP@ss2024 | amazon-demo.invalid:Amaz0nKey | google-demo.invalid:GSuiteP@ss', ARRAY['credential']::text[], ARRAY['JPMorgan Demo','Amazon Demo','Google Demo','Microsoft Demo','MetaCorp']::text[], ARRAY[]::text[], NULL, 'critical', NOW()-INTERVAL '20 days'),
  ('paste-aws-001', 'pastebin', 'Amazon Demo AWS keys - production', 'aws-admin-root@amazon-demo.invalid:<REDACTED> | AWS Root | full_access | region=us-east-1', ARRAY['api_key','credential']::text[], ARRAY['Amazon Demo']::text[], ARRAY[]::text[], 'NEXUS-THREAT', 'critical', NOW()-INTERVAL '50 days'),
  ('paste-tiktok-001', 'rentry', 'TikTok Demo API keys and creator data', 'api.tiktok-demo.invalid:<REDACTED> | TikTok | scope=all | creator_id=70001', ARRAY['api_key']::text[], ARRAY['TikTok Demo']::text[], ARRAY['CVE-2026-99996']::text[], NULL, 'high', NOW()-INTERVAL '38 days'),
  ('paste-apple-001', 'hastebin', 'Apple Demo iCloud tokens', 'icloud.dev@demo.invalid:<REDACTED> | Apple | apple_id=XXXXXXX | icloud_storage=2TB', ARRAY['credential','token']::text[], ARRAY['Apple Demo']::text[], ARRAY['CVE-2026-99997']::text[], NULL, 'high', NOW()-INTERVAL '42 days'),
  ('paste-paypal-001', 'pastebin', 'PayPal Demo merchant credentials', 'business.paypal@demo.invalid:<REDACTED> | PayPal | balance=$125,000 | api_key=PAYPAL_KEY', ARRAY['api_key','credential']::text[], ARRAY['PayPal Demo']::text[], ARRAY['CVE-2026-99999']::text[], NULL, 'critical', NOW()-INTERVAL '38 days'),
  ('paste-steam-001', 'rentry', 'Steam Demo gaming accounts combo', 'gamer.pro@demo.invalid:<REDACTED> | Steam | steam_id=76561198012345678 | wallet=$500', ARRAY['credential']::text[], ARRAY['Steam Demo']::text[], ARRAY[]::text[], NULL, 'medium', NOW()-INTERVAL '60 days')
ON CONFLICT (post_uid) DO UPDATE SET excerpt = EXCLUDED.excerpt;

-- ============================================================
-- SECTION 15: COMBOLIST DROPS
-- ============================================================

INSERT INTO intel_combolist_drops (drop_uid, name, source, line_count, unique_domains, sample_domains, matched_brands, severity, threat_actor, posted_at)
VALUES
  ('combo-001', 'MetaCorp + Google Combo - 125K lines', 'telegram', 125000, 8, ARRAY['meta-corp.invalid','google-demo.invalid']::text[], ARRAY['MetaCorp','Google Demo']::text[], 'critical', 'DEMO-APT-01', NOW()-INTERVAL '22 days'),
  ('combo-002', 'Financial Sector Mega Combo - 500K lines', 'darkweb', 500000, 25, ARRAY['jpmorgan-demo.invalid','chase-demo.invalid','wellsfargo-demo.invalid']::text[], ARRAY['JPMorgan Demo','Chase Demo','Wells Fargo Demo']::text[], 'critical', 'DEMO-APT-02', NOW()-INTERVAL '18 days'),
  ('combo-003', 'Cloud Platforms Combo - 200K lines', 'telegram', 200000, 15, ARRAY['google-demo.invalid','amazon-demo.invalid','microsoft-demo.invalid']::text[], ARRAY['Google Demo','Amazon Demo','Microsoft Demo']::text[], 'critical', 'NEXUS-THREAT', NOW()-INTERVAL '15 days'),
  ('combo-004', 'Social Media Combo - 1M lines', 'darkweb', 1000000, 30, ARRAY['meta-corp.invalid','tiktok-demo.invalid','steam-demo.invalid']::text[], ARRAY['MetaCorp','TikTok Demo','Steam Demo']::text[], 'high', NULL, NOW()-INTERVAL '25 days'),
  ('combo-005', 'Streaming Services Combo - 300K lines', 'telegram', 300000, 10, ARRAY['netflix-demo.invalid','spotify-demo.invalid']::text[], ARRAY['Netflix Demo','Spotify Demo']::text[], 'high', 'PHANTOM-SHADOW', NOW()-INTERVAL '20 days'),
  ('combo-006', 'Gaming Platform Combo - 150K lines', 'darkweb', 150000, 5, ARRAY['steam-demo.invalid']::text[], ARRAY['Steam Demo']::text[], 'medium', 'CYBER-SHADOW', NOW()-INTERVAL '30 days'),
  ('combo-007', 'Professional Networks Combo - 400K lines', 'telegram', 400000, 8, ARRAY['linkedin-demo.invalid']::text[], ARRAY['LinkedIn Demo']::text[], 'high', 'SILENT-RIFT', NOW()-INTERVAL '24 days'),
  ('combo-008', 'Tech + Finance Mega Combo - 750K lines', 'darkweb', 750000, 35, ARRAY['google-demo.invalid','microsoft-demo.invalid','amazon-demo.invalid','jpmorgan-demo.invalid','paypal-demo.invalid']::text[], ARRAY['Google Demo','Microsoft Demo','Amazon Demo','JPMorgan Demo','PayPal Demo']::text[], 'critical', NULL, NOW()-INTERVAL '12 days'),
  ('combo-009', 'Full Demo Universe Combo - 2M lines', 'telegram', 2000000, 50, ARRAY['meta-corp.invalid','google-demo.invalid','amazon-demo.invalid','microsoft-demo.invalid','jpmorgan-demo.invalid','apple-demo.invalid','netflix-demo.invalid','steam-demo.invalid']::text[], ARRAY['MetaCorp','Google Demo','Amazon Demo','Microsoft Demo','JPMorgan Demo','Apple Demo','Netflix Demo','Steam Demo']::text[], 'critical', 'DEMO-APT-01', NOW()-INTERVAL '10 days')
ON CONFLICT (drop_uid) DO UPDATE SET line_count = EXCLUDED.line_count;

-- ============================================================
-- SECTION 16: ACTOR-CVE LINKS
-- ============================================================

INSERT INTO intel_actor_cve_links (actor_name, cve_id, relationship, confidence, first_seen, last_seen, sources)
VALUES
  ('DEMO-APT-01', 'CVE-2026-99001', 'exploits', 97, '2026-05-10', '2026-05-25', ARRAY['demo-feed','mitre']::text[]),
  ('DEMO-APT-01', 'CVE-2026-99991', 'exploits', 92, '2026-04-01', '2026-05-20', ARRAY['demo-feed']::text[]),
  ('DEMO-APT-02', 'CVE-2026-99992', 'exploits', 95, '2026-03-15', '2026-05-25', ARRAY['demo-feed','nvd']::text[]),
  ('DEMO-APT-02', 'CVE-2026-99993', 'exploits', 88, '2026-02-01', '2026-04-15', ARRAY['demo-feed']::text[]),
  ('NEXUS-THREAT', 'CVE-2026-99994', 'exploits', 90, '2026-04-01', '2026-05-22', ARRAY['demo-feed']::text[]),
  ('NEXUS-THREAT', 'CVE-2026-99991', 'exploits', 85, '2026-03-01', '2026-05-20', ARRAY['demo-feed']::text[]),
  ('DEMO-RANSOM-01', 'CVE-2026-99001', 'exploits', 99, '2026-05-12', '2026-05-27', ARRAY['demo-feed','cisa-kev']::text[]),
  ('DEMO-RANSOM-01', 'CVE-2026-99992', 'exploits', 94, '2026-04-10', '2026-05-25', ARRAY['demo-feed']::text[]),
  ('DEMO-RANSOM-02', 'CVE-2026-99994', 'exploits', 91, '2026-04-05', '2026-05-20', ARRAY['demo-feed']::text[]),
  ('DEMO-RANSOM-02', 'CVE-2026-99991', 'exploits', 87, '2026-03-15', '2026-05-18', ARRAY['demo-feed']::text[]),
  ('LockBit', 'CVE-2026-99993', 'exploits', 96, '2026-04-20', '2026-05-25', ARRAY['demo-feed','lockbit-blog']::text[]),
  ('ALPHV/BlackCat', 'CVE-2026-99992', 'exploits', 98, '2026-03-25', '2026-05-27', ARRAY['demo-feed','alphv-blog']::text[]),
  ('PHANTOM-SHADOW', 'CVE-2026-99998', 'exploits', 89, '2026-03-01', '2026-05-20', ARRAY['demo-feed']::text[]),
  ('PHANTOM-SHADOW', 'CVE-2026-99997', 'exploits', 85, '2026-02-15', '2026-05-18', ARRAY['demo-feed']::text[]),
  ('SILENT-RIFT', 'CVE-2026-99001', 'exploits', 82, '2026-04-01', '2026-05-22', ARRAY['demo-feed']::text[]),
  ('CYBER-SHADOW', 'CVE-2026-99995', 'exploits', 88, '2026-04-15', '2026-05-25', ARRAY['demo-feed']::text[]),
  ('CYBER-SHADOW', 'CVE-2026-99999', 'exploits', 92, '2026-03-20', '2026-05-27', ARRAY['demo-feed']::text[])
ON CONFLICT (actor_name, cve_id, relationship) DO UPDATE SET confidence = EXCLUDED.confidence;

-- ============================================================
-- SECTION 17: ACTOR-BREACH LINKS
-- ============================================================

INSERT INTO intel_actor_breach_links (actor_name, victim_name, sector, country, breach_date, breach_type, record_count, confidence, severity)
VALUES
  ('DEMO-APT-01', 'MetaCorp Inc', 'Technology', 'United States', CURRENT_DATE-45, 'ransomware', 2900000000, 97, 'critical'),
  ('DEMO-APT-01', 'JPMorgan Demo Bank', 'Financial', 'United States', CURRENT_DATE-35, 'ransomware', 50000, 95, 'critical'),
  ('DEMO-APT-02', 'JPMorgan Demo Bank', 'Financial', 'United States', CURRENT_DATE-35, 'phishing', 15000, 93, 'high'),
  ('NEXUS-THREAT', 'Google Demo Corp', 'Technology', 'United States', CURRENT_DATE-55, 'cloud_breach', 800000, 90, 'high'),
  ('NEXUS-THREAT', 'Amazon Demo Inc', 'E-commerce', 'United States', CURRENT_DATE-50, 'cloud_breach', 1200000, 88, 'high'),
  ('DEMO-RANSOM-01', 'Microsoft Demo Corp', 'Technology', 'United States', CURRENT_DATE-48, 'ransomware', 1500000, 96, 'critical'),
  ('DEMO-RANSOM-01', 'TikTok Demo Corp', 'Social Media', 'Singapore', CURRENT_DATE-38, 'ransomware', 1200000000, 94, 'critical'),
  ('DEMO-RANSOM-02', 'Google Demo Corp', 'Technology', 'United States', CURRENT_DATE-20, 'ransomware', 800000, 89, 'high'),
  ('DEMO-RANSOM-02', 'Amazon Demo Inc', 'E-commerce', 'United States', CURRENT_DATE-18, 'ransomware', 1200000, 87, 'high'),
  ('PHANTOM-SHADOW', 'Netflix Demo Inc', 'Entertainment', 'United States', CURRENT_DATE-40, 'data_theft', 260000000, 92, 'critical'),
  ('PHANTOM-SHADOW', 'Spotify Demo AB', 'Entertainment', 'Sweden', CURRENT_DATE-39, 'data_theft', 600000000, 88, 'high'),
  ('PHANTOM-SHADOW', 'Apple Demo Inc', 'Technology', 'United States', CURRENT_DATE-42, 'data_theft', 900000000, 85, 'critical'),
  ('SILENT-RIFT', 'LinkedIn Demo Corp', 'Professional', 'United States', CURRENT_DATE-41, 'scraping', 900000000, 91, 'high'),
  ('SILENT-RIFT', 'MetaCorp Inc', 'Technology', 'United States', CURRENT_DATE-45, 'credential_stuffing', 2900000000, 86, 'critical'),
  ('CYBER-SHADOW', 'PayPal Demo Corp', 'Financial', 'United States', CURRENT_DATE-38, 'data_theft', 400000000, 93, 'critical'),
  ('CYBER-SHADOW', 'Steam Demo Inc', 'Gaming', 'United States', CURRENT_DATE-60, 'data_theft', 15000000, 90, 'medium'),
  ('CYBER-SHADOW', 'Uber Demo Inc', 'Transportation', 'United States', CURRENT_DATE-44, 'data_theft', 50000, 87, 'high'),
  ('LockBit', 'Microsoft Demo Corp', 'Technology', 'United States', CURRENT_DATE-48, 'ransomware', 1500000, 98, 'critical'),
  ('ALPHV/BlackCat', 'JPMorgan Demo Bank', 'Financial', 'United States', CURRENT_DATE-35, 'ransomware', 50000, 99, 'critical')
ON CONFLICT (actor_name, victim_name, breach_date) DO UPDATE SET record_count = EXCLUDED.record_count;

-- ============================================================
-- SECTION 18: APT CAMPAIGNS & NEWS
-- ============================================================

INSERT INTO intel_news_cache (guid, title, description, url, source, source_label, category, published_at)
VALUES
  ('apt-campaign-001', 'DEMO-APT-01 campaign targets financial and tech sectors with multi-stage attack', 'Threat actor DEMO-APT-01 identified conducting coordinated campaign against MetaCorp, JPMorgan Demo, and Microsoft Demo. Initial access via CVE-2026-99001, lateral movement through stealer logs, data exfiltration confirmed.', 'https://demo.invalid/news/apt-01-campaign', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '30 days'),
  ('apt-campaign-002', 'NEXUS-THREAT abusing cloud trust relationships for cross-account access', 'NEXUS-THREAT exploiting trust relationships between cloud accounts. Google Demo service account keys linked to Amazon Demo and Microsoft Demo compromise via shared OAuth patterns.', 'https://demo.invalid/news/nexus-cloud', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '25 days'),
  ('apt-campaign-003', 'CVE-2026-99001 exploitation campaign expands — 5 new victims identified', 'CVE-2026-99001 (MetaCorp Fileshare Pro RCE) now linked to 5 additional organizations. IOC: IP 198.51.100.50 hosting phishing kits and C2 infrastructure.', 'https://demo.invalid/news/cve-99001-expansion', 'demo-feed', 'Demo Feed', 'vulnerability', NOW()-INTERVAL '20 days'),
  ('apt-campaign-004', 'Ransomware group DEMO-RANSOM-01 adds 3 new victims to leak site', 'Ransomware group DEMO-RANSOM-01 has listed MetaCorp Inc, JPMorgan Demo Bank, and Steam Demo on their darkweb leak site. Demands range from $500K to $5M.', 'https://demo.invalid/news/ransom-01-expansion', 'demo-feed', 'Demo Feed', 'ransomware', NOW()-INTERVAL '15 days'),
  ('apt-campaign-005', 'Stealer malware campaign distributes NEXUS-STEALER via phishing lures', 'New stealer malware family NEXUS-STEALER distributing via LinkedIn phishing lures. Targets cloud engineers at Google Demo, Amazon Demo, Microsoft Demo. Captures browser cookies and cloud session tokens.', 'https://demo.invalid/news/nexus-stealer-campaign', 'demo-feed', 'Demo Feed', 'malware', NOW()-INTERVAL '10 days'),
  ('apt-campaign-006', 'PHANTOM-SHADOW targeting streaming platforms with credential stuffing', 'Threat group PHANTOM-SHADOW linked to Netflix Demo and Spotify Demo breaches. Uses stealer malware and credential stuffing against streaming platforms.', 'https://demo.invalid/news/phantom-streaming', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '12 days'),
  ('apt-campaign-007', 'CYBER-SHADOW linked to Steam Demo, PayPal Demo, and Uber Demo breaches', 'Advanced threat actor CYBER-SHADOW responsible for gaming, fintech, and transportation breaches. Uses custom stealer variants and social engineering.', 'https://demo.invalid/news/cyber-shadow-campaign', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '14 days'),
  ('apt-campaign-008', 'SILENT-RIFT conducting large-scale scraping of professional networks', 'Threat actor SILENT-RIFT conducting mass scraping of LinkedIn Demo and similar professional networks. 900M+ profiles exfiltrated over 6-month campaign.', 'https://demo.invalid/news/silent-rift-scraping', 'demo-feed', 'Demo Feed', 'apt', NOW()-INTERVAL '18 days')
ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title;

-- ============================================================
-- SECTION 19: SIGMA RULES
-- ============================================================

INSERT INTO intel_sigma_rules (rule_id, title, description, status, level, logsource_product, technique_id, tags, references_urls)
VALUES
  ('sigma-meta-001', 'MetaCorp Fileshare Pro RCE - CVE-2026-99001', 'Detects exploitation attempts against MetaCorp Fileshare Pro upload endpoint', 'stable', 'critical', 'webserver', ARRAY['T1190']::text[], ARRAY['meta','fileshare','CVE-2026-99001']::text[], ARRAY['https://demo.invalid/cve/2026-99001']::text[]),
  ('sigma-jpm-001', 'JPMorgan Demo SQL injection in trading endpoint', 'Detects SQL injection attempts in JPMorgan Demo trading platform', 'stable', 'critical', 'web_application', ARRAY['T1190']::text[], ARRAY['jpmorgan','trading','sql-injection']::text[], ARRAY['https://demo.invalid/cve/2026-99992']::text[]),
  ('sigma-google-001', 'Google Demo SSO bypass via JWT manipulation', 'Detects anomalous JWT token patterns in Google Workspace SSO', 'stable', 'high', 'web_application', ARRAY['T1078.004']::text[], ARRAY['google','sso','jwt-bypass']::text[], ARRAY['https://demo.invalid/cve/2026-99991']::text[]),
  ('sigma-ms-001', 'Azure AD privilege escalation via token forgery', 'Detects Azure AD privilege escalation attempts via forged access tokens', 'stable', 'critical', 'cloud', ARRAY['T1098.003']::text[], ARRAY['microsoft','azure','privilege-escalation']::text[], ARRAY['https://demo.invalid/cve/2026-99993']::text[]),
  ('sigma-nexus-001', 'NEXUS-STEALER beacon to C2 infrastructure', 'Detects NEXUS-STEALER C2 beacon patterns at 198.51.100.75', 'stable', 'high', 'endpoint', ARRAY['T1041']::text[], ARRAY['nexus','stealer','c2']::text[], ARRAY['https://demo.invalid/malware/nexus-stealer']::text[]),
  ('sigma-aws-001', 'AWS admin key exfiltration detection', 'Detects AWS access key exfiltration via stealer malware', 'stable', 'critical', 'cloud', ARRAY['T1078.004']::text[], ARRAY['amazon','aws','key-exfil']::text[], ARRAY['https://demo.invalid/cve/2026-99994']::text[]),
  ('sigma-paypal-001', 'PayPal merchant API injection attempt', 'Detects SQL injection in PayPal Demo merchant API', 'stable', 'critical', 'web_application', ARRAY['T1190']::text[], ARRAY['paypal','api','sql-injection']::text[], ARRAY['https://demo.invalid/cve/2026-99999']::text[]),
  ('sigma-stealer-001', 'Raccoon stealer cookie harvesting pattern', 'Detects Raccoon stealer cookie collection and exfiltration', 'stable', 'high', 'endpoint', ARRAY['T1005']::text[], ARRAY['raccoon','stealer','cookies']::text[], ARRAY['https://demo.invalid/stealer/raccoon']::text[]),
  ('sigma-stealer-002', 'Lumma stealer credential exfiltration', 'Detects Lumma stealer credential harvesting pattern', 'stable', 'high', 'endpoint', ARRAY['T1005']::text[], ARRAY['lumma','stealer','credentials']::text[], ARRAY['https://demo.invalid/stealer/lumma']::text[]),
  ('sigma-phishing-001', 'Phishing redirect to fake login page', 'Detects redirects from legitimate sites to phishing pages', 'stable', 'high', 'web_proxy', ARRAY['T1566']::text[], ARRAY['phishing','redirect','credential-harvest']::text[], ARRAY['https://demo.invalid/phishing/overview']::text[])
ON CONFLICT (rule_id) DO UPDATE SET title = EXCLUDED.title;

-- ============================================================
-- SECTION 20: INTEL FINDINGS (Correlation)
-- ============================================================

INSERT INTO intel_findings (finding_type, severity, risk_score, confidence, title, description, source_name, fingerprint, first_seen, last_seen)
VALUES
  ('credential_exposure', 'critical', 95, 96, 'MetaCorp massive credential exposure across multiple sources', 'Domain meta-corp.invalid found in stealer logs (Raccoon, Redline, Lumma, Stealc), paste sites, combolist drops, and darkweb market. 2.9B records confirmed exfiltrated via CVE-2026-99001. DEMO-APT-01 attributed.', 'automation', 'finding-meta-001', NOW()-INTERVAL '44 days', NOW()),
  ('credential_exposure', 'critical', 93, 94, 'JPMorgan Demo Bank internal network compromise', 'Domain jpmorgan-demo.invalid found in stealer logs (Vidar, Raccoon, Redline), darkweb auctions, and APT-02 campaign indicators. Full internal network access confirmed. ALPHV/BlackCat attributed.', 'automation', 'finding-jpm-001', NOW()-INTERVAL '34 days', NOW()),
  ('cloud_misconfiguration', 'high', 88, 91, 'Google Demo cloud credential exposure', 'Google Demo service account keys found in GitHub public repos, stealer logs, and darkweb markets. NEXUS-THREAT linked to cloud environment compromise. CVE-2026-99991 exploited.', 'automation', 'finding-google-001', NOW()-INTERVAL '54 days', NOW()),
  ('credential_exposure', 'high', 85, 89, 'Amazon Demo AWS environment access via stealer logs', 'AWS credentials for amazon-demo.invalid found in stealer logs and combolist drops. NEXUS-THREAT exploiting cloud environments. Root account credentials exposed.', 'automation', 'finding-aws-001', NOW()-INTERVAL '49 days', NOW()),
  ('vulnerability_exploitation', 'critical', 97, 98, 'CVE-2026-99001 chain exploited by multiple threat actors', 'CVE-2026-99001 (MetaCorp Fileshare Pro RCE) actively exploited by DEMO-APT-01, DEMO-RANSOM-01, and SILENT-RIFT. Linked to MetaCorp, JPMorgan Demo, Microsoft Demo, and 3 other organizations.', 'automation', 'finding-cve-99001', NOW()-INTERVAL '45 days', NOW()),
  ('credential_exposure', 'high', 86, 90, 'Microsoft Demo Azure AD global admin compromised', 'Azure AD global admin credentials for microsoft-demo.invalid found in stealer logs and darkweb market. LockBit affiliate selling access. CVE-2026-99993 exploited. Full tenant compromise confirmed.', 'automation', 'finding-ms-001', NOW()-INTERVAL '47 days', NOW()),
  ('credential_exposure', 'critical', 94, 92, 'TikTok Demo platform comprehensive breach', 'TikTok Demo platform database with 1.2B user records found in darkweb market. Stealer logs show creator credentials compromised. CVE-2026-99996 exploited. PHANTOM-SHADOW attributed.', 'automation', 'finding-tiktok-001', NOW()-INTERVAL '38 days', NOW()),
  ('data_exposure', 'high', 87, 91, 'JPMorgan Demo trading credentials in stealer logs and darkweb', 'JPMorgan Demo trading platform credentials (Bloomberg Terminal, internal systems) found in stealer logs from 6 compromised hosts. Darkweb market listing confirms trading system access for sale.', 'automation', 'finding-jpm-trading-001', NOW()-INTERVAL '33 days', NOW()),
  ('credential_exposure', 'critical', 92, 94, 'Full cross-platform mega combo links all demo companies', '2M line combolist links credentials across all demo companies: MetaCorp, Google, Amazon, Microsoft, JPMorgan, Apple, Netflix, Steam, Spotify, LinkedIn, PayPal, Uber, Salesforce, TikTok. Multiple threat actors confirmed using this combo.', 'automation', 'finding-mega-combo-001', NOW()-INTERVAL '10 days', NOW()),
  ('cloud_misconfiguration', 'high', 84, 87, 'NEXUS-THREAT exploiting shared OAuth trust between cloud providers', 'Google Demo GCP service account keys used to pivot into Amazon Demo AWS environment via shared OAuth patterns. Cross-cloud attack chain confirmed. Stealer logs and darkweb sales confirm.', 'automation', 'finding-nexus-crosscloud-001', NOW()-INTERVAL '15 days', NOW())
ON CONFLICT (fingerprint) DO UPDATE SET last_seen = NOW(), risk_score = EXCLUDED.risk_score;

-- ============================================================
-- SECTION 21: CORRELATION REPORT FILES
-- ============================================================

INSERT INTO search_index (id, file_path, file_name, file_size, line_count, file_type, indexed_at)
VALUES
  (10090, '/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 500000, 20, 'correlation_report', NOW()),
  (10091, '/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 420000, 15, 'correlation_report', NOW()),
  (10092, '/data/correlations/financial-breach-correlation.txt', 'financial-breach-correlation.txt', 380000, 12, 'correlation_report', NOW()),
  (10093, '/data/correlations/phantom-shadow-campaign.txt', 'phantom-shadow-campaign.txt', 350000, 10, 'correlation_report', NOW()),
  (10094, '/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 95000000, 10, 'combolist', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO search_index_lines (file_path, file_name, line_number, content, file_type, country, indexed_at, search_vector)
VALUES
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 1, '[CORRELATION REPORT] DEMO-APT-01 Campaign Analysis | IntelForge v2', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CORRELATION REPORT DEMO-APT-01 Campaign Analysis IntelForge')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 2, 'Actor: DEMO-APT-01 | Target Sectors: Technology, Financial | Countries: US, UK, DE', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'Actor DEMO-APT-01 Target Sectors Technology Financial Countries US UK DE')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 3, 'VICTIMS: MetaCorp Inc (2.9B records), JPMorgan Demo Bank (internal net), Microsoft Demo (Azure AD)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'VICTIMS MetaCorp Inc 2.9B records JPMorgan Demo Bank internal net Microsoft Demo Azure AD')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 4, 'CVEs: CVE-2026-99001 (MetaCorp Fileshare Pro RCE, CVSS 9.8), CVE-2026-99991 (Google Workspace SSO bypass, CVSS 8.9)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CVEs CVE-2026-99001 MetaCorp Fileshare Pro RCE CVSS CVE-2026-99991 Google Workspace SSO bypass')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 5, 'MALWARE: DEMO-WEBSHELL-01 (meta_webshell.php), DEMO-BACKDOOR-01 (jpm_backdoor.exe), DEMO-LATERAL-01 (ms_lateral.exe)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'MALWARE DEMO-WEBSHELL-01 meta_webshell.php DEMO-BACKDOOR-01 jpm_backdoor.exe DEMO-LATERAL-01 ms_lateral.exe')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 6, 'IOCs: 198.51.100.50 (meta C2), 203.0.113.200 (jpm C2), 198.51.100.75 (google C2)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'IOCs 198.51.100.50 meta C2 203.0.113.200 jpm C2 198.51.100.75 google C2')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 7, 'ATTACK CHAIN: Phishing (CVE-2026-99001) -> webshell -> stealer (Raccoon) -> creds -> lateral -> data exfil', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'ATTACK CHAIN Phishing CVE-2026-99001 webshell stealer Raccoon creds lateral data exfil')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 8, 'STEALER LOGS: meta-host-001 captured 234 creds including azure.admin@demo.invalid, cloud.engineer@demo.invalid', 'correlation_report', 'United States', NOW(), to_tsvector('english', 'STEALER LOGS meta-host-001 captured 234 creds including azure.admin@demo.invalid cloud.engineer@demo.invalid')),
  ('/data/correlations/apt-01-campaign.txt', 'apt-01-campaign.txt', 9, 'DARKWEB: DEMO-APT-01 selling access on versus_market, torrez_market, alphbay_market', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'DARKWEB DEMO-APT-01 selling access versus_market torrez_market alphbay_market')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 1, '[CORRELATION REPORT] NEXUS-THREAT Cloud Campaign | IntelForge v2', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CORRELATION REPORT NEXUS-THREAT Cloud Campaign IntelForge')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 2, 'Actor: NEXUS-THREAT | Focus: Cloud environments (AWS, GCP, Azure) | Attribution: Russia', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'Actor NEXUS-THREAT Focus Cloud environments AWS GCP Azure Attribution Russia')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 3, 'VICTIMS: Google Demo Corp (GCP service accounts), Amazon Demo Inc (AWS keys), Microsoft Demo (Azure AD)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'VICTIMS Google Demo Corp GCP service accounts Amazon Demo Inc AWS keys Microsoft Demo Azure AD')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 4, 'MALWARE: NEXUS-STEALER-01 (google_stealer.py), NEXUS-STEALER-02 (aws_keylogger.exe) - both beacon to 198.51.100.75', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'MALWARE NEXUS-STEALER-01 google_stealer.py NEXUS-STEALER-02 aws_keylogger.exe beacon 198.51.100.75')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 5, 'STEALER: google-host-001 (US) captured 234 creds including cloud.engineer@demo.invalid and dev@google-demo.invalid', 'correlation_report', 'United States', NOW(), to_tsvector('english', 'STEALER google-host-001 US captured 234 creds including cloud.engineer@demo.invalid dev@google-demo.invalid')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 6, 'GITHUB EXPOSURE: gh-google-001 (GCP key in CDK pipeline), gh-aws-001 (AWS key in infra repo), gh-google-002 (API key in cloud-run config)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'GITHUB EXPOSURE gh-google-001 GCP key CDK pipeline gh-aws-001 AWS key infra repo')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 7, 'DARKWEB: NEXUS-THREAT selling cloud access on versus_market and torrez_market', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'DARKWEB NEXUS-THREAT selling cloud access versus_market torrez_market')),
  ('/data/correlations/nexus-cloud-campaign.txt', 'nexus-cloud-campaign.txt', 8, 'CROSS-CLOUD: GCP service account used to pivot to AWS via shared OAuth trust pattern', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CROSS-CLOUD GCP service account pivot AWS shared OAuth trust pattern')),
  ('/data/correlations/financial-breach-correlation.txt', 'financial-breach-correlation.txt', 1, '[CORRELATION REPORT] Financial Sector Breach Cluster | JPMorgan + PayPal + Chase', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CORRELATION REPORT Financial Sector Breach Cluster JPMorgan PayPal Chase')),
  ('/data/correlations/financial-breach-correlation.txt', 'financial-breach-correlation.txt', 2, 'SECTOR: Financial | PRIMARY ACTORS: DEMO-APT-02, ALPHV/BlackCat, CYBER-SHADOW', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'SECTOR Financial PRIMARY ACTORS DEMO-APT-02 ALPHV BlackCat CYBER-SHADOW')),
  ('/data/correlations/financial-breach-correlation.txt', 'financial-breach-correlation.txt', 3, 'JPMorgan Demo: Internal network access, trading systems, Bloomberg Terminal creds. ALPHV auction. $75K starting.', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'JPMorgan Demo Internal network access trading systems Bloomberg Terminal creds ALPHV auction')),
  ('/data/correlations/financial-breach-correlation.txt', 'financial-breach-correlation.txt', 4, 'PayPal Demo: 400M merchant accounts, balance data. CYBER-SHADOW selling financial access.', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'PayPal Demo 400M merchant accounts balance data CYBER-SHADOW selling financial access')),
  ('/data/correlations/phantom-shadow-campaign.txt', 'phantom-shadow-campaign.txt', 1, '[CORRELATION REPORT] PHANTOM-SHADOW Campaign | Streaming + Entertainment', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'CORRELATION REPORT PHANTOM-SHADOW Campaign Streaming Entertainment')),
  ('/data/correlations/phantom-shadow-campaign.txt', 'phantom-shadow-campaign.txt', 2, 'Actor: PHANTOM-SHADOW | Target: Netflix Demo, Spotify Demo, Apple Demo | Method: Stealer + Credential Stuffing', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'Actor PHANTOM-SHADOW Target Netflix Demo Spotify Demo Apple Demo Method Stealer Credential Stuffing')),
  ('/data/correlations/phantom-shadow-campaign.txt', 'phantom-shadow-campaign.txt', 3, 'MALWARE: PHANTOM-STEALER-01 (netflix_cookie_stealer.js), DEMO-ICLOUD-GRAB-01 (apple_icloud_token_grabber.exe)', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'MALWARE PHANTOM-STEALER-01 netflix_cookie_stealer.js DEMO-ICLOUD-GRAB-01 apple_icloud_token_grabber.exe')),
  ('/data/correlations/phantom-shadow-campaign.txt', 'phantom-shadow-campaign.txt', 4, 'TOTAL RECORDS: 1.76B (Netflix 260M + Spotify 600M + Apple 900M). Darkweb market value: 0.14 BTC.', 'correlation_report', 'Global', NOW(), to_tsvector('english', 'TOTAL RECORDS 1.76B Netflix 260M Spotify 600M Apple 900M Darkweb market value')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 1, '=== MEGA COMBO LIST | 2M lines | All demo platforms | DEMO-APT-01 compiled | Demo Data ===', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'MEGA COMBO LIST 2M lines All demo platforms DEMO-APT-01 compiled Demo Data')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 2, 'meta-corp.invalid:MetaCorp@2024! | MetaCorp | employee=true | department=Engineering', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'meta-corp.invalid MetaCorp 2024 MetaCorp employee department Engineering')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 3, 'jpmorgan-demo.invalid:JPmorgan#Secure99 | JPMorgan Demo | trader=true | desk=Derivatives', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'jpmorgan-demo.invalid JPmorgan Secure99 JPMorgan Demo trader Derivatives')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 4, 'google-demo.invalid:GSuiteForBusiness! | Google Demo | admin=false | mfa=enabled', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'google-demo.invalid GSuiteForBusiness Google Demo admin false mfa enabled')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 5, 'amazon-demo.invalid:AmazonWeb1234! | Amazon Demo | seller=premium | region=us-east-1', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'amazon-demo.invalid AmazonWeb1234 Amazon Demo seller premium region us-east-1')),
  ('/data/leaks/combolists/mega-combo-2m.txt', 'mega-combo-2m.txt', 6, 'microsoft-demo.invalid:AzureDevOps2024! | Microsoft Demo | role=Project Admin | tenant=DEMO-CORP', 'combolist', 'Unknown', NOW(), to_tsvector('english', 'microsoft-demo.invalid AzureDevOps2024 Microsoft Demo role Project Admin tenant DEMO-CORP'));

-- ============================================================
-- SECTION 22: RE-ENABLE TRIGGERS
-- ============================================================

ALTER TABLE intel_entities ENABLE TRIGGER ALL;
ALTER TABLE intel_findings ENABLE TRIGGER ALL;
ALTER TABLE intel_relationships ENABLE TRIGGER ALL;

-- ============================================================
-- SECTION 23: REFRESH MATERIALIZED VIEWS
-- ============================================================

REFRESH MATERIALIZED VIEW mv_geo_threat_30d;
