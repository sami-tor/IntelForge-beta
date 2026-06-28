import { Newspaper, Skull, ShieldAlert, Search, Bug, Users, Grid3x3, LayoutDashboard, TrendingUp, AlertTriangle, Activity, Bomb, Globe, Fish, Package, FileCode, Eye, CalendarClock, Key, Terminal, BarChart3, Layers, Link2, Radar, ShieldCheck, GitBranch, Bookmark, Sparkles, Cpu, BookOpen, ListChecks, ChevronRight } from "lucide-react"
import { query, checkDatabaseHealth } from "@/lib/db"
import { ThreatScoreGauge } from "@/components/intelligence/threat-score-gauge"
import { getLatestThreatScore } from "@/lib/intel/automation/threat-score"
import { getLatestBriefing } from "@/lib/intel/automation/briefing-generator"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MODULES = [
  { href: "/intelligence/command-center", label: "Command Center",       icon: Cpu,         description: "Live global threat score, auto-correlated clusters, and emerging trend metrics — fully automated" },
  { href: "/intelligence/action-queue",   label: "Action Queue",         icon: ListChecks,  description: "Auto-generated, prioritised tasks for analysts — patch, hunt, block, review" },
  { href: "/intelligence/briefings",      label: "Executive Briefings",  icon: BookOpen,    description: "Daily auto-generated briefs with threat level, key drivers and recommended actions" },
  { href: "/intelligence/news",          label: "Cyber News",           icon: Newspaper,   description: "Latest cybersecurity news aggregated from multiple sources" },
  { href: "/intelligence/ransomware",    label: "Ransomware Tracker",   icon: Skull,       description: "Active groups, recent victims, sector & country analysis" },
  { href: "/intelligence/cve",           label: "CVE Intelligence",     icon: ShieldAlert, description: "Vulnerability feed with exploit prediction scores (EPSS) and known-exploited flags" },
  { href: "/intelligence/ioc-search",    label: "IOC Lookup",           icon: Search,      description: "Instant IP, domain, hash and URL reputation check across multiple sources" },
  { href: "/intelligence/malware",       label: "Malware Intelligence", icon: Bug,         description: "Recent malware samples, malicious URLs and threat indicators" },
  { href: "/intelligence/threat-actors", label: "Threat Actors",        icon: Users,       description: "APT groups, aliases, targeted sectors and associated techniques" },
  { href: "/intelligence/attack-patterns",label:"Attack Patterns",      icon: Grid3x3,     description: "Enterprise tactics and techniques matrix with detection-oriented summaries" },
  { href: "/intelligence/exploits",      label: "Exploit Intelligence", icon: Bomb,        description: "Exploit-DB PoC feed with CVE matching — verify if vulns have known public exploits" },
  { href: "/intelligence/phishing",      label: "Phishing Intelligence",icon: Fish,        description: "Active phishing campaigns from OpenPhish & PhishTank tracking brand impersonation" },
  { href: "/intelligence/supply-chain",  label: "Supply Chain Intel",   icon: Package,     description: "Dependency vulnerability data from OSV.dev across NPM, PyPI, Maven, Go and more" },
  { href: "/intelligence/sigma",         label: "Sigma Rules",          icon: FileCode,    description: "Curated Sigma detection rules from SigmaHQ for SIEM-based threat detection" },
  { href: "/intelligence/darknet",       label: "Dark Web Monitor",     icon: Eye,         description: "Ransomware blog and dark web forum monitoring for victim disclosures and leak data" },
  { href: "/intelligence/apt-campaigns", label: "APT Campaigns",        icon: CalendarClock,description:"Well-documented APT campaign timeline with actor attribution and technique mapping" },
  { href: "/intelligence/cert-domain",   label: "Domain Intelligence",  icon: Globe,       description: "Certificate Transparency lookup via crt.sh — discover subdomains and SSL certs" },
  { href: "/intelligence/yara",          label: "YARA Repository",      icon: Terminal,    description: "Curated YARA rules library for malware detection, family identification and IOC matching" },
  { href: "/intelligence/typosquatting", label: "Typosquatting",        icon: AlertTriangle,description: "Detect homoglyph attacks and brand impersonation domains with risk scoring" },
  { href: "/intelligence/github-secrets",label: "GitHub Secrets",       icon: Key,         description: "Scan for exposed API keys, tokens, and credentials in public repositories" },
  { href: "/intelligence/vuln-prioritize",label:"Vuln Prioritization",  icon: TrendingUp,  description: "Composite risk scoring: CVSS + EPSS + KEV + exploit availability = patch priority" },
  { href: "/intelligence/detection-coverage",label:"Detection Coverage",icon: BarChart3,    description: "MITRE ATT&CK technique coverage mapped against Sigma and YARA rules — find gaps" },
  { href: "/intelligence/feed-health",   label: "Feed Health",          icon: Activity,    description: "Monitor data freshness, record counts, and sync status across all intelligence feeds" },
  { href: "/intelligence/bulk-ioc",      label: "Bulk IOC",             icon: Layers,      description: "Paste up to 100 IOCs and correlate them across all intelligence tables at once" },
  { href: "/intelligence/actor-relationships",label:"Actor Relationships",icon:Link2,       description: "Discover overlaps between threat actors — shared techniques, malware, and sectors" },
  { href: "/intelligence/attack-surface",label: "Attack Surface",       icon: Radar,       description: "Consolidated domain report: certs, typosquats, exposed secrets, phishing mentions" },
  { href: "/intelligence/risk-profiler", label: "Risk Profiler",        icon: ShieldCheck, description: "Enter your tech stack to find relevant CVEs, supply chain risks, and exploits" },
  { href: "/intelligence/relationship-graph",label:"Intel Graph",       icon: GitBranch,   description: "Interactive force-directed graph of actors, campaigns, CVEs, and malware connections" },
  { href: "/intel/ai-analyst",         label: "AI Analyst Workspace", icon: Sparkles,    description: "Ask evidence-backed CTI questions across cases, alerts, reports, feeds, and source runs" },
  { href: "/intelligence/watchlists",    label: "Watchlists",           icon: Bookmark,    description: "Track specific CVEs, domains, and actors — get notified when new intel appears" },
]

