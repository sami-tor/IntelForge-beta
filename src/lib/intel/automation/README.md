# IntelForge Automation Layer

The automation layer turns IntelForge from a passive viewer of feeds
into a self-running threat-intelligence platform. It runs entirely
off the local Postgres cache and never calls upstream APIs at request
time, so the dashboard stays fast and survives outages.

## Modules

| File | Responsibility |
|------|----------------|
| `threat-score.ts`         | Composite 0–100 global threat score with severity tier and 24h delta. |
| `correlator.ts`           | Walks recent CVEs and merges any matching exploits, news mentions, and KEV flags into a single cluster row. Re-runnable, upserts on `cluster_key`. |
| `trends.ts`               | Captures one daily counter per metric_key, computes percent delta and flags emerging metrics. |
| `forecast.ts`             | Holt's linear exponential smoothing for 7-day forecasts. Z-score-based anomaly detection over a 14-day window. |
| `geo-sector.ts`           | Per-country and per-sector risk index from ransomware victims, phishing infrastructure, and dark-web posts. |
| `action-queue.ts`         | Auto-generated, prioritised tasks for analysts. Idempotent via `action_key` UNIQUE. |
| `briefing-generator.ts`   | Deterministic narrative + structured payload from steps above. Stored daily. |
| `briefing-pdf.ts`         | Renders a briefing into a polished A4 PDF with PDFKit. |
| `notifications.ts`        | Fires webhooks for high/critical briefings, anomalies and clusters. Logs every dispatch. |
| `orchestrator.ts`         | Runs all eight steps end-to-end and records each invocation. |

## Cron entry-point

`POST /api/cron/automation` — protected by `CRON_SECRET`. Runs the full
pipeline. Schedule alongside `/api/cron/intel-sync` (every 30–60 minutes).

## Public read endpoints

- `GET /api/intel/automation/status`              — latest score + history + clusters + trends + briefing.
- `GET /api/intel/automation/briefings`           — list recent briefings for the archive page.
- `GET /api/intel/automation/briefings/export`    — download today's briefing as PDF.
- `GET /api/intel/automation/forecasts`           — 7-day forecasts + recent anomalies.
- `GET /api/intel/automation/geo`                 — geographic + sector snapshots.
- `GET /api/intel/automation/actions`             — list action queue items.
- `PATCH /api/intel/automation/actions`           — update action status (auth required).
- `GET /api/intel/automation/stream`              — Server-Sent Events stream of the latest score.

## Admin endpoint

- `POST /api/admin/automation/run` — trigger a one-off pipeline run.
- `GET  /api/admin/automation/run` — list the last 20 automation runs.

## Pages

- `/intelligence/command-center` — gauge, briefing, clusters, trend cards, **forecasts, anomalies, geo heatmap, sector index, action preview, live SSE indicator, PDF download**.
- `/intelligence/briefings`      — archive of all generated briefings + latest-as-PDF link.
- `/intelligence/action-queue`   — queue UI with filter, expand-steps, status transitions.
- `/admin/automation`            — admin Run Now + run log + manual feed-sync triggers.

## Migrations

Run in order:
```bash
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-migration.sql

docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/intel-automation-v2-migration.sql

# Optional: backfill 14 days of trend history from cached feed data
docker exec -i intelforge-postgres psql -U intelforge -d intelforge \
  -f - < scripts/seed-trend-history.sql
```

All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
