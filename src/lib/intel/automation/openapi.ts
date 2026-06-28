// ================================================
// IntelForge Automation - OpenAPI 3.1 spec
// ------------------------------------------------
// Hand-written for accuracy and zero runtime cost.
// Mounted at /api/openapi.json. Swagger UI at /api-docs.
// ================================================

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "IntelForge Automation API",
      version: "1.0.0",
      description:
        "Cron-driven automation pipeline that produces threat scores, " +
        "correlation clusters, forecasts, anomalies, action queue items " +
        "and executive briefings from cached intelligence feeds.",
      license: { name: "Proprietary" },
    },
    servers: [{ url: "/", description: "Current host" }],
    tags: [
      { name: "Public", description: "Read-only endpoints, served from local cache" },
      { name: "Auth", description: "Authenticated mutations" },
      { name: "Admin", description: "Admin-only" },
      { name: "Cron", description: "Scheduler-only (CRON_SECRET)" },
    ],
    components: {
      securitySchemes: {
        cronBearer: { type: "http", scheme: "bearer", bearerFormat: "CRON_SECRET" },
        sessionCookie: { type: "apiKey", in: "cookie", name: "access_token" },
      },
      schemas: {
        ThreatScore: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100 },
            severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
            delta24h: { type: "integer" },
            components: { type: "object" },
            drivers: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  } as const
}


const PATHS = {
  "/api/intel/automation/status": {
    get: {
      tags: ["Public"],
      summary: "Latest threat score, history, clusters, trends, briefing",
      responses: {
        "200": {
          description: "Snapshot",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/api/intel/automation/forecasts": {
    get: {
      tags: ["Public"],
      summary: "7-day forecasts and recent anomalies",
      responses: { "200": { description: "OK" } },
    },
  },
  "/api/intel/automation/geo": {
    get: {
      tags: ["Public"],
      summary: "Geographic + sector risk snapshots",
      responses: { "200": { description: "OK" } },
    },
  },
  "/api/intel/automation/actions": {
    get: {
      tags: ["Public"],
      summary: "List action queue items",
      parameters: [
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["open", "in_progress", "done", "all"],
          },
        },
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "category", in: "query", schema: { type: "string" } },
        { name: "severity", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200 } },
      ],
      responses: { "200": { description: "OK" } },
    },
    patch: {
      tags: ["Auth"],
      summary: "Update action status",
      security: [{ sessionCookie: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["id", "status"],
              properties: {
                id: { type: "integer" },
                status: { type: "string", enum: ["open", "in_progress", "done", "dismissed"] },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Updated" },
        "401": { description: "Unauthorised" },
      },
    },
  },
  "/api/intel/automation/actions/bulk": {
    patch: {
      tags: ["Auth"],
      summary: "Bulk update action status",
      security: [{ sessionCookie: [] }],
      responses: { "200": { description: "Updated" } },
    },
  },
  "/api/intel/automation/actions/{id}/comments": {
    get: {
      tags: ["Public"],
      summary: "List comments + audit entries",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": { description: "OK" } },
    },
    post: {
      tags: ["Auth"],
      summary: "Add a comment",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "201": { description: "Created" } },
    },
  },
  "/api/intel/automation/actions/{id}/assign": {
    patch: {
      tags: ["Auth"],
      summary: "Assign action to a user",
      security: [{ sessionCookie: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: { "200": { description: "Assigned" } },
    },
  },
  "/api/intel/automation/briefings": {
    get: { tags: ["Public"], summary: "Briefing archive", responses: { "200": { description: "OK" } } },
  },
  "/api/intel/automation/briefings/export": {
    get: { tags: ["Public"], summary: "Latest briefing as PDF", responses: { "200": { description: "application/pdf" } } },
  },
  "/api/intel/automation/forecast-accuracy": {
    get: { tags: ["Public"], summary: "Backtest accuracy results", responses: { "200": { description: "OK" } } },
  },
  "/api/intel/automation/stream": {
    get: { tags: ["Public"], summary: "Server-sent events stream", responses: { "200": { description: "text/event-stream" } } },
  },
  "/api/cron/automation": {
    post: {
      tags: ["Cron"],
      summary: "Trigger pipeline (CRON_SECRET)",
      security: [{ cronBearer: [] }],
      responses: {
        "200": { description: "Pipeline complete" },
        "401": { description: "Bad secret" },
        "429": { description: "Rate-limited" },
      },
    },
  },
  "/api/admin/automation/run": {
    post: {
      tags: ["Admin"],
      summary: "Admin trigger",
      security: [{ sessionCookie: [] }],
      responses: { "200": { description: "OK" }, "401": { description: "Unauthorised" } },
    },
    get: {
      tags: ["Admin"],
      summary: "Recent automation runs",
      security: [{ sessionCookie: [] }],
      responses: { "200": { description: "OK" } },
    },
  },
}

export function buildFullSpec() {
  return { ...buildOpenApiSpec(), paths: PATHS }
}
