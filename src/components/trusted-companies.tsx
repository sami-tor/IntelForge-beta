"use client"

import Link from "next/link"
import { ArrowRight, BookOpen, Code2, Terminal } from "lucide-react"

const QUICK_LINKS = [
  { icon: BookOpen, label: "Documentation", href: "/docs", desc: "Guides, API reference, and tutorials" },
  { icon: Code2, label: "API Reference", href: "/api-docs", desc: "REST API with code examples" },
  { icon: Terminal, label: "CLI Tools", href: "/docs/cli", desc: "Command-line interface for power users" },
]

export default function TrustedCompanies() {
  return (
    <section className="py-16 border-t border-zinc-900 relative">
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {QUICK_LINKS.map((link) => (
              <Link key={link.label} href={link.href}
                className="group flex items-start gap-4 p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700/60 transition-all">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center group-hover:bg-zinc-700/40 transition-colors">
                  <link.icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-50 transition-colors">{link.label}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-zinc-500">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
