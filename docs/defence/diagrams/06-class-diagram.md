# Diagram 6 — Class / Module Structure

Modules expose pure functions (TypeScript namespaces, not classes).
This diagram shows the public exports and their dependencies.

```mermaid
classDiagram
    class threatScore {
        +ThreatScoreComponents
        +ThreatScoreResult
        +computeAndPersistThreatScore() ThreatScoreResult
        +getLatestThreatScore() ThreatScoreResult
        +getThreatScoreHistory(hours) Array
        -collectComponents() ThreatScoreComponents
        -scoreFromComponents() score
        -getPreviousScore() number
    }

    class correlator {
        +CorrelationSignal
        +ClusterPayload
        +CorrelatedCluster
        +runCorrelationPass() result
        +getTopClusters(limit) Array
        -fetchAnchorCves(limit) Array
        -fetchExploitsForCves(ids) Map
        -fetchNewsForCves(ids) Map
        -scoreCluster(payload) number
        -buildSummary(payload) string
    }

    class trends {
        +TrendCaptureResult
        +TrendSeries
        +captureTrends() TrendCaptureResult
        +getTrendSeries(days) Array
        -METRICS Array
    }

    class forecast {
        +ForecastPoint
        +AnomalyPoint
        +ForecastResult
        +generateForecastsAndAnomalies(horizon) ForecastResult
        +getForecasts() Map
        +listAnomalies(limit) Array
        -loadHistory(days) Map
        -holt(values, alpha, beta)
        -forecastConfidence() number
    }

    class geoSector {
        +GeoEntry
        +SectorEntry
        +captureGeoAndSector() Result
        +getLatestGeoSnapshot(limit) Array
        +getLatestSectorSnapshot(limit) Array
        -fetchGroupedCounts() Array
        -rankToScore() number
        -toCode(country) string
    }

    class actionQueue {
        +ActionItem
        +generateActions() Result
        +listActions(status, limit) Array
        +updateActionStatus(id, status, userId)
        -upsertAction(item)
        -severityToPriority(sev, base) number
    }

    class briefingGenerator {
        +BriefingType
        +BriefingHighlight
        +GeneratedBriefing
        +generateDailyBriefing() GeneratedBriefing
        +getLatestBriefing(type) GeneratedBriefing
        +listBriefings(limit) Array
        -collectMetrics() BriefingMetrics
        -buildHeadline() string
        -buildNarrative() string
        -buildHighlights() Array
        -buildRecommendations() Array
    }

    class briefingPdf {
        +generateBriefingPdf(briefing) Buffer
        -sectionHeader(doc, label)
        -drawMetricGrid(doc, rows)
    }

    class notifications {
        +notifyBriefing(b)
        +notifyAnomalies(list)
        +notifyCriticalClusters(list)
        +listNotifications(limit) Array
        -logNotification(...)
    }

    class orchestrator {
        +AutomationRunOutput
        +runFullAutomation() AutomationRunOutput
        +getAutomationRuns(limit) Array
        -logRunStart(type) id
        -logRunEnd(id, status, duration, output)
    }

    orchestrator ..> threatScore
    orchestrator ..> correlator
    orchestrator ..> trends
    orchestrator ..> forecast
    orchestrator ..> geoSector
    orchestrator ..> actionQueue
    orchestrator ..> briefingGenerator
    orchestrator ..> notifications

    briefingGenerator ..> threatScore
    briefingGenerator ..> correlator
    briefingGenerator ..> trends

    forecast ..> trends
    actionQueue ..> correlator
    actionQueue ..> forecast
    notifications ..> briefingGenerator
```

## Boundaries

- All modules read/write through `query()` (`lib/db.ts:62-77`).
- No module calls upstream APIs at runtime.
- No module mutates global state outside Postgres.
- Each module's public surface is the `export` set; everything else
  is private to the file.