async function countQuery(sql: string, retries = 2): Promise<number> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await query(sql, [])
    if (r.success && r.data?.[0]) {
      return Number((r.data[0] as { c: string | number }).c) || 0
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  return 0
}

async function getStats() {
  await checkDatabaseHealth()
  const [
    newsToday, newVulns24h, criticalCves, kevTotal, activeGroups, victims30d,
    malware24h, threatActors, activePhishing, darknetPosts, yaraRules, aptCampaigns,
  ] = await Promise.all([
    countQuery(`SELECT COUNT(*) as c FROM intel_news_cache WHERE published_at > NOW() - INTERVAL '24 hours'`),
    countQuery(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE published_at > NOW() - INTERVAL '24 hours'`),
    countQuery(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE cvss_v3_severity='CRITICAL'`),
    countQuery(`SELECT COUNT(*) as c FROM intel_cve_cache WHERE is_kev=true`),
    countQuery(`SELECT COUNT(*) as c FROM intel_ransomware_groups WHERE active=true`),
    countQuery(`SELECT COUNT(*) as c FROM intel_ransomware_victims WHERE discovered_at > NOW() - INTERVAL '30 days'`),
    countQuery(`SELECT COUNT(*) as c FROM intel_malware_cache WHERE first_seen > NOW() - INTERVAL '24 hours'`),
    countQuery(`SELECT COUNT(*) as c FROM intel_mitre_groups`),
    countQuery(`SELECT COUNT(*) as c FROM intel_phishing_cache WHERE active = true`),
    countQuery(`SELECT COUNT(*) as c FROM intel_darknet_posts`),
    countQuery(`SELECT COUNT(*) as c FROM intel_yara_rules`),
    countQuery(`SELECT COUNT(*) as c FROM intel_apt_campaigns`),
  ])
  return {
    newsToday,
    newVulns24h,
    criticalCves,
    kevTotal,
    activeGroups,
    victims30d,
    malware24h,
    threatActors,
    activePhishing,
    darknetPosts,
    yaraRules,
    aptCampaigns,
  }
}

async function getRecentNews() {
  const r = await query(
    `SELECT title, url, category, published_at FROM intel_news_cache
     ORDER BY published_at DESC LIMIT 8`,
    [],
  )
  return r.data || []
}

