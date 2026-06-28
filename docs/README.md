# IntelForge Documentation

> Public documentation for **IntelForge-beta** — Cyber Threat Intelligence OSINT platform.

## Quick links

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Installation & configuration |
| [API-REFERENCE.md](API-REFERENCE.md) | All REST APIs (137 routes) |
| [CODEBASE-DEEP-STRUCTURE.md](CODEBASE-DEEP-STRUCTURE.md) | Full architecture deep-dive |
| [GITHUB-PUBLISH-PLAN.md](GITHUB-PUBLISH-PLAN.md) | GitHub release checklist |
| [defence/](defence/) | FYP defence materials |

> **Note:** `FYP_Docs/` (academic reports with personal info) is excluded from the public repository.

## Folder Structure

```
docs/
├── README.md              This file — documentation index
├── SETUP.md               Installation guide
├── API-REFERENCE.md       Complete API catalog
├── CODEBASE-DEEP-STRUCTURE.md
├── GITHUB-PUBLISH-PLAN.md
│
├── defence/               FYP defence materials
│   ├── INTELFORGE_FYP_DEFENCE.md    Master defence document (14 sections)
│   ├── FYP_VIVA_QA.md               VIVA preparation Q&A
│   ├── FYP_VIVA_200_QA.md           Extended 200 Q&A bank
│   ├── comparison.md                vs Recorded Future / Mandiant / OTX
│   ├── correlation-deep-dive.md     Deep correlator v2 architecture
│   ├── demo-script.md               Live demo script with timings
│   ├── test-cases.md                84 test cases across 12 suites
│   ├── IntelForge_FYP_Defence.pdf   Print-ready PDF version
│   └── diagrams/                    Pre-rendered architecture diagrams
│
├── FYP_Docs/              Academic project documents
│   ├── FYP-II-report-template-2025.docx   Report template
│   ├── SRS_Section2_Overall_Description.md
│   ├── SOFTWARE_REENGINEERING_REPORT_PART1.md
│   ├── SOFTWARE_REENGINEERING_REPORT_PART2.md
│   ├── FYP_Report_Structure_Explanation.md
│   ├── Intel_Forge_Gantt_Chart_Hierarchical.csv
│   ├── Intel_Forge_Project_Gantt_Chart.xlsx
│   ├── questions.txt / answers2.txt           Q&A prep
│   ├── problem_statement*.txt                 Problem statements
│   ├── Markdown to PDF.pdf                    Markdown rendering guide
│   └── tools/                                 Utility scripts
│       ├── convert_diagrams.py                PlantUML → image converter
│       ├── create_gantt_*.py                  Gantt chart generators
│       └── create_presentation.py             PPTX generator
│
└── Presentations/         Project presentation materials
    ├── Intel_Forge_CTI_OSINT_Presentation.pptx
    ├── Intel_Forge_FYP_Presentation.pptx
    ├── Intel_Forge_FYP_Presentation_v2.pptx
    ├── PRESENTATION.md                          Speaker notes
    └── Sample 1 (FYP-II Presentation 15_AQI Predictor).pptx
```

## Rebuild Defence Documents

```bash
# Run all tests
npm run defence:test

# Regenerate PDF
npm run defence:pdf

# Both at once
npm run defence:all
```

## Architecture Diagrams

All 21 PlantUML diagrams are in the root `diagram/` folder:

| # | Diagram | Use During |
|---|---|---|
| 01 | Use Case | Requirements discussion |
| 02 | Class | Code organisation |
| 03 | ER Diagram | Database design |
| 04 | State Machine | Action queue logic |
| 05-07 | DFD Level 0-2 | Data flow walkthrough |
| 08 | Activity Diagram | Key workflows |
| 09 | Sequence | Runtime interactions |
| 10 | WBS | Project planning |
| 11 | Software Architecture | System layers |
| 12 | Network | Deployment topology |
| 13 | Gantt Chart | Project timeline |
| 14-17 | Collaboration/Activity/Sequence (Automation) | Automation engine |
| 18 | Database Diagram | 17 automation tables |
| 19 | Component | Module boundaries |
| 20 | Deployment | Infrastructure topology |
| 21 | Package | Code package layout |
| 22 | DFD Automation | Automation data flows |
| 23 | Threat Model | Security design |

Diagrams can be re-rendered using:
```bash
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1
```
