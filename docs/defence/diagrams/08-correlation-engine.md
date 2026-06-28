# Diagram 8 — Deep Correlation Engine

See `correlation-deep-dive.md` for the prose discussion. The diagram
below shows the parallel multi-anchor pipeline plus the signal-type
catalogue with weights.

```
SOURCE TABLES (12)
   intel_cve_cache · intel_exploit_cache · intel_news_cache
   intel_paste_posts · intel_stealer_logs · intel_combolist_drops
   intel_compromised_hosts · intel_ransomware_* · intel_darknet_posts
   intel_actor_cve_links · intel_actor_breach_links · intel_mitre_groups
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  THREE PARALLEL ANCHOR PASSES                                   │
│                                                                 │
│  runCvePass()         → cluster_type = cve                      │
│  runActorPass()       → cluster_type = actor                    │
│  runRansomwarePass()  → cluster_type = ransomware               │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
SIGNAL TYPES (11) — every signal carries 0-100 confidence
   kev (w 12) · exploit (w 14) · ransomware_victim (w 13)
   actor_link (w 11) · compromised_host (w 9) · darknet_post (w 9)
   stealer_log (w 8) · combolist (w 7) · paste (w 6)
   news (w 4) · related_cve (w 3)
        │
        ▼
score = base + Σ (weight · confidence · decay(age))
        where decay = max(0.4, 2^(−age_days / 60))
        │
        ▼
intel_correlation_clusters — UNIQUE on cluster_key, idempotent.
```
