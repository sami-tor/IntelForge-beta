"use client"
import React from "react"
import { usePathname } from "next/navigation"
import {
  Newspaper, Skull, ShieldAlert, Search, Bug, Users, Grid3x3, Network,
  LayoutDashboard, ChevronRight, ChevronUp, ChevronDown, Bomb, Globe, Fish, Package,
  FileCode, Eye, CalendarClock, Shield, Key, Terminal, AlertTriangle,
  TrendingUp, BarChart3, Activity, Layers, Link2, Radar, ShieldCheck,
  GitBranch, Bookmark, Cpu, BookOpen, ListChecks, Code2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const NAV_ITEMS = [
  { href: "/intelligence",               label: "Hub Dashboard",       icon: LayoutDashboard,      exact: true },
  { href: "/intelligence/command-center", label: "Command Center",      icon: Cpu },
  { href: "/intelligence/deep-search",    label: "Deep Search",         icon: Search },
  { href: "/intelligence/clusters",       label: "Correlation",         icon: GitBranch },
  { href: "/intelligence/action-queue",   label: "Action Queue",        icon: ListChecks },
  { href: "/intelligence/hunt",           label: "Hunt Builder",        icon: Search },
  { href: "/intelligence/briefings",      label: "Briefings",           icon: BookOpen },
  { href: "/api-docs",                    label: "API Docs",            icon: Code2 },
] as const

const INTEL_ITEMS = [
  { href: "/intelligence/news",           label: "Cyber News",          icon: Newspaper },
  { href: "/intelligence/ransomware",     label: "Ransomware Tracker",  icon: Skull },
  { href: "/intelligence/cve",            label: "CVE Intelligence",    icon: ShieldAlert },
  { href: "/intelligence/ioc-search",     label: "IOC Search",          icon: Search },
  { href: "/intelligence/malware",        label: "Malware Intel",       icon: Bug },
  { href: "/intelligence/threat-actors",  label: "Threat Actors",       icon: Users },
  { href: "/intelligence/actor-report",   label: "Actor Report",        icon: Network },
  { href: "/intelligence/attack-patterns",label: "Attack Patterns",     icon: Grid3x3 },
  { href: "/intelligence/exploits",       label: "Exploit Intel",       icon: Bomb },
  { href: "/intelligence/phishing",       label: "Phishing Intel",      icon: Fish },
  { href: "/intelligence/supply-chain",   label: "Supply Chain Vulns",  icon: Package },
  { href: "/intelligence/sigma",          label: "Sigma Rules",         icon: FileCode },
  { href: "/intelligence/darknet",        label: "Dark Web Monitor",    icon: Eye },
  { href: "/intelligence/apt-campaigns",  label: "APT Campaigns",       icon: CalendarClock },
  { href: "/intelligence/cert-domain",    label: "Domain Intel",        icon: Globe },
  { href: "/intelligence/yara",           label: "YARA Repository",     icon: Terminal },
  { href: "/intelligence/typosquatting",  label: "Typosquatting",       icon: AlertTriangle },
  { href: "/intelligence/github-secrets", label: "GitHub Secrets",      icon: Key },
  { href: "/intelligence/vuln-prioritize",label: "Vuln Prioritization", icon: TrendingUp },
  { href: "/intelligence/detection-coverage",label:"Detection Coverage",icon: BarChart3 },
  { href: "/intelligence/feed-health",    label: "Feed Health",         icon: Activity },
  { href: "/intelligence/bulk-ioc",       label: "Bulk IOC",            icon: Layers },
  { href: "/intelligence/actor-relationships",label:"Actor Relations",  icon: Link2 },
  { href: "/intelligence/attack-surface", label: "Attack Surface",      icon: Radar },
  { href: "/intelligence/risk-profiler",  label: "Risk Profiler",       icon: ShieldCheck },
  { href: "/intelligence/relationship-graph",label:"Intel Graph",       icon: GitBranch },
  { href: "/intelligence/watchlists",     label: "Watchlists",          icon: Bookmark },
] as const

function NavGroup({ label, items, defaultOpen = false }: { label: string; items: readonly { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }[]; defaultOpen?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(defaultOpen || items.some(i =>
    i.exact ? pathname === i.href : pathname.startsWith(i.href)
  ))
  const anyActive = items.some(i => i.exact ? pathname === i.href : pathname.startsWith(i.href))

  return (
    <div className="space-y-0.5">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-zinc-600 hover:text-zinc-400 transition-colors">
        <span>{label}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <a key={item.href} href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ml-1",
              active
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50",
            )}>
            <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-red-400" : "")} />
            <span className="flex-1">{item.label}</span>
            {active && <ChevronRight className="w-3 h-3 opacity-50" />}
          </a>
        )
      })}
    </div>
  )
}

export function IntelSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-zinc-800/60 bg-zinc-950 relative z-30 min-h-0 h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4 border-b border-zinc-800/60">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
          Intelligence Hub
        </p>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        <NavGroup label="Core" items={NAV_ITEMS} defaultOpen={true} />
        <NavGroup label="Threat Intel" items={INTEL_ITEMS} defaultOpen={false} />
      </nav>

      <div className="p-4 border-t border-zinc-800/60">
        <p className="text-[10px] text-zinc-700">IntelForge v2.0 · OSINT Platform</p>
      </div>
    </aside>
  )
}

// Mobile nav (horizontal tabs)
export function IntelMobileNav() {
  const pathname = usePathname()
  const [showAll, setShowAll] = useState(false)

  const allItems = [...NAV_ITEMS, ...INTEL_ITEMS]
  const displayItems = showAll ? allItems : allItems.slice(0, 8)

  return (
    <div className="lg:hidden relative z-20 border-b border-zinc-800/60 bg-zinc-950">
      <nav className="flex overflow-x-auto gap-1 px-4 py-2 scrollbar-none">
        {displayItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href)
          return (
            <a key={item.href} href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : "text-zinc-500 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800/60",
              )}>
              <item.icon className="h-3 w-3" />
              {item.label}
            </a>
          )
        })}
        {!showAll && (
          <button onClick={() => setShowAll(true)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-900/60 border border-zinc-800/60 hover:text-zinc-400 transition-colors">
            <span>More</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
        {showAll && (
          <button onClick={() => setShowAll(false)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-900/60 border border-zinc-800/60 hover:text-zinc-400 transition-colors">
            <ChevronUp className="w-3 h-3" />
            <span>Less</span>
          </button>
        )}
      </nav>
    </div>
  )
}
