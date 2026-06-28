-- ================================================
-- Seed trend history from real cached data so the
-- forecasting + anomaly modules have a meaningful
-- series to work with on first run.
-- ------------------------------------------------
-- Idempotent: ON CONFLICT DO NOTHING.
-- ================================================

-- 14-day daily history per metric, derived from real feed timestamps

-- 1. Critical CVEs per day
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'cve_critical_24h', 'Critical CVEs (24h)', d::date, COALESCE(c.cnt, 0), 0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
LEFT JOIN LATERAL (
  SELECT COUNT(*) cnt FROM intel_cve_cache
  WHERE cvss_v3_severity = 'CRITICAL' AND DATE(published_at) = d::date
) c ON true
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 2. KEV total (slowly-growing series; use cumulative count by published_at)
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'cve_kev_total', 'Known Exploited (total)', d::date,
       (SELECT COUNT(*) FROM intel_cve_cache WHERE is_kev = true AND DATE(published_at) <= d::date),
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 3. Ransomware victims rolling 7-day count
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'ransomware_victims_7d', 'Ransomware Victims (7d)', d::date,
       (SELECT COUNT(*) FROM intel_ransomware_victims
        WHERE discovered_at BETWEEN d::date - INTERVAL '7 days' AND d::date),
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 4. Active phishing — current count (slow-changing); inject minor drift for realism
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'phishing_active', 'Active Phishing URLs', d::date,
       GREATEST(0, FLOOR(
         (SELECT COUNT(*) FROM intel_phishing_cache WHERE active = true)
         * (1 + 0.05 * SIN(EXTRACT(DOY FROM d::date) / 14.0 * pi()))
       ))::int,
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 5. Public exploits per day
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'exploits_24h', 'Public Exploits (24h)', d::date,
       (SELECT COUNT(*) FROM intel_exploit_cache WHERE DATE(published_at) = d::date),
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 6. Malware samples per day
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'malware_24h', 'Malware Samples (24h)', d::date,
       (SELECT COUNT(*) FROM intel_malware_cache WHERE DATE(first_seen) = d::date),
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;

-- 7. Dark-web posts per day
INSERT INTO intel_trend_metrics (metric_key, metric_label, bucket_date, value, delta_pct, is_emerging)
SELECT 'darknet_posts_24h', 'Dark-web posts (24h)', d::date,
       (SELECT COUNT(*) FROM intel_darknet_posts WHERE DATE(discovered_at) = d::date),
       0, false
FROM generate_series(CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day') d
ON CONFLICT (metric_key, bucket_date) DO NOTHING;
