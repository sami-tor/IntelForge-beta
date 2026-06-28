# IntelForge API Reference

Complete catalog of **custom IntelForge APIs** (Next.js App Router), **internal microservices**, and **external third-party APIs** used by the platform.

**Base URL (dev):** `http://localhost:3000`  
**OpenAPI spec:** `GET /api/openapi.json` (automation subset)  
**Swagger UI:** `/api-docs`

---

## Table of Contents

1. [Authentication & Security](#authentication--security)
2. [Health & System](#health--system)
3. [Search APIs](#search-apis)
4. [Intelligence Hub APIs](#intelligence-hub-apis)
5. [Automation Pipeline APIs](#automation-pipeline-apis)
6. [User APIs](#user-apis)
7. [Admin APIs](#admin-apis)
8. [Organizations & Multi-Tenancy](#organizations--multi-tenancy)
9. [Integrations](#integrations)
10. [Cases, Reports & Archive](#cases-reports--archive)
11. [Face & Visual Search](#face--visual-search)
12. [Cron / Scheduler APIs](#cron--scheduler-apis)
13. [Public & Misc APIs](#public--misc-apis)
14. [Internal Microservices](#internal-microservices)
15. [External Third-Party APIs](#external-third-party-apis)
16. [Threat Intel Feed Sources](#threat-intel-feed-sources)
17. [Environment Variables](#environment-variables)

---

## Authentication & Security

Most protected routes use a **`session_token` HTTP-only cookie** set on login/register. Mutations often require a **CSRF token** from `GET /api/auth/me` (`csrfToken` field or `X-CSRF-Token` header).

API key access for search: `Authorization: Bearer <api_key>` or `X-API-Key` header (see dashboard API key management).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Public | Create account (username, email, password) |
| `POST` | `/api/auth/login` | Public | Email/password login; sets session cookie |
| `POST` | `/api/auth/admin-login` | Public | Admin panel login (admin role only) |
| `GET` | `/api/auth/me` | Session | Current user profile + CSRF token |
| `POST` | `/api/auth/logout` | Session | End session |
| `GET` | `/api/auth/logout` | Session | Logout (GET alias) |
| `POST` | `/api/auth/refresh` | Session | Refresh session token |
| `GET` | `/api/auth/refresh` | Session | Refresh status |
| `GET` | `/api/auth/google/callback` | OAuth | Google OAuth callback; redirects to dashboard |
| `POST` | `/api/auth/2fa/setup` | Session | Initialize 2FA (TOTP) |
| `POST` | `/api/auth/2fa/verify` | Session | Verify 2FA setup code |
| `POST` | `/api/auth/2fa/verify-login` | Pending 2FA | Complete login after 2FA challenge |
| `POST` | `/api/auth/2fa/disable` | Session | Disable 2FA |
| `GET` | `/api/anonymous-session` | Public | Guest session for limited search |
| `POST` | `/api/anonymous-session` | Public | Create guest session |

**External OAuth used:**

| Service | URL |
|---------|-----|
| Google OAuth authorize | `https://accounts.google.com/o/oauth2/v2/auth` |
| Google token exchange | `https://oauth2.googleapis.com/token` |
| Google user info | `https://www.googleapis.com/oauth2/v2/userinfo` |

---

## Health & System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | Public | App health (DB, memory, Quickwit, visual search) |
| `GET` | `/api/admin/health` | Admin | Extended admin health dashboard |
| `GET` | `/api/openapi.json` | Public | OpenAPI 3.1 spec (automation APIs) |

---

## Search APIs

Core OSINT search over PostgreSQL + Quickwit + intel enrichment.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/search` | Session / API key / Guest | Main text search (`q`, `type`, `limit`) |
| `GET` | `/api/search/stream` | Session / API key / Guest | SSE streaming search results |
| `GET` | `/api/search/export` | Session | Export search results |
| `POST` | `/api/search/ai-analysis` | Session | AI analysis of search results (user LLM settings) |
| `POST` | `/api/file-search` | Session | Search local indexed data files on disk |
| `GET` | `/api/file-preview` | Session | Preview file/archive content (Quickwit-backed) |
| `POST` | `/api/process-zip` | Session | Process uploaded ZIP archives |

**Guest mode:** Unauthenticated users get up to 8 public-intel results via `/api/search` and `/api/search/stream`.

---

## Intelligence Hub APIs

Read-heavy CTI modules. Most are `GET` with query params (`q`, `limit`, filters). Data is cached in PostgreSQL from background fetchers.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/intel/stats` | Hub statistics (CVEs, actors, records) |
| `GET` | `/api/intel/cve` | CVE lookup and listing |
| `GET` | `/api/intel/ioc` | IOC lookup |
| `POST` | `/api/intel/ioc` | Bulk IOC enrichment |
| `GET` | `/api/intel/malware` | Malware intelligence |
| `GET` | `/api/intel/ransomware` | Ransomware groups & victims |
| `GET` | `/api/intel/threat-actors` | Threat actor profiles |
| `GET` | `/api/intel/apt-campaigns` | APT campaign data |
| `GET` | `/api/intel/attack-patterns` | MITRE ATT&CK patterns |
| `GET` | `/api/intel/exploits` | Exploit-DB data |
| `GET` | `/api/intel/phishing` | Phishing URL feeds |
| `GET` | `/api/intel/cert-transparency` | Certificate transparency (crt.sh) |
| `GET` | `/api/intel/supply-chain` | Supply chain / OSV vulnerabilities |
| `GET` | `/api/intel/sigma` | Sigma detection rules |
| `GET` | `/api/intel/yara` | YARA rules |
| `POST` | `/api/intel/yara` | Submit/custom YARA query |
| `GET` | `/api/intel/github-secrets` | GitHub secret scanning patterns |
| `GET` | `/api/intel/typosquatting` | Typosquatting domain check |
| `GET` | `/api/intel/darknet` | Dark web / ransomware monitor data |
| `GET` | `/api/intel/news` | Aggregated security news |
| `GET` | `/api/intel/correlate` | Cross-source IOC correlation |
| `GET` | `/api/intel/relationships` | Entity relationships |
| `GET` | `/api/intel/relationship-graph` | Graph data for visualization |
| `GET` | `/api/intel/entity` | Entity detail lookup |
| `GET` | `/api/intel/actor-report` | Threat actor report |
| `GET` | `/api/intel/actor-relationships` | Actor-to-actor links |
| `GET` | `/api/intel/attack-surface` | Domain attack surface (`domain` param) |
| `GET` | `/api/intel/deep-search` | Full-text search via Quickwit |
| `GET` | `/api/intel/feed-health` | Feed ingestion health |
| `GET` | `/api/intel/detection-coverage` | Detection rule coverage |
| `GET` | `/api/intel/vuln-prioritize` | Vulnerability prioritization (EPSS/KEV) |
| `POST` | `/api/intel/risk-profiler` | Risk scoring for entities |
| `POST` | `/api/intel/bulk-ioc` | Bulk IOC import/analysis |
| `POST` | `/api/intel/ai-analyst` | Evidence-backed AI CTI Q&A |
| `GET` | `/api/intel/watchlists` | User watchlists |
| `POST` | `/api/intel/watchlists` | Add watchlist entry |
| `DELETE` | `/api/intel/watchlists` | Remove watchlist entry (`id` param) |
| `GET` | `/api/intel/investigations` | Investigation cases |
| `POST` | `/api/intel/investigations` | Create investigation |
| `PATCH` | `/api/intel/investigations` | Update investigation |
| `DELETE` | `/api/intel/investigations` | Delete investigation |
| `GET` | `/api/intel/normalize` | IOC normalization preview |
| `POST` | `/api/intel/normalize` | Normalize IOC batch |

---

## Automation Pipeline APIs

Cron-driven threat scoring, clusters, forecasts, and action queue. Documented in OpenAPI at `/api/openapi.json`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/intel/automation/status` | Public | Threat score, clusters, briefing snapshot |
| `GET` | `/api/intel/automation/forecasts` | Public | 7-day forecasts & anomalies |
| `GET` | `/api/intel/automation/geo` | Public | Geographic/sector risk |
| `GET` | `/api/intel/automation/briefings` | Public | Executive briefings |
| `GET` | `/api/intel/automation/briefings/export` | Public | Export briefing (PDF/markdown) |
| `GET` | `/api/intel/automation/clusters` | Public | Correlation clusters |
| `GET` | `/api/intel/automation/stream` | Public | SSE automation event stream |
| `GET` | `/api/intel/automation/forecast-accuracy` | Public | Forecast accuracy metrics |
| `GET` | `/api/intel/automation/actions` | Public | Action queue list |
| `PATCH` | `/api/intel/automation/actions` | Session | Update action status |
| `PATCH` | `/api/intel/automation/actions/bulk` | Session | Bulk action updates |
| `GET` | `/api/intel/automation/actions/{id}/comments` | Public | Action comments & audit |
| `POST` | `/api/intel/automation/actions/{id}/comments` | Session | Add comment |
| `PATCH` | `/api/intel/automation/actions/{id}/assign` | Session | Assign action to user |
| `POST` | `/api/intel/automation/hunt` | Session | Trigger threat hunt query |

**Admin automation:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/automation` | Admin | Automation config |
| `POST` | `/api/admin/automation` | Admin | Update automation config |
| `GET` | `/api/admin/automation/runs` | Admin | Pipeline run history |
| `GET` | `/api/admin/automation/run` | Admin | Run status |
| `POST` | `/api/admin/automation/run` | Admin | Trigger manual run |

---

## User APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/user/profile` | Session | User profile |
| `PATCH` | `/api/user/profile` | Session + CSRF | Update email/username |
| `PUT` | `/api/user/profile` | Session + CSRF | Change password |
| `GET` | `/api/user/search-history` | Session | Recent searches |
| `GET` | `/api/user/login-activity` | Session | Login history |
| `GET` | `/api/user/quota` | Session | Search quota usage |
| `GET` | `/api/user/api-keys` | Session | List API keys |
| `POST` | `/api/user/api-keys` | Session + CSRF | Create API key |
| `DELETE` | `/api/user/api-keys` | Session + CSRF | Revoke API key (`id`) |
| `GET` | `/api/user/ai-settings` | Session | LLM provider settings |
| `POST` | `/api/user/ai-settings` | Session + CSRF | Save AI provider config |
| `DELETE` | `/api/user/ai-settings` | Session | Clear AI settings |
| `GET` | `/api/user/monitoring` | Session | Breach monitors & alerts |
| `POST` | `/api/user/monitoring` | Session | Create monitor |
| `PUT` | `/api/user/monitoring` | Session | Update monitor |
| `DELETE` | `/api/user/monitoring` | Session | Delete monitor |
| `POST` | `/api/user/monitoring/check` | Session / Cron | Run monitor check |
| `POST` | `/api/user/monitoring/resend` | Session | Resend verification email |

---

## Admin APIs

All require **admin** role unless noted.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Platform statistics |
| `GET` | `/api/admin/users` | User management list |
| `PUT` | `/api/admin/users` | Update user (role, status) |
| `DELETE` | `/api/admin/users` | Delete/deactivate user |
| `PUT` | `/api/admin/user-subscription` | Set user subscription |
| `GET` | `/api/admin/subscriptions` | Subscription plans |
| `POST` | `/api/admin/subscriptions` | Create plan |
| `PUT` | `/api/admin/subscriptions` | Update plan |
| `DELETE` | `/api/admin/subscriptions` | Delete plan |
| `GET` | `/api/admin/settings` | System settings |
| `PUT` | `/api/admin/settings` | Update settings |
| `POST` | `/api/admin/settings/test-smtp` | Test SMTP configuration |
| `GET` | `/api/admin/audit-logs` | Security audit logs |
| `POST` | `/api/admin/audit-logs` | Write audit entry |
| `GET` | `/api/admin/search-logs` | Search activity logs |
| `GET` | `/api/admin/contact` | Contact form submissions |
| `PUT` | `/api/admin/contact` | Mark contact read/replied |
| `DELETE` | `/api/admin/contact` | Delete submission |
| `GET` | `/api/admin/api-keys` | All platform API keys |
| `POST` | `/api/admin/api-keys` | Create admin API key |
| `DELETE` | `/api/admin/api-keys/{id}` | Revoke key |
| `GET` | `/api/admin/data-sources` | Data source registry |
| `POST` | `/api/admin/data-sources` | Add data source |
| `PATCH` | `/api/admin/data-sources` | Update source |
| `DELETE` | `/api/admin/data-sources` | Remove source |
| `GET` | `/api/admin/intel-sources` | Intel feed source config |
| `POST` | `/api/admin/intel-sources` | Add intel source |
| `PATCH` | `/api/admin/intel-sources` | Toggle/configure source |
| `DELETE` | `/api/admin/intel-sources` | Remove source |
| `GET` | `/api/admin/darkweb-sources` | Dark web crawler sources |
| `POST` | `/api/admin/darkweb-sources` | Add dark web source |
| `PATCH` | `/api/admin/darkweb-sources` | Update source |
| `DELETE` | `/api/admin/darkweb-sources` | Remove source |
| `GET` | `/api/admin/directories` | Indexed directory paths |
| `POST` | `/api/admin/directories` | Add directory |
| `PATCH` | `/api/admin/directories` | Update directory |
| `DELETE` | `/api/admin/directories` | Remove directory |
| `GET` | `/api/admin/indexing-progress` | Indexer progress |
| `GET` | `/api/admin/deletion-requests` | GDPR/data deletion queue |
| `POST` | `/api/admin/deletion-requests` | Submit deletion request |
| `PUT` | `/api/admin/deletion-requests` | Approve/reject request |
| `GET` | `/api/admin/demo-corpus` | Demo search corpus |
| `POST` | `/api/admin/demo-corpus` | Ingest demo documents |
| `DELETE` | `/api/admin/demo-corpus` | Clear demo corpus |
| `GET` | `/api/admin/resellers` | Reseller accounts |
| `GET` | `/api/admin/security/ip-policies` | IP allow/block policies |
| `PUT` | `/api/admin/security/ip-policies` | Update IP policy |
| `DELETE` | `/api/admin/security/ip-policies` | Remove policy |
| `GET` | `/api/admin/security/login-activity` | Platform login activity |
| `DELETE` | `/api/admin/security/login-activity` | Purge login logs |

---

## Organizations & Multi-Tenancy

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/organizations` | Session | List user's organizations |
| `POST` | `/api/organizations` | Session | Create organization |
| `GET` | `/api/organizations/{id}` | Session | Organization detail |
| `PATCH` | `/api/organizations/{id}` | Session | Update organization |
| `DELETE` | `/api/organizations/{id}` | Session | Delete organization |
| `GET` | `/api/organizations/{id}/members` | Session | List members |
| `POST` | `/api/organizations/{id}/members` | Session | Invite/add member |
| `PATCH` | `/api/organizations/{id}/members` | Session | Change member role |
| `DELETE` | `/api/organizations/{id}/members` | Session | Remove member |
| `POST` | `/api/organizations/switch` | Session | Switch active org context |
| `POST` | `/api/organizations/invites/accept` | Session | Accept org invite |
| `GET` | `/api/tenant/branding` | Session | White-label branding |
| `POST` | `/api/tenant/branding` | Session | Update branding |
| `POST` | `/api/tenant/domain` | Session | Custom domain setup |
| `GET` | `/api/reseller/dashboard` | Reseller | Reseller dashboard stats |
| `GET` | `/api/reseller/clients` | Reseller | Client list |
| `POST` | `/api/reseller/clients` | Reseller | Add client |
| `PATCH` | `/api/reseller/clients` | Reseller | Update client |

---

## Integrations

User-configured outbound integrations. Each stores config in `integration_configs` table.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/integrations/webhooks` | Session | List webhooks |
| `POST` | `/api/integrations/webhooks` | Session | Create webhook |
| `GET` | `/api/integrations/webhooks/{id}` | Session | Webhook detail |
| `PATCH` | `/api/integrations/webhooks/{id}` | Session | Update webhook |
| `DELETE` | `/api/integrations/webhooks/{id}` | Session | Delete webhook |
| `POST` | `/api/integrations/webhooks/{id}` | Session | Test/trigger webhook |
| `GET` | `/api/integrations/misp` | Session | MISP config |
| `POST` | `/api/integrations/misp` | Session | Save/test/push to MISP |
| `GET` | `/api/integrations/siem` | Session | SIEM config |
| `POST` | `/api/integrations/siem` | Session | Save/test SIEM integration |
| `GET` | `/api/integrations/notifications` | Session | Slack/Teams config |
| `POST` | `/api/integrations/notifications` | Session | Save/test notifications |
| `GET` | `/api/integrations/marketplace` | Public | Available integration catalog |

**Outbound targets (user-provided URLs):**

- MISP instance REST API (`/events`, `/attributes`, etc.)
- SIEM endpoints (Splunk HEC, Elasticsearch, etc.)
- Slack incoming webhooks
- Microsoft Teams incoming webhooks
- Custom user webhooks (signed payloads)

---

## Cases, Reports & Archive

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/cases` | Session | List investigation cases |
| `POST` | `/api/cases` | Session | Create case |
| `GET` | `/api/cases/{id}` | Session | Case detail |
| `PATCH` | `/api/cases/{id}` | Session | Update case |
| `GET` | `/api/reports` | Session | Generated reports |
| `POST` | `/api/reports` | Session | Generate report |
| `GET` | `/api/archive/explore` | Session | Browse archive file tree (`path`) |

---

## Face & Visual Search

Proxies to the Python **Visual Search Service** (`VISUAL_SEARCH_SERVICE_URL`, default `http://localhost:8000`).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/search/face` | Session | Face search (image URL or upload) |
| `POST` | `/api/search/face` | Session | Face search with image body |
| `POST` | `/api/search/face/analyze` | Session | Face detection/analysis only |
| `POST` | `/api/search/face/bulk` | Session | Bulk face search |
| `POST` | `/api/search/face/export` | Session | Export face search results |
| `GET` | `/api/search/face/history` | Session | Face search history |
| `DELETE` | `/api/search/face/history` | Session | Clear history |
| `GET` | `/api/search/visual` | Session | Visual similarity search |
| `POST` | `/api/search/visual` | Session | Visual search with image |
| `GET` | `/api/face/identities` | Session | Face identity dossiers |
| `POST` | `/api/face/identities` | Session | Create identity |
| `PATCH` | `/api/face/identities` | Session | Update identity |
| `DELETE` | `/api/face/identities` | Session | Delete identity (`id`) |
| `POST` | `/api/face/identities/merge` | Session | Merge two identities |

---

## Cron / Scheduler APIs

Protected by **`Authorization: Bearer <CRON_SECRET>`** header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/intel` | Trigger intel feed sync (GET for simple cron) |
| `POST` | `/api/cron/intel` | Intel feed sync |
| `POST` | `/api/cron/intel-sync` | Advanced intel sync pipeline |
| `GET` | `/api/cron/automation` | Run automation pipeline |
| `POST` | `/api/cron/automation` | Run automation pipeline |
| `GET` | `/api/cron/monitoring` | Run breach monitor checks |
| `POST` | `/api/cron/monitoring` | Run breach monitor checks |

---

## Public & Misc APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/news` | Public | Published news articles |
| `POST` | `/api/news` | Admin | Create news article |
| `DELETE` | `/api/news` | Admin | Delete article |
| `POST` | `/api/contact` | Public | Contact form submission |
| `GET` | `/api/example` | Session | Example/template endpoint (remove in prod) |
| `POST` | `/api/example` | Session | Example POST handler |

---

## Internal Microservices

Services run alongside the Next.js app (Docker Compose or local).

### Quickwit (full-text search)

| Variable | Default |
|----------|---------|
| `QUICKWIT_URL` | `http://localhost:7280` |

| Method | Endpoint | Used by |
|--------|----------|---------|
| `GET` | `/api/v1/health` | `/api/health` |
| `POST` | `/api/v1/{index}/search` | Search, deep-search, face, visual, export |
| `POST` | `/api/v1/{index}/ingest` | Admin demo corpus |

**Indexes:** `osint-data`, `osint-data-images`, `threads-profiles`

### Visual Search Service (Python FastAPI)

| Variable | Default |
|----------|---------|
| `VISUAL_SEARCH_SERVICE_URL` | `http://localhost:8000` |
| `VISUAL_SEARCH_API_KEY` | Optional internal auth header |
| `NEXT_PUBLIC_VISUAL_SEARCH_URL` | Public health check URL |

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health |
| `POST` | `/process-image` | Index/process image |
| `POST` | `/search-similar` | Visual similarity |
| `POST` | `/search-faces` | Face similarity |
| `POST` | `/api/search/image` | Image search API |
| `POST` | `/api/search/face` | Face search API |
| `GET` | `/collections` | Milvus collection info |
| `POST` | `/threads/scrape` | Threads profile scrape trigger |

### Milvus (vector DB)

| Variable | Default |
|----------|---------|
| `MILVUS_HOST` | `localhost` |
| `MILVUS_PORT` | `19530` |

Used by image indexer for face/image embeddings (not directly exposed as HTTP from Next.js).

### MinIO (object storage)

| Variable | Default |
|----------|---------|
| `MINIO_ENDPOINT` | `localhost:9000` |
| `MINIO_PUBLIC_URL` | `http://localhost:9000/intelforge-images` |

Stores image thumbnails and face crops.

### Qdrant (legacy vector search)

| Variable | Default |
|----------|---------|
| `QDRANT_URL` | `http://localhost:6333` |

Fallback collection: `intelforge-images` (used in visual search route).

### Go Search API (indexer)

| Variable | Default |
|----------|---------|
| `SEARCH_API_ADDR` | `:8090` |

| Method | Endpoint | Status |
|--------|----------|--------|
| `GET` | `/healthz` | Health check |
| `GET` | `/search` | Placeholder (501 Not Implemented) |

### OpenSearch (optional file index)

| Variable | Default |
|----------|---------|
| `OPENSEARCH_URL` | `http://127.0.0.1:9200` |
| `OPENSEARCH_INDEX` | `file_index` |

Used by Go/Python indexer for line-level file search (not directly called from most Next.js routes).

### PostgreSQL

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Primary application database |

---

## External Third-Party APIs

APIs called by IntelForge fetchers and enrichment modules. Optional keys unlock more data (see `.env.example`).

### IOC Enrichment (optional API keys)

| Service | Base URL | Env var | Free tier |
|---------|----------|---------|-----------|
| Shodan InternetDB | `https://internetdb.shodan.io/{ip}` | — | No key required |
| AbuseIPDB | `https://api.abuseipdb.com/api/v2/check` | `ABUSEIPDB_API_KEY` | 1000/day |
| GreyNoise Community | `https://api.greynoise.io/v3/community/{ip}` | `GREYNOISE_API_KEY` | Free tier |
| VirusTotal v3 | `https://www.virustotal.com/api/v3/` | `VIRUSTOTAL_API_KEY` | 500/day |
| AlienVault OTX | `https://otx.alienvault.com/api/v1/` | `OTX_API_KEY` | Free |
| Hybrid Analysis | — | `HYBRID_API_KEY` | Free signup |
| Have I Been Pwned | — | `HIBP_API_KEY` | Paid |

### abuse.ch Platform (free, no key)

| Service | URL |
|---------|-----|
| MalwareBazaar API | `https://mb-api.abuse.ch/api/v1/` |
| URLhaus API | `https://urlhaus-api.abuse.ch/v1/` |
| ThreatFox API | `https://threatfox-api.abuse.ch/api/v1/` |
| Feodo Tracker | `https://feodotracker.abuse.ch/downloads/ipblocklist.json` |
| SSL Blacklist | `https://sslbl.abuse.ch/blacklist/sslipblacklist.txt` |

### Vulnerability & Exploit Intel

| Service | URL | Notes |
|---------|-----|-------|
| NVD API v2 | `https://services.nvd.nist.gov/rest/json/cves/2.0` | Free, rate-limited |
| CISA KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Free JSON feed |
| EPSS | `https://api.first.org/data/v1/epss` | Free |
| OSV (supply chain) | `https://api.osv.dev/v1` | Free |
| Exploit-DB | `https://exploit-db.com` + GitHub CSV | Free |
| crt.sh (CT logs) | `https://crt.sh` | Free |

### Threat Actor & Ransomware

| Service | URL |
|---------|-----|
| Ransomware.live v2 | `https://api.ransomware.live/v2` |
| Ransomwatch (GitHub) | `https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json` |
| MITRE ATT&CK CTI | `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json` |

### GitHub APIs

| Service | URL | Env var |
|---------|-----|---------|
| GitHub REST | `https://api.github.com` | `GITHUB_TOKEN` (higher rate limits) |
| SigmaHQ rules | `https://api.github.com/repos/SigmaHQ/sigma` | — |
| YARA rules (various repos) | `https://api.github.com/repos/{owner}/{repo}/contents/` | — |
| ExploitDB CSV | `https://raw.githubusercontent.com/offensive-security/exploitdb/master/files_exploits.csv` | — |

### Phishing Feeds

| Service | URL |
|---------|-----|
| OpenPhish | `https://openphish.com/feed.txt` |
| PhishTank | `https://data.phishtank.com/data/online-valid.json` |

### DNS

| Service | URL |
|---------|-----|
| Google DNS JSON | `https://dns.google/resolve` |

### LLM Providers (user-configured per account)

Used by AI Analyst, search analysis, and automation briefings.

| Provider | Default base URL |
|----------|------------------|
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Custom | User-provided OpenAI-compatible URL |

Users store provider API keys in `/api/user/ai-settings` (encrypted at rest).

### SMTP (email)

Configured via admin settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

Used for: monitoring alerts, contact form notifications, verification emails.

---

## Threat Intel Feed Sources

RSS/TXT/JSON feeds ingested by cron (`/api/cron/intel`). Grouped by fetcher module.

### Security News (`src/lib/intel/fetchers/news.ts`)

40+ RSS feeds including: BleepingComputer, The Hacker News, Krebs on Security, CISA advisories, Dark Reading, SecurityWeek, The Record, Talos, Mandiant, Microsoft Security, Google TAG, Unit 42, CrowdStrike, Elastic, Trend Micro, Check Point, Zscaler, and more.

### CERT Advisories (`cert-advisories.ts`)

CERT-FR, CERT-EU, UK NCSC, ICS-CERT, BSI Germany, ENISA, SANS ISC, NIST NVD RSS.

### Vendor Blogs (`vendor-blogs.ts`)

Fortinet, Sophos X-Ops, Volexity, ReversingLabs, Huntress, Rapid7, Qualys, Dragos, Flashpoint, Recorded Future.

### IP Blocklists (`ip-blocklists.ts`)

Blocklist.de, FireHOL L1/L2, Emerging Threats, Tor exit nodes, Spamhaus DROP/EDROP, DShield, CI Army, Feodo Tracker, Binary Defense, SSL Blacklist.

### Domain Blocklists (`domain-blocklists.ts`)

URLhaus, OpenPhish, Phishing.Database, Disconnect malvertising, NoCoin cryptojacking, ThreatFox CSV.

---

## Environment Variables

Quick reference for API-related configuration (from `.env.example`):

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=
RESPONSE_SIGNING_SECRET=
CRON_SECRET=

# Search infrastructure
QUICKWIT_URL=http://localhost:7280
VISUAL_SEARCH_SERVICE_URL=http://localhost:8000
VISUAL_SEARCH_API_KEY=
QDRANT_URL=http://localhost:6333
OPENSEARCH_URL=http://127.0.0.1:9200

# Vector / object storage
MILVUS_HOST=localhost
MILVUS_PORT=19530
MINIO_ENDPOINT=localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000/intelforge-images

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional enrichment keys
VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=
GREYNOISE_API_KEY=
OTX_API_KEY=
HYBRID_API_KEY=
HIBP_API_KEY=
GITHUB_TOKEN=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

---

## API Count Summary

| Category | Routes |
|----------|--------|
| Custom Next.js API routes | **137** |
| Visual Search Service (Python) | **8** |
| Quickwit REST | **3+** (per index) |
| Go Search API | **2** (1 placeholder) |
| External enrichment APIs | **30+** services |
| RSS/feed sources | **80+** feeds |

---

## Related Documentation

- Architecture overview: `docs/CODEBASE-DEEP-STRUCTURE.md`
- Interactive API docs: `http://localhost:3000/api-docs`
- Machine-readable spec: `http://localhost:3000/api/openapi.json`

---

*Generated from codebase scan. Last updated: June 2026.*
