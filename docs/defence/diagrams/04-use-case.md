# Diagram 4 — Use Case

```mermaid
flowchart TB
    Analyst((Analyst))
    Admin((Admin))
    SOC((SOC tool / SIEM))
    System((Cron scheduler))

    UC1[View live threat posture]
    UC2[Read today's briefing]
    UC3[Download briefing as PDF]
    UC4[Manage action queue]
    UC5[Subscribe to live SSE stream]
    UC6[Trigger pipeline manually]
    UC7[Inspect run history]
    UC8[Manage feed-sync sources]
    UC9[Receive webhook alerts]
    UC10[Run scheduled pipeline]

    Analyst --> UC1
    Analyst --> UC2
    Analyst --> UC3
    Analyst --> UC4
    Analyst --> UC5

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8

    SOC --> UC9

    System --> UC10
```

## Use-case → Code reference

| Use case | Page / endpoint | File |
|----------|-----------------|------|
| UC1 View live posture | `/intelligence/command-center` | `app/intelligence/command-center/page.tsx:68-580` |
| UC2 Read briefing | `/intelligence/briefings` | `app/intelligence/briefings/page.tsx:31-135` |
| UC3 Download PDF | `GET /api/intel/automation/briefings/export` | `app/api/intel/automation/briefings/export/route.ts:11-34` |
| UC4 Manage queue | `/intelligence/action-queue` + `PATCH /api/intel/automation/actions` | `app/intelligence/action-queue/page.tsx:69-326` |
| UC5 SSE stream | `GET /api/intel/automation/stream` | `app/api/intel/automation/stream/route.ts:13-65` |
| UC6 Manual run | `POST /api/admin/automation/run` | `app/api/admin/automation/run/route.ts:14-22` |
| UC7 Run history | `GET /api/admin/automation/run` | `app/api/admin/automation/run/route.ts:30-37` |
| UC8 Feed-sync triggers | `POST /api/admin/automation` | `app/api/admin/automation/route.ts:55-83` |
| UC9 Webhooks | dispatch via | `lib/intel/automation/notifications.ts:42-118` |
| UC10 Scheduled cron | `POST /api/cron/automation` | `app/api/cron/automation/route.ts:46` |
