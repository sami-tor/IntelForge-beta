# IntelForge — UML & Architecture Diagrams

All diagrams are authored in PlantUML (`.puml`) and rendered to PNG
in the `images/` folder. White background, blue (#1565C0) accent
colour, clean fonts, no overlapping.

## How to re-render

```bash
# Download PlantUML jar (one-time, ~21 MB)
curl -L -o diagram/plantuml.jar https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar

# Render all diagrams
java -jar diagram/plantuml.jar -tpng -o images diagram/*.puml
```

Requires Java 17+. The jar is gitignored.

## Diagram inventory

| # | File | Type | Description |
|---|------|------|-------------|
| 01 | `01-use-case-diagram.puml` | Use Case | All actors (Free/Premium/Admin/Cron/SOC) and 34 use cases |
| 02 | `02-class-diagram.puml` | Class | Full system class structure (Frontend, Backend, Automation, ML, Storage) |
| 03 | `03-er-diagram.puml` | ER | Core database tables with relationships |
| 04 | `04-state-diagram.puml` | State Machine | User session lifecycle + Action Queue item states |
| 05 | `05-dfd-level0.puml` | DFD Level 0 | System context — external actors and data stores |
| 06 | `06-dfd-level1.puml` | DFD Level 1 | Face search process decomposition |
| 07 | `07-dfd-level2.puml` | DFD Level 2 | Automatic indexing process decomposition |
| 08 | `08-activity-diagram.puml` | Activity | **Automation pipeline (10 stages)** — the FYP contribution |
| 09 | `09-sequence-diagram.puml` | Sequence | **Automation pipeline request flow** with all participants |
| 10 | `10-wbs-diagram.puml` | WBS | Work breakdown structure (5 phases, 30+ tasks) |
| 11 | `11-software-architecture.puml` | Architecture | **Full layered architecture** including automation layer |
| 12 | `12-network-diagram.puml` | Network | Deployment topology (load balancer, clusters, services) |
| 13 | `13-gantt-chart.puml` | Gantt | 20-week project timeline |
| 14 | `14-collaboration-diagram.puml` | Collaboration | Text search interaction flow |
| 15 | `15-collaboration-automation.puml` | Collaboration | Automated data collection interaction flow |
| 16 | `16-activity-automation.puml` | Activity | Data collection + indexing process |
| 17 | `17-sequence-automation.puml` | Sequence | Data collection + indexing sequence |
| 18 | `18-database-diagram.puml` | Database | Complete schema (all packages, all tables, all relationships) |

## Design conventions

- **Background:** white (`skinparam backgroundColor white`)
- **Primary colour:** Material Blue 800 (`#1565C0`)
- **Component fill:** Light Blue 50 (`#E3F2FD`)
- **Package fill:** Grey 100 (`#F5F5F5`)
- **Database fill:** Orange 50 (`#FFF3E0`)
- **Font size:** 11pt default
- **Arrows:** solid, blue, thickness 1
- **Line type:** polyline (avoids overlapping on complex diagrams)
- **No shadows** (cleaner print output)

## Key diagrams for FYP defence

For the automation layer specifically, show these during your presentation:

1. **Diagram 08** — Activity diagram of the 10-stage pipeline
2. **Diagram 09** — Sequence diagram showing the full request flow
3. **Diagram 11** — Software architecture with the automation layer highlighted
4. **Diagram 04** — State machine for the action queue lifecycle
5. **Diagram 01** — Use case showing all actors including Cron and SOC
