import { getGithubSecretFindings, getSecretStats } from "@/lib/intel/fetchers/github-secrets"
import { Key, ExternalLink, AlertTriangle, Shield } from "lucide-react"

export const dynamic = "force-dynamic"

const RISK_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-green-400 bg-green-500/10 border-green-500/20",
}

const SECRET_TYPE_LABEL: Record<string, string> = {
  aws_key: "AWS Access Key", private_key: "Private Key", api_key: "API Key",
  token: "Token/Secret", db_connection: "DB Connection String",
  jwt_secret: "JWT Secret", password: "Password",
}

export default async function GithubSecretsPage() {
  const [findings, stats] = await Promise.all([
    getGithubSecretFindings(50),
    getSecretStats(),
  ])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">GitHub Secret Exposure Scanner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detect exposed API keys, credentials, and secrets in public GitHub repositories — powered by GitHub Code Search
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Exposed Secrets Found</p>
          <p className="text-2xl font-bold text-red-400">{stats.totalFindings}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-muted-foreground">Critical Severity</p>
          <p className="text-2xl font-bold text-red-500">{stats.criticalFindings}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Affected Repositories</p>
          <p className="text-2xl font-bold text-purple-400">{stats.exposedRepos}</p>
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-2">
        {findings.map((f) => (
          <div key={f.findingId}
            className={`rounded-lg border p-3 bg-card hover:border-primary/30 transition-colors ${
              f.riskLevel ? RISK_COLOR[f.riskLevel]?.split(" ")[2] || "border-border" : "border-border"
            }`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] rounded px-1.5 py-0.5 font-medium ${
                    f.riskLevel ? RISK_COLOR[f.riskLevel] || "" : ""
                  }`}>
                    {f.riskLevel?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono text-foreground truncate">{f.repoName}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{f.filePath}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[9px] rounded px-1.5 py-0.5 bg-muted/30 text-muted-foreground">
                {SECRET_TYPE_LABEL[f.secretType] || f.secretType}
              </span>
              {f.isPublic && (
                <span className="flex items-center gap-0.5 text-[9px] text-red-400">
                  <AlertTriangle className="h-2 w-2" /> Public
                </span>
              )}
              {f.stillExposed ? (
                <span className="text-[9px] rounded px-1.5 py-0.5 bg-red-500/20 text-red-400">Still Exposed</span>
              ) : (
                <span className="text-[9px] rounded px-1.5 py-0.5 bg-green-500/10 text-green-400">Fixed</span>
              )}
              <a href={`https://github.com/${f.repoName}/blob/main/${f.filePath}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-0.5">
                <ExternalLink className="h-2 w-2" /> View on GitHub
              </a>
            </div>

            <p className="text-[9px] text-muted-foreground mt-1">
              Discovered {new Date(f.discoveredAt).toLocaleDateString()}
              {f.lastSeenAt && ` · Last seen ${new Date(f.lastSeenAt).toLocaleDateString()}`}
            </p>
          </div>
        ))}
      </div>

      {findings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No exposed secrets cached yet. Run a feed sync to populate.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Set GITHUB_TOKEN env var for higher rate limits on the GitHub Search API.
          </p>
        </div>
      )}
    </div>
  )
}
