"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Search, Shield, AlertTriangle, Database, Globe, Cpu, ChevronRight, Activity, Zap, Eye, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AdvancedSearchModal, type AdvancedFilters } from "./advanced-search-modal"

const STATS = [
  { value: "268B+", label: "Indexed Records", icon: Database },
  { value: "1,585+", label: "Known Exploited CVEs", icon: AlertTriangle },
  { value: "334+", label: "Active Threat Groups", icon: Shield },
  { value: "174+", label: "APT Profiles", icon: Globe },
]

const CAPABILITIES = [
  {
    icon: Search,
    title: "Deep OSINT Search",
    description: "Query billions of records across domains, IPs, emails, URLs, hashes, Bitcoin addresses, and more.",
    tag: "Primary Feature",
  },
  {
    icon: Shield,
    title: "Threat Intelligence Feed",
    description: "Live CVE tracking, ransomware groups, APT profiles, and exploit announcements — updated every 30 minutes.",
    tag: "Real-time",
  },
  {
    icon: Activity,
    title: "IOC Correlation",
    description: "Every search is automatically cross-referenced against our intelligence database. Instantly see related threats.",
    tag: "Automated",
  },
  {
    icon: Eye,
    title: "Dark Web Monitoring",
    description: "Surface-level search isn't enough. We crawl forums, marketplaces, and leaks for deeper intelligence.",
    tag: "Deep Surf",
  },
  {
    icon: Cpu,
    title: "AI-Powered Analysis",
    description: "Automated threat scoring, entity extraction, and relationship mapping across millions of data points.",
    tag: "AI Engine",
  },
  {
    icon: Lock,
    title: "Credential Monitoring",
    description: "Track exposed credentials, breached passwords, and sensitive data across threat actor dumps.",
    tag: "Breach Intel",
  },
]

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Enter Your Query",
    description: "Start with a domain, IP address, email, hash, or any identifier. Our search engine accepts 50+ input formats.",
  },
  {
    step: "02",
    title: "AI Correlation Engine",
    description: "Our intelligence engine cross-references your query against 268B+ records and enriches results with threat context.",
  },
  {
    step: "03",
    title: "Unified Threat Profile",
    description: "Receive a complete intelligence picture: related CVEs, linked actors, historical breaches, and associated IOCs.",
  },
]

const INTEGRATIONS = [
  "MITRE ATT&CK", "VirusTotal", "AlienVault OTX", "Shodan", "Censys", "Hunter.io", "Have I Been Pwned", "GrayHat Warfare",
]

