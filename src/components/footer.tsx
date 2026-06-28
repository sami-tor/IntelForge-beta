import Logo from "./logo"
import { Github, Twitter, Linkedin } from "lucide-react"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950">
      <div className="container mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="mb-4">
              <Logo variant="full" size="sm" />
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed mb-5">
              Advanced Open Source Intelligence platform for security researchers. Search, correlate, and analyze threat data.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" aria-label="GitHub"
                className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Twitter"
                className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" aria-label="LinkedIn"
                className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-zinc-600 font-semibold mb-5">Product</h4>
            <ul className="space-y-3">
              {[
                { label: "Search Engine", href: "/search" },
                { label: "Intelligence Hub", href: "/intelligence" },
                { label: "API Reference", href: "/api-docs" },
                { label: "Pricing", href: "/pricing" },
                { label: "Help & Docs", href: "/help" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-zinc-600 font-semibold mb-5">Company</h4>
            <ul className="space-y-3">
              {[
                { label: "About", href: "/about" },
                { label: "News", href: "/news" },
                { label: "Contact", href: "/about#contact" },
                { label: "Dashboard", href: "/dashboard" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-zinc-600 font-semibold mb-5">Legal</h4>
            <ul className="space-y-3">
              {[
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Acceptable Use", href: "/acceptable-use" },
                { label: "Cookie Policy", href: "/privacy#cookies" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-600">© 2025 IntelForge · Built for OSINT Research</p>
          <p className="text-xs text-zinc-700">For authorized security research only</p>
        </div>
      </div>
    </footer>
  )
}

export { Footer }
