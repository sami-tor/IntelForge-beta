// ================================================
// IntelForge Automation - LLM Briefing Augmentation
// ------------------------------------------------
// Optional. When INTEL_LLM_PROVIDER is configured we
// ask an LLM to rewrite the briefing narrative so it
// reads more naturally. The deterministic version
// remains the default and the fallback. Output is
// always tagged so reviewers know which paragraph
// was machine-generated.
// ================================================

export interface LlmConfig {
  provider: "openai" | "anthropic" | "google" | "deepseek" | "custom"
  apiKey: string
  model: string
  baseUrl?: string
}

export function getLlmConfig(): LlmConfig | null {
  const provider = (process.env.INTEL_LLM_PROVIDER || "").toLowerCase().trim() as
    | LlmConfig["provider"]
    | ""
  const apiKey = process.env.INTEL_LLM_API_KEY
  const model = process.env.INTEL_LLM_MODEL
  if (!provider || !apiKey || !model) return null
  return {
    provider: provider as LlmConfig["provider"],
    apiKey,
    model,
    baseUrl: process.env.INTEL_LLM_BASE_URL,
  }
}


interface RewriteInput {
  headline: string
  summary: string
  metrics: Record<string, number | string | null | undefined>
  config: LlmConfig
}

const SYSTEM_PROMPT =
  "You are a senior cyber threat intelligence analyst. Rewrite the supplied " +
  "briefing summary in 3-5 sentences for a CTO audience. Keep every number " +
  "exactly as supplied. Do not add facts that are not in the input. Do not " +
  "reveal upstream API or vendor names. Output plain prose only."

function buildBaseUrl(cfg: LlmConfig): string {
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/+$/, "")
  switch (cfg.provider) {
    case "openai":
      return "https://api.openai.com/v1"
    case "anthropic":
      return "https://api.anthropic.com/v1"
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta"
    case "deepseek":
      return "https://api.deepseek.com/v1"
    default:
      return ""
  }
}

async function callOpenAiCompatible(input: RewriteInput): Promise<string | null> {
  const url = `${buildBaseUrl(input.config)}/chat/completions`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.config.model,
      temperature: 0.3,
      max_tokens: 320,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Headline: ${input.headline}\n` +
            `Existing summary: ${input.summary}\n` +
            `Metrics: ${JSON.stringify(input.metrics)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function callAnthropic(input: RewriteInput): Promise<string | null> {
  const url = `${buildBaseUrl(input.config)}/messages`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": input.config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.config.model,
      max_tokens: 320,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Headline: ${input.headline}\n` +
            `Existing summary: ${input.summary}\n` +
            `Metrics: ${JSON.stringify(input.metrics)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as
    | { content?: Array<{ text?: string }> }
    | null
  return data?.content?.[0]?.text?.trim() || null
}

/**
 * Try to rewrite the briefing summary via the configured LLM.
 * Returns the rewritten text or null if no provider is configured
 * or the call fails. The caller is responsible for tagging the
 * output as machine-generated when present.
 */
export async function maybeRewriteSummary(input: {
  headline: string
  summary: string
  metrics: Record<string, number | string | null | undefined>
}): Promise<{ summary: string; method: "deterministic" | "llm"; provider?: string } | null> {
  const config = getLlmConfig()
  if (!config) return null
  try {
    let rewritten: string | null = null
    const fullInput = { ...input, config }
    if (config.provider === "anthropic") {
      rewritten = await callAnthropic(fullInput)
    } else {
      // openai, deepseek, custom OpenAI-compatible
      rewritten = await callOpenAiCompatible(fullInput)
    }
    if (!rewritten) return null
    return {
      summary: rewritten,
      method: "llm",
      provider: config.provider,
    }
  } catch {
    return null
  }
}