export default function HeroSection() {
  const targetCount = 268190203369
  const [count, setCount] = useState(Math.floor(targetCount * 0.88))
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useAuth()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters | null>(null)
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    const duration = 2000
    const steps = 55
    const start = Math.floor(targetCount * 0.88)
    const increment = (targetCount - start) / steps
    let current = start
    const timer = setInterval(() => {
      current += increment
      if (current >= targetCount) {
        setCount(targetCount)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const params = new URLSearchParams({ q: searchQuery.trim() })
    if (advancedFilters?.sortOrder) params.set("sort", advancedFilters.sortOrder)
    if (advancedFilters?.categories?.length) params.set("category", advancedFilters.categories.join(","))
    router.push(`/search?${params.toString()}`)
  }

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center pt-8 pb-16 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, #ef444410 0%, transparent 65%)" }} />

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            {/* Platform badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Threat Intelligence Platform
              </div>
            </div>

            {/* Headline */}
            <div className="mb-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-zinc-50 leading-[1.05] tracking-tight mb-3">
                Intelligence at
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
                  Machine Speed
                </span>
              </h1>
              <p className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed">
                Open source intelligence search across 268 billion+ records. Correlate threats, track threat actors, and surface IOCs — all in one platform.
              </p>
            </div>

            {/* Search bar */}
            <div className="max-w-3xl mb-6">
              <form onSubmit={handleSearch}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Domain, IP, email, hash, CVE, actor name..."
                      className="h-13 pl-12 pr-4 text-base bg-zinc-900/80 border-zinc-700/60 focus:border-red-500/60 focus:bg-zinc-900 placeholder:text-zinc-600 rounded-xl"
                      style={{ height: '3.25rem' }}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-[3.25rem] px-8 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl border border-red-500/50 shadow-lg shadow-red-500/20 transition-all"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAdvanced(true)}
                    className="h-[3.25rem] px-5 border-zinc-700/60 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 rounded-xl"
                  >
                    Filters
                  </Button>
                </div>
              </form>

              {/* Search hints */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-zinc-600">Try:</span>
                {["meta-corp.invalid", "CVE-2024-3094", "APT-29", "192.168.1.1"].map((q) => (
                  <button key={q} onClick={() => { setSearchQuery(q); router.push(`/search?q=${encodeURIComponent(q)}`) }}
                    className="text-xs px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors font-mono">
                    {q}
                  </button>
                ))}
              </div>

              {/* Auth note */}
              <div className="mt-3 flex items-center gap-2">
                {!user ? (
                  <span className="text-xs text-zinc-500">
                    <Link href="/login" className="text-red-400 hover:underline font-medium">Sign in</Link>
                    {" "}or{" "}
                    <Link href="/register" className="text-red-400 hover:underline font-medium">create a free account</Link>
                    {" "}for full results
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">
                    Logged in as <strong className="text-zinc-300">{user.username}</strong> · {user.searchCount} / {user.searchLimit === -1 ? "∞" : user.searchLimit} searches used
                  </span>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10 max-w-3xl">
              {STATS.map((s) => (
                <div key={s.label} className="group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 hover:border-zinc-700/60 transition-all backdrop-blur">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
                      <s.icon className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-zinc-100 font-mono">{s.value}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CAPABILITIES ─── */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(#ffffff04 1px, transparent 1px), linear-gradient(90deg, #ffffff04 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <div className="flex flex-col items-center text-center mb-14">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
                Platform Capabilities
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">
                Everything a researcher needs
              </h2>
              <p className="text-zinc-500 max-w-xl text-sm leading-relaxed">
                From initial recon to adversary tracking, IntelForge provides the complete intelligence stack — no switching between tools.
              </p>
            </div>

            {/* Capability grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CAPABILITIES.map((cap) => (
                <div key={cap.title} className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 hover:border-red-500/30 transition-all duration-300 backdrop-blur">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none transition-all duration-500"
                    style={{ background: "radial-gradient(circle at top right, #ef444408 0%, transparent 70%)" }} />
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center group-hover:bg-red-500/10 group-hover:border-red-500/30 transition-all">
                        <cap.icon className="w-5 h-5 text-zinc-400 group-hover:text-red-400 transition-colors" />
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold px-2 py-0.5 rounded-full border border-zinc-800">
                        {cap.tag}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-200 mb-1.5 text-sm">{cap.title}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">{cap.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 border-t border-zinc-900 relative">
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center mb-14">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
                How It Works
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">
                From query to intelligence in seconds
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((item, i) => (
                <div key={i} className="relative">
                  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 h-full hover:border-zinc-700/60 transition-all">
                    <div className="text-5xl font-bold text-zinc-800 mb-4 font-mono">{item.step}</div>
                    <h3 className="text-lg font-semibold text-zinc-200 mb-2">{item.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{item.description}</p>
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-5 h-5 text-zinc-700" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTEGRATIONS ─── */}
      <section className="py-16 border-t border-zinc-900 relative">
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center mb-10">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
                Integrations
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-2">
                Connects with your existing stack
              </h2>
              <p className="text-zinc-500 text-sm">Data from trusted sources, unified in one view</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {INTEGRATIONS.map((name) => (
                <div key={name} className="px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 text-zinc-400 text-xs font-medium hover:border-zinc-600 hover:text-zinc-200 transition-colors">
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/20 p-12 md:p-16 text-center">
              {/* Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at top, #ef444420 0%, transparent 60%)" }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold uppercase tracking-wider mb-6">
                  <Zap className="w-3 h-3" />
                  Get Started Free
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">
                  Ready to surface the truth?
                </h2>
                <p className="text-zinc-500 text-sm max-w-lg mx-auto mb-8">
                  Join thousands of security researchers and analysts who rely on IntelForge for daily threat intelligence operations.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {!user ? (
                    <>
                      <Link href="/register">
                        <Button className="bg-red-500 hover:bg-red-600 text-white font-semibold px-8 h-11 rounded-xl border border-red-500/50 shadow-lg shadow-red-500/20">
                          Create Free Account
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                      <Link href="/pricing">
                        <Button variant="outline" className="border-zinc-700/60 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 h-11 px-6 rounded-xl">
                          View Pricing
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/search">
                        <Button className="bg-red-500 hover:bg-red-600 text-white font-semibold px-8 h-11 rounded-xl border border-red-500/50 shadow-lg shadow-red-500/20">
                          Go to Search
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                      <Link href="/intelligence">
                        <Button variant="outline" className="border-zinc-700/60 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 hover:border-zinc-500 h-11 px-6 rounded-xl">
                          Intelligence Hub
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showAdvanced && (
        <AdvancedSearchModal
          isOpen={showAdvanced}
          onClose={() => setShowAdvanced(false)}
          onApply={(filters) => setAdvancedFilters(filters)}
        />
      )}
    </>
  )
}
