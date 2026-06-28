/**
 * Slack & Microsoft Teams notification dispatchers
 */

export interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
}

export interface TeamsConfig {
  webhookUrl: string
  title?: string
  themeColor?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#CA8A04",
  low: "#2563EB",
  info: "#6B7280",
}

export async function sendSlackNotification(
  text: string,
  fields: { title: string; value: string; short?: boolean }[],
  config: SlackConfig
): Promise<boolean> {
  try {
    const blocks = [
      {
        type: "section",
        text: { type: "mrkdwn", text },
      },
      {
        type: "section",
        fields: fields.map(f => ({
          type: "mrkdwn",
          text: `*${f.title}*\n${f.value}`,
        })),
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `IntelForge • ${new Date().toLocaleString()}` },
        ],
      },
    ]

    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: config.channel,
        username: config.username || "IntelForge",
        icon_emoji: config.iconEmoji || ":shield:",
        blocks,
      }),
      signal: AbortSignal.timeout(10000),
    })

    return res.ok
  } catch {
    return false
  }
}

export function buildAlertSlackMessage(alert: {
  title: string; severity: string; item_value: string; item_type: string; description: string
}): { text: string; fields: { title: string; value: string; short?: boolean }[] } {
  const emoji = alert.severity === "critical" ? ":red_circle:" : alert.severity === "high" ? ":orange_circle:" : ":yellow_circle:"
  return {
    text: `${emoji} *${alert.severity.toUpperCase()} ALERT* — ${alert.title}`,
    fields: [
      { title: "Type", value: alert.item_type, short: true },
      { title: "Value", value: `\`${alert.item_value}\``, short: true },
      { title: "Details", value: alert.description.substring(0, 500) },
    ],
  }
}

export async function sendTeamsNotification(
  title: string,
  text: string,
  facts: { name: string; value: string }[],
  config: TeamsConfig,
  severity: string = "medium"
): Promise<boolean> {
  try {
    const color = SEVERITY_COLORS[severity] || config.themeColor || SEVERITY_COLORS.medium

    const payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: title,
      themeColor: color,
      title: config.title ? `${config.title} — ${title}` : title,
      text,
      sections: [
        {
          facts: facts.map(f => ({ name: f.name, value: f.value })),
        },
        {
          activityTitle: `IntelForge • ${new Date().toLocaleString()}`,
        },
      ],
    }

    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    return res.ok
  } catch {
    return false
  }
}