async function getTopCves() {
  const r = await query(
    `SELECT cve_id, description, cvss_v3_score, cvss_v3_severity, is_kev, published_at
     FROM intel_cve_cache
     WHERE cvss_v3_severity IN ('CRITICAL','HIGH')
     ORDER BY published_at DESC LIMIT 5`,
    [],
  )
  return r.data || []
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  ransomware:    { text: "text-red-400",   bg: "bg-red-500/10",    border: "border-red-500/20" },
  vulnerability: { text: "text-orange-400",bg: "bg-orange-500/10",  border: "border-orange-500/20" },
  breach:        { text: "text-purple-400",bg: "bg-purple-500/10",  border: "border-purple-500/20" },
  malware:       { text: "text-yellow-400",bg: "bg-yellow-500/10",  border: "border-yellow-500/20" },
  apt:           { text: "text-blue-400",  bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  "nation-state":{ text: "text-blue-300",  bg: "bg-blue-600/10",    border: "border-blue-600/20" },
  general:       { text: "text-zinc-400",  bg: "bg-zinc-800/40",    border: "border-zinc-800/20" },
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH:     "text-orange-400",
  MEDIUM:   "text-yellow-400",
  LOW:      "text-green-400",
}

function timeAgo(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h > 48) return `${Math.floor(h / 24)}d`
  if (h > 0) return `${h}h`
  return `${Math.floor(diff / 60000)}m`
}

const statCards = [
  { label: "Critical CVEs",       icon: AlertTriangle, color: "#ef4444", href: "/intelligence/cve?severity=CRITICAL" },
  { label: "Known Exploited",     icon: ShieldAlert,   color: "#dc2626", href: "/intelligence/cve?kev=1" },
  { label: "Active Groups",       icon: Skull,         color: "#f97316", href: "/intelligence/ransomware" },
  { label: "Victims (30d)",       icon: TrendingUp,    color: "#f59e0b", href: "/intelligence/ransomware?view=victims" },
  { label: "Threat Actors",       icon: Users,         color: "#22c55e", href: "/intelligence/threat-actors" },
  { label: "News (24h)",          icon: Newspaper,     color: "#3b82f6", href: "/intelligence/news" },
  { label: "New Vulns (24h)",     icon: Activity,      color: "#eab308", href: "/intelligence/cve" },
  { label: "Malware (24h)",       icon: Bug,           color: "#ec4899", href: "/intelligence/malware" },
  { label: "Active Phishing",     icon: Fish,          color: "#ef4444", href: "/intelligence/phishing" },
  { label: "Darknet Posts",       icon: Eye,           color: "#a855f7", href: "/intelligence/darknet" },
  { label: "YARA Rules",          icon: Terminal,      color: "#f59e0b", href: "/intelligence/yara" },
  { label: "APT Campaigns",       icon: CalendarClock, color: "#6366f1", href: "/intelligence/apt-campaigns" },
]

const TOP_MODULES = [
  { href: "/intelligence/command-center", label: "Command Center", icon: Cpu,        desc: "Global threat score, correlation clusters, and emerging trends" },
  { href: "/intelligence/deep-search",    label: "Deep Search",    icon: Search,     desc: "Query across all intelligence sources simultaneously" },
  { href: "/intelligence/clusters",       label: "Correlation",    icon: GitBranch,  desc: "Discover entity relationships and attack chains" },
  { href: "/intelligence/briefings",      label: "Briefings",      icon: BookOpen,   desc: "Daily automated briefs with threat levels and actions" },
  { href: "/intelligence/ioc-search",     label: "IOC Lookup",     icon: Search,     desc: "Check IP, domain, hash reputation across all feeds" },
  { href: "/intelligence/cve",            label: "CVE Intel",      icon: ShieldAlert,desc: "CVEs with exploit prediction (EPSS) and KEV flags" },
]

const FEATURED_MODULES = MODULES.slice(4, 10)

