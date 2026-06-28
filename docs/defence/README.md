# Defence Documentation Index

Everything in this folder is generated, ordered and structured for the
final-year project defence.

## Files in this folder

| File | What it is | When to use |
|------|------------|-------------|
| `INTELFORGE_FYP_DEFENCE.md` | Master reference — 14 sections + 2 appendices, every claim cited to file:line | Read this once end-to-end before defence |
| `test-cases.md` | 84 test cases across 12 suites with code references | Open when committee asks "how do you know it works?" |
| `IntelForge_FYP_Defence.pdf` | Polished printable PDF rendered from all the markdown above | Hand to the committee, attach to your report |
| `demo-script.md` | Five-minute live demo script with timings | Memorise; rehearse |
| `diagrams/01-architecture.md` | Layered system diagram | Show during architecture discussion |
| `diagrams/02-pipeline-flow.md` | End-to-end sequence diagram | Show during runtime walk-through |
| `diagrams/03-er-diagram.md` | ER diagram of the 17 automation tables | Show during DB design discussion |
| `diagrams/04-use-case.md` | Use-case diagram with code references | Show during requirements discussion |
| `diagrams/05-state-machine.md` | Action-queue state machine | Show during quality / UX discussion |
| `diagrams/06-class-diagram.md` | Module / class structure | Show during code-organisation discussion |
| `diagrams/07-deployment.md` | Deployment topology + env-var checklist | Show during ops discussion |
| `diagrams/08-correlation-engine.md` | Deep correlator v2 signal flow | Show during correlation discussion |
| `comparison.md` | Honest IntelForge vs Recorded Future / Mandiant / OTX | Show when asked "how does this compare?" |
| `correlation-deep-dive.md` | Deep correlator v2 architecture + live results | Show when asked "how deep is the correlation?" |

## How to regenerate

```bash
# 1. Run the full test suite
npm run defence:test

# 2. Re-render the PDF
npm run defence:pdf

# 3. Both at once
npm run defence:all
```

Output PDF is written to `docs/defence/IntelForge_FYP_Defence.pdf`.
The PDF builder is `scripts/build-defence-pdf.mjs` (no headless browser,
no LaTeX, no Mermaid runtime — pure PDFKit).

## Audience map

| Question type | Reach for |
|---------------|-----------|
| "What does it do?" | DEFENCE doc §1, §2, demo-script |
| "How is it built?" | DEFENCE doc §3, §4, diagrams 1-2-6 |
| "Show me the maths" | DEFENCE doc §5, code citations there |
| "Where's the data?" | DEFENCE doc §6, diagram 3 |
| "Is it correct?" | DEFENCE doc §11, test-cases.md |
| "Can it scale?" | DEFENCE doc §10, diagram 7 |
| "Who can use it?" | diagram 4 |
| "How would you change X?" | DEFENCE doc §13 + Appendix B |
