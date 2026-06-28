# IntelForge Setup Guide

Complete installation and configuration for local development.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Uses `--legacy-peer-deps` |
| PostgreSQL | 16 | Docker or local install |
| Docker Desktop | Latest | Optional — for Quickwit, Milvus, MinIO |
| Go | 1.21+ | Optional — for indexer services |
| Python | 3.10+ | Optional — for visual search scrapers |

---

## 1. Clone and install

```bash
git clone https://github.com/<YOUR_USERNAME>/IntelForge-beta.git
cd IntelForge-beta
npm install --legacy-peer-deps
```

---

## 2. Environment configuration

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local values. **Never commit this file.**

### Required variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/intelforge` |
| `JWT_SECRET` | Access token signing key | Generate with `npm run env:secrets` |
| `JWT_REFRESH_SECRET` | Refresh token key | Generate with `npm run env:secrets` |
| `SESSION_SECRET` | Session cookie key | Generate with `npm run env:secrets` |
| `RESPONSE_SIGNING_SECRET` | API response HMAC key | Generate with `npm run env:secrets` |
| `CRON_SECRET` | Cron endpoint auth | Generate with `npm run env:secrets` |
| `NEXT_PUBLIC_APP_URL` | App base URL | `http://localhost:3000` |

### Generate secrets automatically

```bash
npm run env:secrets
```

This writes cryptographically random values into `.env.local` for all secret fields.

### Optional services

| Variable | Default | Service |
|----------|---------|---------|
| `QUICKWIT_URL` | `http://localhost:7280` | Full-text search |
| `VISUAL_SEARCH_SERVICE_URL` | `http://localhost:8000` | Face/visual search |
| `MILVUS_HOST` | `localhost` | Vector database |
| `MINIO_ENDPOINT` | `localhost:9000` | Image storage |
| `OPENSEARCH_URL` | `http://127.0.0.1:9200` | File index (optional) |

### Optional API keys (enrichment)

Add only if you need extended IOC lookups. All feeds work without these.

```
VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=
GREYNOISE_API_KEY=
OTX_API_KEY=
GITHUB_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 3. Database setup

### Option A — Docker PostgreSQL

```bash
docker run -d \
  --name intelforge-postgres \
  -e POSTGRES_USER=intelforge \
  -e POSTGRES_PASSWORD=<choose-a-strong-password> \
  -e POSTGRES_DB=intelforge \
  -p 5432:5432 \
  postgres:16-alpine
```

Set `DATABASE_URL` in `.env.local`:

```
DATABASE_URL=postgresql://intelforge:<password>@localhost:5432/intelforge
```

### Option B — Existing PostgreSQL

Create database and user, then set `DATABASE_URL`.

### Run migrations

```bash
npm run db:migrate
```

This applies all SQL migrations in `scripts/`.

---

## 4. Admin account

Migrations seed a default admin user:

| Field | Value |
|-------|-------|
| Email | `admin@intelforge.com` |
| Username | `admin` |

**Change the password immediately** after first login via the dashboard or admin panel.

Admin URLs:
- `/admin-portal/login` — recommended entry
- `/admin` — admin dashboard (requires admin role)

---

## 5. Start the application

```bash
# Development (requires --webpack for Next.js 16)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

```bash
# Production build
npm run build
npm start
```

---

## 6. Optional services

### Quickwit (full-text search)

```bash
docker-compose -f docker-compose.quickwit.yml up -d
```

Verify: `curl http://localhost:7280/api/v1/health`

### Visual search (Python FastAPI)

```bash
cd scrapers/visual-search/service
pip install -r requirements-advanced.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Go search API (placeholder)

```bash
npm run search:api
# Listens on :8090
```

---

## 7. Verify installation

```bash
# Health check
curl http://localhost:3000/api/health

# Run test suite
npm run defence:test

# Production build check
npm run build
```

---

## 8. Common issues

| Issue | Fix |
|-------|-----|
| Login timeout (26s) | Run `npm run env:secrets` — JWT secrets empty |
| Hub stats show 0 | Wait for DB warmup or refresh page |
| Search returns empty | Start Quickwit Docker stack |
| `/api/health` 503 | High memory in dev — normal in development mode |
| Build fails TypeScript | Run `npm run build` and fix reported errors |

---

## 9. Project structure

See [README.md](../README.md#project-structure) and [CODEBASE-DEEP-STRUCTURE.md](CODEBASE-DEEP-STRUCTURE.md).

---

## Security reminder

- Never commit `.env.local`
- Never push API keys to GitHub
- Rotate secrets if accidentally exposed
- See [SECURITY.md](../SECURITY.md) for reporting vulnerabilities