export default async function IntelHubPage() {
  const [stats, news, cves, threatScore, latestBriefing] = await Promise.all([
    getStats(),
    getRecentNews(),
    getTopCves(),
    getLatestThreatScore(),
    getLatestBriefing("daily"),
  ])

  const values = [
    stats.criticalCves, stats.kevTotal, stats.activeGroups, stats.victims30d,
    stats.threatActors, stats.newsToday, stats.newVulns24h, stats.malware24h,
    stats.activePhishing || 0, stats.darknetPosts || 0, stats.yaraRules || 0, stats.aptCampaigns || 0,
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Intelligence Hub
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">
            Threat Intelligence Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time cyber threat intelligence · updated every 30–60 minutes · local cache
          </p>
        </div>
        <Link href="/intelligence/command-center"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all">
          <Cpu className="w-3.5 h-3.5" />
          Command Center
        </Link>
      </div>

      {/* Threat score banner */}
      {(threatScore || latestBriefing) && (
        <Link href="/intelligence/command-center"
          className="group relative overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/60 p-6 hover:border-red-500/40 transition-all block">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top, #ef444410 0%, transparent 70%)" }} />
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5 relative z-10">
            {threatScore && (
              <div className="shrink-0">
                <ThreatScoreGauge score={threatScore.score} severity={threatScore.severity} delta24h={threatScore.delta24h} size={140} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400/70 font-semibold mb-2">
                <Cpu className="h-3 w-3" />
                Automated Threat Command
              </div>
              {latestBriefing ? (
                <>
                  <p className="text-sm font-bold text-zinc-200 line-clamp-2">{latestBriefing.headline}</p>
                  <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2">{latestBriefing.summary}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-600">Briefing generates on next automation cycle.</p>
              )}
              <p className="text-[11px] text-red-400/70 mt-3 group-hover:text-red-300 transition-colors font-semibold">
                Open Command Center →
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s, i) => (
          <a key={s.label} href={s.href}
            className="group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 hover:border-zinc-700/60 transition-all">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `radial-gradient(circle at top left, ${s.color}08 0%, transparent 60%)` }} />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-zinc-100 font-mono">{values[i].toLocaleString()}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">{s.label}</p>
          </a>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left: Quick access modules */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Quick Access</h2>
          {TOP_MODULES.map((mod) => (
            <a key={mod.href} href={mod.href}
              className="group flex items-center gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 hover:border-zinc-700/60 hover:bg-zinc-900/50 transition-all">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center group-hover:bg-red-500/10 group-hover:border-red-500/20 transition-all">
                <mod.icon className="w-5 h-5 text-zinc-400 group-hover:text-red-400 transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-50 transition-colors">{mod.label}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{mod.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all ml-auto shrink-0" />
            </a>
          ))}

          {/* Featured modules */}
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold pt-2">Featured Modules</h2>
          {FEATURED_MODULES.map((mod) => (
            <a key={mod.href} href={mod.href}
              className="group flex items-center gap-3 rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-3 hover:border-zinc-700/50 hover:bg-zinc-900/40 transition-all">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <mod.icon className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors">{mod.label}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 line-clamp-1">{mod.description}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Right: News + CVEs */}
        <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Latest news */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Latest Cyber News</h2>
              <a href="/intelligence/news" className="text-[10px] text-red-400 hover:text-red-300 font-semibold transition-colors">All →</a>
            </div>
            <div className="space-y-2">
              {news.length > 0 ? news.map((item: Record<string, unknown>, i: number) => {
                const cat = CAT_COLOR[String(item.category)] || CAT_COLOR.general
                return (
                  <a key={i} href={String(item.url)} target="_blank" rel="noopener noreferrer"
                    className="block rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3.5 hover:border-zinc-700/60 hover:bg-zinc-900/50 transition-all">
                    <p className="text-xs font-medium text-zinc-300 line-clamp-2 leading-snug">{String(item.title)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${cat.text} ${cat.bg} ${cat.border}`}>
                        {String(item.category)}
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(item.published_at as Date)} ago</span>
                    </div>
                  </a>
                )
              }) : (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 text-center">
                  <span className="text-xs text-zinc-600">No news cached yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Critical CVEs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Critical CVEs</h2>
              <a href="/intelligence/cve" className="text-[10px] text-red-400 hover:text-red-300 font-semibold transition-colors">All →</a>
            </div>
            <div className="space-y-2">
              {cves.length > 0 ? cves.map((c: Record<string, unknown>, i: number) => {
                const sev = SEV_COLOR[String(c.cvss_v3_severity)] || "text-zinc-400"
                return (
                  <a key={i}
                    href={`https://nvd.nist.gov/vuln/detail/${c.cve_id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3.5 hover:border-zinc-700/60 hover:bg-zinc-900/50 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[11px] text-red-400 font-semibold">{String(c.cve_id)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!!c.is_kev && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">KEV</span>
                        )}
                        <span className={`text-[11px] font-bold font-mono ${sev}`}>
                          {Number(c.cvss_v3_score)?.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 line-clamp-2 leading-relaxed">{String(c.description)}</p>
                  </a>
                )
              }) : (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 text-center">
                  <span className="text-xs text-zinc-600">No CVE data cached yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
