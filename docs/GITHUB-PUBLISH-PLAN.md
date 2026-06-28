# IntelForge-beta — GitHub Publish Plan

Step-by-step plan to publish this project as a **public** repository named **`IntelForge-beta`** with full documentation and **no secrets or personal data**.

---

## Phase 1 — Security audit (before any push)

| Check | Status | Action |
|-------|--------|--------|
| `.env.local` excluded | Required | Listed in `.gitignore` — never commit |
| `.env.example` only placeholders | Required | No real keys in template |
| SSL certs / private keys | Required | `ssl/`, `*.pem`, `*.key` gitignored |
| Local data folders | Required | `data/`, `uploads/`, `userfiles/` gitignored |
| Student emails / PC paths | Required | `docs/FYP_Docs/` gitignored (contains personal info) |
| Admin password in README | Required | Removed — use `docs/SETUP.md` |
| Hardcoded API keys in code | Required | All keys via `process.env` / `.env.local` |
| `node_modules/` & `.next/` | Required | Gitignored |

### Files that must NEVER be committed

```
.env.local
.env
ssl/
data/
userfiles/
docs/FYP_Docs/
node_modules/
.next/
*.pem
*.key
```

### Rotate secrets if they were ever exposed

If `.env.local` was shared or committed before, rotate:

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`
- `RESPONSE_SIGNING_SECRET`, `CRON_SECRET`
- `DATABASE_URL` password
- Any third-party API keys (VirusTotal, AbuseIPDB, etc.)

Run locally: `npm run env:secrets` to regenerate app secrets.

---

## Phase 2 — Repository setup

### 2.1 Local git init

```powershell
cd <your-project-folder>
git init
git branch -M main
git add .
git status   # verify no .env.local, data/, or FYP_Docs/
git commit -m "Initial public release: IntelForge-beta CTI platform"
```

### 2.2 Create GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `IntelForge-beta`
3. **Description:** `Cyber Threat Intelligence OSINT platform — Next.js, PostgreSQL, Quickwit, Milvus`
4. **Visibility:** Public
5. Do **not** initialize with README (we already have one)
6. Click **Create repository**

### 2.3 Push to GitHub

```powershell
git remote add origin https://github.com/<YOUR_USERNAME>/IntelForge-beta.git
git push -u origin main
```

Replace `<YOUR_USERNAME>` with your GitHub username.

---

## Phase 3 — Documentation included in repo

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview, quick start, architecture summary |
| `docs/SETUP.md` | Full installation & configuration guide |
| `docs/API-REFERENCE.md` | All 137+ API routes + external services |
| `docs/CODEBASE-DEEP-STRUCTURE.md` | Deep architecture reference |
| `docs/defence/` | FYP defence materials (diagrams, QA, demo script) |
| `SECURITY.md` | Vulnerability reporting & security practices |
| `LICENSE` | MIT License |
| `CONTRIBUTING.md` | Contribution guidelines |
| `.env.example` | Environment variable template (no secrets) |

---

## Phase 4 — Post-publish checklist

- [ ] Verify repo is public at `https://github.com/<user>/IntelForge-beta`
- [ ] Confirm `.env.local` is **not** in file list on GitHub
- [ ] Add repository topics: `osint`, `threat-intelligence`, `cybersecurity`, `nextjs`, `fyp`
- [ ] Set repository description and website URL (`http://localhost:3000` or your deploy URL)
- [ ] Enable GitHub Dependabot (Settings → Security → Dependabot)
- [ ] Optional: add GitHub Actions CI for `npm run build` and `npm run defence:test`

---

## Phase 5 — Optional enhancements

1. **GitHub Releases** — Tag `v0.1.0-beta` for first public release
2. **Docker Compose** — Document full stack: `docker-compose.quickwit.yml` + Postgres
3. **Demo deployment** — Vercel/Railway for frontend only (DB + Quickwit separate)
4. **Screenshots** — Add `docs/screenshots/` for README badges

---

## Repository naming

| Item | Value |
|------|-------|
| GitHub repo name | `IntelForge-beta` |
| npm package name | `intelforge-beta` |
| Display name | IntelForge (Beta) |

---

*This plan was generated as part of the public release preparation. Keep `docs/FYP_Docs/` local only.*
