# IntelForge Documentation

> Public documentation for **IntelForge-beta** — Cyber Threat Intelligence OSINT platform.

## Quick links

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Installation & configuration |
| [API-REFERENCE.md](API-REFERENCE.md) | All REST APIs (137 routes) |
| [CODEBASE-DEEP-STRUCTURE.md](CODEBASE-DEEP-STRUCTURE.md) | Full architecture deep-dive |
| [GITHUB-PUBLISH-PLAN.md](GITHUB-PUBLISH-PLAN.md) | GitHub release checklist |

## Folder structure

```
docs/
├── README.md
├── SETUP.md
├── API-REFERENCE.md
├── CODEBASE-DEEP-STRUCTURE.md
└── GITHUB-PUBLISH-PLAN.md
```

## Architecture diagrams

PlantUML source diagrams live in the root `diagram/` folder. Render with:

```bash
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1
```

## Tests

```bash
npm run defence:test
```
