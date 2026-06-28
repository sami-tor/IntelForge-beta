import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CATEGORIES = [
  { value: "all",          label: "All" },
  { value: "ransomware",   label: "Ransomware" },
  { value: "vulnerability",label: "Vulnerabilities" },
  { value: "malware",      label: "Malware" },
  { value: "breach",       label: "Breach" },
  { value: "nation-state", label: "Nation-State" },
  { value: "general",      label: "General" },
]

const CATEGORY_STYLE: Record<string, string> = {
  ransomware:    "bg-red-500/10 text-red-400 border-red-500/20",
  vulnerability: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  breach:        "bg-purple-500/10 text-purple-400 border-purple-500/20",
  malware:       "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  apt:           "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "nation-state":"bg-blue-600/10 text-blue-300 border-blue-600/20",
  general:       "bg-muted/40 text-muted-foreground border-border",
}

async function getNews(category?: string) {
  const conditions: string[] = ["published_at > NOW() - INTERVAL '7 days'"]
  const params: (string | number)[] = [100]

  if (category && category !== "all") {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }

  const r = await query(
    `SELECT guid, title, description, url, category, published_at
     FROM intel_news_cache
     WHERE ${conditions.join(" AND ")}
     ORDER BY published_at DESC
     LIMIT $1`,
    params,
  )
  return r.data || []
}

function timeAgo(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h > 48) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ago`
  return `${Math.floor(diff / 60000)}m ago`
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const category = sp.category || "all"
  const articles = await getNews(category)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Cyber News</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {articles.length} articles · updated every 30 minutes
        </p>
      </div>

      {/* Category filter tabs (client-side navigation via links) */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={cat.value === "all" ? "/intelligence/news" : `/intelligence/news?category=${cat.value}`}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              category === cat.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Articles grid */}
      {articles.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {articles.map((item: Record<string, unknown>) => (
            <a
              key={String(item.guid)}
              href={String(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground line-clamp-3 flex-1 leading-snug">
                  {String(item.title)}
                </h3>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 transition-opacity" />
              </div>
              {!!item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {String(item.description)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <span
                  className={`text-[10px] rounded-full border px-1.5 py-0.5 ${
                    CATEGORY_STYLE[String(item.category)] || CATEGORY_STYLE.general
                  }`}
                >
                  {String(item.category)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {timeAgo(item.published_at as Date)}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-16 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No articles in this category yet.</p>
          <Link href="/intelligence/news" className="text-xs text-primary hover:underline">
            View all categories
          </Link>
        </div>
      )}
    </div>
  )
}
