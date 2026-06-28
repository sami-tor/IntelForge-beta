import crypto from "crypto"
import { query } from "@/lib/db"

export type AIProvider = "openai" | "anthropic" | "google" | "deepseek" | "custom"

export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string
  baseUrl: string | null
  enabled: boolean
}

const PROVIDERS = new Set<AIProvider>(["openai", "anthropic", "google", "deepseek", "custom"])

export function isValidProvider(provider: string): provider is AIProvider {
  return PROVIDERS.has(provider as AIProvider)
}

export function defaultModelForProvider(provider: AIProvider): string {
  switch (provider) {
    case "anthropic": return "claude-3-5-sonnet-latest"
    case "google": return "gemini-1.5-flash"
    case "deepseek": return "deepseek-chat"
    case "custom": return "custom-model"
    case "openai":
    default:
      return "gpt-4o-mini"
  }
}

function getEncryptionKey() {
  const secret = process.env.AI_SETTINGS_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error("AI_SETTINGS_SECRET, SESSION_SECRET, or JWT_SECRET is required")
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`
}

export function decryptApiKey(payload: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".")
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted API key")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64"))
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

export async function ensureAISettingsTable() {
  return query(`
    CREATE TABLE IF NOT EXISTS user_ai_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL DEFAULT 'openai',
      model VARCHAR(120) NOT NULL DEFAULT 'gpt-4o-mini',
      encrypted_api_key TEXT NOT NULL,
      base_url TEXT,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function getAISettings(userId: number): Promise<AISettings | null> {
  await ensureAISettingsTable()
  const result = await query(
    `SELECT provider, model, encrypted_api_key, base_url, enabled FROM user_ai_settings WHERE user_id = $1`,
    [userId]
  )
  const row = result.data?.[0]
  if (!result.success || !row) return null
  if (!isValidProvider(row.provider)) return null
  return {
    provider: row.provider,
    model: row.model,
    apiKey: decryptApiKey(row.encrypted_api_key),
    baseUrl: row.base_url || null,
    enabled: row.enabled !== false,
  }
}

export async function saveAISettings(userId: number, input: {
  provider: AIProvider
  model: string
  apiKey: string
  baseUrl?: string | null
  enabled?: boolean
}) {
  await ensureAISettingsTable()
  const encrypted = encryptApiKey(input.apiKey)
  return query(
    `INSERT INTO user_ai_settings (user_id, provider, model, encrypted_api_key, base_url, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       model = EXCLUDED.model,
       encrypted_api_key = EXCLUDED.encrypted_api_key,
       base_url = EXCLUDED.base_url,
       enabled = EXCLUDED.enabled,
       updated_at = NOW()
     RETURNING id, provider, model, base_url, enabled, updated_at`,
    [userId, input.provider, input.model, encrypted, input.baseUrl || null, input.enabled !== false]
  )
}

export async function deleteAISettings(userId: number) {
  await ensureAISettingsTable()
  return query(`DELETE FROM user_ai_settings WHERE user_id = $1`, [userId])
}
