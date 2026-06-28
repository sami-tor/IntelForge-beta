"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, History, Key, Newspaper, Store, Cpu } from "lucide-react"

const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || "/admin"
const menuItems = [
  { href: `${ADMIN_ALIAS}`, label: "Dashboard", icon: LayoutDashboard },
  { href: `${ADMIN_ALIAS}/automation`, label: "Automation", icon: Cpu },
  { href: `${ADMIN_ALIAS}/users`, label: "Users", icon: Users },
  { href: `${ADMIN_ALIAS}/subscriptions`, label: "Subscriptions", icon: CreditCard },
  { href: `${ADMIN_ALIAS}/resellers`, label: "Resellers", icon: Store },
  { href: `${ADMIN_ALIAS}/api-keys`, label: "API Keys", icon: Key },
  { href: `${ADMIN_ALIAS}/search-logs`, label: "Search Logs", icon: History },
  { href: `${ADMIN_ALIAS}/audit-logs?source=security`, label: "Security Audit", icon: History },
  { href: `${ADMIN_ALIAS}/news`, label: "News", icon: Newspaper },
  { href: `${ADMIN_ALIAS}/feedback`, label: "Feedback", icon: MessageSquare },
  { href: `${ADMIN_ALIAS}/settings`, label: "Settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r border-border">
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
