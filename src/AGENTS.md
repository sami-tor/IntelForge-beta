# AGENTS.md

## Learned User Preferences

- Always use Server Components (not `useEffect` client-side fetching) for intelligence/data pages — user explicitly prefers SSR so pages load instantly with no loading spinners.
- Never show external API source names in the UI — user stated "dont show the api sources names" explicitly.
- Scrape data from external APIs, save to the database, and always display from the local cache — pages must work even when upstream APIs are down.
- Follow existing code patterns before writing new files — read analogous existing files first.
- When building features, build to proper SaaS level quality, not low-level/prototype quality.

## Learned Workspace Facts

- Project name: **IntelForge** — a Threat Intelligence SaaS hub (FYP project).
- Stack: Next.js 16 + TypeScript + React (frontend), Go services (`cmd/search-api`, `cmd/indexer`), Python services (`visual-search/service`, `services`, `threadcoreface`).
- Dev server must be started with the `--webpack` flag: `next dev --webpack` — Next.js 16 defaults to Turbopack but the project has a webpack config in `next.config.mjs` that is incompatible with it.
- PostgreSQL runs in Docker container `intelforge-postgres` (image: `postgres:16-alpine`), exposed on host port **5432** (mapped to container port 5432). DB name: `intelforge`, user: `intelforge`.
- `DATABASE_URL` must be set in `.env.local` before running migrations or starting the server — it was empty by default and required manual configuration.
- Migration SQL lives in `scripts/` and should be applied inside the Docker container using `docker exec -i intelforge-postgres psql`.
- JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `RESPONSE_SIGNING_SECRET`) must be populated in `.env.local` — run `npm run env:secrets` or login will fail.
- Default admin is seeded by migrations (`admin@intelforge.com`) — password must be changed after first login; never document real passwords in repo files.
- Intelligence data tables: `intel_news_cache`, `intel_ransomware_groups`, `intel_ransomware_victims`, `intel_cve_cache`, `intel_ioc_lookups`, `intel_malware_cache`, `intel_mitre_groups`, `intel_mitre_techniques`, `intel_feed_sync_log`.
- `threadcoreface/` folder has been reorganised: `tests/` (test files), `utils/` (utility scripts), `app/` (core modules), with a `README.md` added.
- Correlation endpoint `/api/intel/correlate` auto-detects query type (CVE, hash, ransomware group, threat actor, keyword) and returns matched intel from the local DB.
