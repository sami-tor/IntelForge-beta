"use client"

import { useState } from "react"
import {
  Shield, Server, MessageSquare, MessageCircle, Webhook, BarChart3,
  Layers, Zap, Brain, GitGraph, ExternalLink, Settings, CheckCircle2,
  XCircle, RefreshCw
} from "lucide-react"

const ICON_MAP: Record<string, any> = {
  "shield-alert": Shield,
  "server": Server,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  "webhook": Webhook,
  "bar-chart": BarChart3,
  "layers": Layers,
  "zap": Zap,
  "brain": Brain,
  "git-graph": GitGraph,
}

interface IntegrationCardProps {
  integration: {
    id: string
    name: string
    description: string
    category: string
    icon: string
    configured: boolean
    configurable: boolean
  }
  onConfigure: (id: string) => void
}

export function IntegrationCard({ integration, onConfigure }: IntegrationCardProps) {
  const Icon = ICON_MAP[integration.icon] || Settings

  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        {integration.configured ? (
          <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Not configured
          </span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-semibold">{integration.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>

      <div className="mt-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {integration.category}
        </span>
      </div>

      <button
        onClick={() => onConfigure(integration.id)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        <Settings className="h-4 w-4" />
        {integration.configured ? "Manage" : "Configure"}
      </button>
    </div>
  )
}
