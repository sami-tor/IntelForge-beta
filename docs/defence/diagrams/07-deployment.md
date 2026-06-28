# Diagram 7 — Deployment Topology

```mermaid
flowchart LR
    subgraph CLIENT["Client tier"]
        BROWSER[Browser]
    end

    subgraph EDGE["Next.js edge / proxy"]
        MW["middleware.ts<br/>security headers<br/>JWT verify<br/>rate limit"]
    end

    subgraph APP["Next.js app server (Node runtime)"]
        SSR[Server-rendered pages]
        REST[REST endpoints]
        SSE_RT["SSE: app/api/intel/automation/stream"]
        CRON[Cron endpoints]
    end

    subgraph DATA["Data tier"]
        PG["PostgreSQL 16<br/>Docker: intelforge-postgres<br/>port 5432"]
    end

    subgraph SCHED["Scheduler (external)"]
        EXTCRON["Vercel Cron / GitHub Actions / k8s CronJob"]
    end

    subgraph WEBHOOKS["Webhook subscribers"]
        SIEM[Splunk / Sentinel]
        SLACK[Slack incoming webhook]
        CUSTOM[Custom HTTPS endpoint]
    end

    BROWSER --> MW
    MW --> SSR
    MW --> REST
    BROWSER -- "EventSource" --> SSE_RT
    SSE_RT --> PG
    SSR --> PG
    REST --> PG
    EXTCRON -- "Bearer CRON_SECRET" --> CRON
    CRON --> PG
    CRON -- "alert.created" --> SIEM
    CRON -- "alert.created" --> SLACK
    CRON -- "alert.created" --> CUSTOM
```

## Environment requirements

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | ≥ 20 | required by Next 16 |
| Next.js | 16.2.4 | uses `--webpack` flag, not Turbopack |
| PostgreSQL | 16 | `intelforge-postgres` Docker image: `postgres:16-alpine` |
| Docker | any modern | only used to host Postgres |

## Required environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `DATABASE_URL` | every module via `lib/db.ts` | must be set before migrations |
| `CRON_SECRET` | `app/api/cron/automation/route.ts:18` | reject all production calls without it |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `lib/jwt.ts` | reused for admin endpoints |
| `SESSION_SECRET` | `lib/secure-session.ts` | reused |
| `RESPONSE_SIGNING_SECRET` | `lib/response-signing.ts` | reused |

All secrets must be 64-character random hex. See
`scripts/generate-jwt-secrets.js` for a generator.

## Production hardening checklist

- [x] All cron endpoints require `Bearer CRON_SECRET`
- [x] Admin endpoints re-fetch the user from DB (`lib/middleware.ts:55`)
- [x] CSRF token required on action-queue mutations
- [x] No upstream provider names exposed in UI
- [x] Parameterised SQL everywhere (no string interpolation)
- [x] PDFKit declared as `serverExternalPackages` so AFM fonts ship
- [x] SSE handles client abort cleanly (no leaked intervals)
- [x] All migrations idempotent; safe re-run after partial failure
