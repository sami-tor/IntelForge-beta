# Contributing to IntelForge-beta

Thank you for your interest in contributing!

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<you>/IntelForge-beta.git`
3. Follow [docs/SETUP.md](docs/SETUP.md) for local setup
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development guidelines

- Match existing code style and patterns
- Use TypeScript for frontend/API code
- Read analogous files before adding new modules
- Intelligence pages should use Server Components where possible
- Never commit secrets, `.env.local`, or real data

## Before submitting a PR

```bash
npm run build          # Must pass
npm run defence:test   # Run when possible
```

- Keep PRs focused — one feature or fix per PR
- Update documentation if you add APIs or change setup steps
- Do not include API keys, passwords, or personal data

## Code areas

| Area | Path |
|------|------|
| Frontend pages | `src/app/` |
| API routes | `src/app/api/` |
| Intel modules | `src/lib/intel/` |
| Scrapers | `scrapers/` |
| Indexer | `indexer/` |
| Migrations | `scripts/` |
| Tests | `src/tests/` |

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately — do not open public issues for security bugs.

## Questions

Open a GitHub Discussion or Issue for questions about setup, architecture, or features.
