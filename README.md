# IntelForge-beta

> A full-stack, multi-service Cyber Threat Intelligence (CTI) OSINT platform for security analysts to monitor, correlate, and act on cyber threats in real time.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

**Repository:** `IntelForge-beta` (public beta)  
**Documentation:** [`docs/`](docs/) · [Setup Guide](docs/SETUP.md) · [API Reference](docs/API-REFERENCE.md) · [Architecture](docs/CODEBASE-DEEP-STRUCTURE.md)

---

## Project Structure

```
intelforge/
│
├── src/                        # All application source code
│   ├── app/                    # Next.js 16 App Router — pages & API routes
│   │   ├── intelligence/       # 30+ threat intelligence modules
│   │   ├── admin/              # Multi-tenant admin panel
│   │   ├── api/                # REST API endpoints (auth, intel, admin, search)
│   │   ├── dashboard/          # User dashboard
│   │   ├── cases/              # Case/investigation management
│   │   ├── reports/            # Report generation
│   │   ├── search/             # Global search UI
│   │   └── (auth pages)        # Login, Register, Password reset
│   ├── components/             # React component library
│   │   ├── intelligence/       # Threat score gauge, forecast charts, geo-heatmap
│   │   ├── search/             # Advanced search modals, archive viewer
│   │   └── ui/                 # Reusable UI primitives (shadcn/ui)
│   ├── lib/                    # Core backend logic
│   │   ├── intel/              # Intelligence modules
│   │   │   ├── automation/     # Action queue, correlator, briefing generator, threat score
│   │   │   ├── connectors/     # WHOIS, DNS lookup connectors
│   │   │   └── fetchers/       # CVE, ransomware, malware, phishing, darknet fetchers
│   │   ├── integrations/       # MISP, SIEM formatter, webhook dispatcher
│   │   ├── db.ts               # PostgreSQL connection pool
│   │   ├── auth.ts             # JWT authentication (access + refresh tokens)
│   │   ├── security.ts         # Security middleware & audit logging
│   │   └── validation.ts       # Zod-based request validation schemas
│   ├── hooks/                  # Custom React hooks (useIsMobile, useToast)
│   ├── styles/                 # Global CSS styles
│   ├── public/                 # Static assets
│   ├── tests/                  # Node.js test suite (12 suites, 84 test cases)
│   ├── proxy.ts                # Next.js 16 proxy (middleware) — auth, rate limiting, security headers
│   ├── next.config.mjs         # Next.js configuration
│   ├── tailwind.config.ts      # Tailwind CSS configuration
│   ├── tsconfig.json           # TypeScript configuration
│   ├── components.json         # shadcn/ui component registry
│   ├── postcss.config.mjs      # PostCSS configuration
│   └── AGENTS.md               # Project conventions & learned preferences
│
├── scrapers/                   # All scraping & data collection services
│   ├── services/               # Python scraping services
│   │   ├── face_scraper/       # Face detection, embedding, deduplication pipeline
│   │   ├── image_indexer/      # Image embedding and Milvus indexing pipeline
│   │   ├── threads_scraper/    # Threads/social media scraping utilities
│   │   └── forum_monitor/      # Dark web forum monitoring service
│   ├── visual-search/          # FastAPI visual/face search microservice
│   │   └── service/app.py      # Face search, visual search API endpoints
│   ├── threadcoreface/         # Standalone face identification utility tool
│   └── telegram-scraper/       # Standalone Telegram data scraper
│
├── indexer/                    # All indexing & search services
│   ├── cmd/                    # Go microservices
│   │   ├── search-api/         # REST search API (Quickwit/OpenSearch backend)
│   │   └── indexer/            # Background indexing service
│   ├── internal/               # Go internal packages (logger, search, security, etc.)
│   ├── quickwit-config/        # Quickwit full-text search index schemas
│   ├── indexer.py              # Python standalone indexer
│   └── auto-indexer.py         # Python auto-indexing pipeline
│
├── data/                       # All data — scraped intel, samples, cache
│   ├── intel/                  # Aggregated threat intelligence data
│   │   └── dns_ip_cert/        # DNS, IP, certificate intelligence
│   ├── scraped/                # Scraped data from various sources
│   │   ├── forums/             # Dark web forum scrapes
│   │   ├── github/             # GitHub secret scanning results
│   │   ├── paste_sites/        # Paste site monitoring
│   │   ├── reddit/             # Reddit OSINT
│   │   ├── telegram/           # Telegram channel scrapes
│   │   └── twitter/            # Twitter/X OSINT
│   ├── leaks/                  # Breach/leak data
│   ├── stealer_logs/           # Stealer log data
│   ├── ulp/                    # User-level persistence data
│   ├── database/               # SQLite/archive database files
│   └── image/                  # Sample/test images for visual search
│
├── userfiles/                  # User-uploaded & generated files
│   ├── uploads/                # User file uploads (CSV, JSON, etc.)
│   ├── exports/                # Exported data, IOC dumps
│   ├── reports/                # Generated PDF/HTML reports
│   └── profiles/               # User profile images, avatars
│
├── scripts/                    # Database migrations, seed data, utilities
├── docs/                       # Setup, API reference, architecture docs
├── diagram/                    # PlantUML architecture diagrams
└── docker-compose.quickwit.yml # Quickwit search cluster Docker compose
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| API | Next.js API Routes (REST), Go (search-api) |
| Database | PostgreSQL 16 (intel cache tables) |
| Search | Quickwit (full-text), Milvus (vector/visual) |
| Auth | JWT (access + refresh), 2FA (speakeasy), response signing |
| Visual Search | FastAPI (Python), face embedding models |
| Scrapers | Python (Threads, Telegram, forums, GitHub secrets) |
| Charts | Recharts, custom threat score gauge |

---

## Quick Start

See the full guide: **[docs/SETUP.md](docs/SETUP.md)**

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy environment template (never commit .env.local)
cp .env.example .env.local

# 3. Generate secrets and configure DATABASE_URL in .env.local
npm run env:secrets

# 4. Apply database migrations
npm run db:migrate

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

```bash
# Production build
npm run build && npm start

# Run test suite
npm run defence:test
```

---

## Key Intelligence Modules (30+)

| Module | Description |
|---|---|
| **Command Center** | Live global threat score, auto-correlated clusters |
| **Action Queue** | Auto-generated, prioritised analyst tasks |
| **Executive Briefings** | Daily AI-generated threat reports |
| **CVE Intelligence** | EPSS scores, KEV flags, CVSS severity |
| **Ransomware Tracker** | Active groups, victim disclosures, sector analysis |
| **IOC Lookup** | IP, domain, hash, URL reputation check |
| **Dark Web Monitor** | Ransomware blogs & forum monitoring |
| **Phishing Intelligence** | OpenPhish & PhishTank brand impersonation tracking |
| **Supply Chain Intel** | OSV.dev dependency vulnerability data |
| **GitHub Secrets** | Exposed API keys & credentials scanning |
| **Vuln Prioritization** | Composite risk scoring (CVSS + EPSS + KEV) |
| **Detection Coverage** | MITRE ATT&CK mapped to Sigma/YARA rules |
| **Relationship Graph** | Interactive actor–malware–CVE graph |
| **AI Analyst Workspace** | Natural language CTI queries across all intel |
| **Attack Surface** | Cert transparency, typosquats, secrets, phishing |

---

## Database Tables (Intel Cache)

`intel_news_cache` · `intel_cve_cache` · `intel_ransomware_groups` · `intel_ransomware_victims` · `intel_malware_cache` · `intel_mitre_groups` · `intel_mitre_techniques` · `intel_phishing_cache` · `intel_darknet_posts` · `intel_yara_rules` · `intel_feed_sync_log`

---

## Admin Access

After running migrations (`npm run db:migrate`), a default admin account is seeded.  
**Change the default password immediately** after first login.

- Admin panel: `/admin-portal` or `/admin`
- Setup details: [docs/SETUP.md#admin-account](docs/SETUP.md#admin-account)

> **Security:** Never commit `.env.local` or share API keys. See [SECURITY.md](SECURITY.md).

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | Installation, Docker, env vars, first run |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | All REST APIs (137 routes) |
| [docs/CODEBASE-DEEP-STRUCTURE.md](docs/CODEBASE-DEEP-STRUCTURE.md) | Full architecture deep-dive |
| [docs/GITHUB-PUBLISH-PLAN.md](docs/GITHUB-PUBLISH-PLAN.md) | How this repo was prepared for GitHub |

---

## License

MIT License — see [LICENSE](LICENSE). For authorized security research and educational use only.

---

> Built as a Final Year Project — designed for production SaaS quality.
