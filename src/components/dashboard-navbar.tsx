"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Logo from "./logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Home,
  Search,
  Shield,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  LayoutDashboard,
  Key,
  History,
  AlertTriangle,
  Zap,
  FolderOpen,
  Building2,
} from "lucide-react"
import { OrgSwitcher } from "@/components/organization/org-switcher"

export default function DashboardNavbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    // Fetch unread alerts count
    if (user && user.role !== 'admin') {
      fetchUnreadAlerts()
      // Refresh every 60 seconds
      const interval = setInterval(fetchUnreadAlerts, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchUnreadAlerts = async () => {
    try {
      const response = await fetch('/api/user/monitoring?type=alerts', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const unread = data.alerts?.filter((a: any) => !a.is_read && !a.is_dismissed).length || 0
        setUnreadAlerts(unread)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const navItems = [
    { href: '/dashboard',            label: 'Dashboard',    icon: LayoutDashboard },
    { href: '/search',               label: 'Search',       icon: Search },
    { href: '/intelligence',         label: 'Intelligence', icon: Zap },
    { href: '/dashboard/investigations', label: 'Cases',    icon: FolderOpen },
    { href: '/dashboard/organizations',  label: 'Orgs',      icon: Building2 },
    { href: '/dashboard/monitoring', label: 'Monitoring',   icon: Shield, badge: unreadAlerts > 0 ? unreadAlerts : undefined },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="IntelForge Home">
            <Logo variant="icon" size="md" />
            <span className="font-bold text-lg hidden sm:block">IntelForge</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Org Switcher */}
            <OrgSwitcher />

            {/* Alerts Bell (only for non-admin) */}
            {user && user.role !== 'admin' && (
              <Link
                href="/dashboard/monitoring"
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                title="Monitoring Alerts"
              >
                <Bell className="w-5 h-5" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadAlerts > 9 ? '!' : unreadAlerts}
                  </span>
                )}
              </Link>
            )}

            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="hidden sm:block max-w-[150px] truncate">
                      {user.username || user.email}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-primary mt-1">
                      {user.role === 'admin' ? 'Administrator' : 
                       user.subscriptionType ? user.subscriptionType.charAt(0).toUpperCase() + user.subscriptionType.slice(1) : 'Free'} Account
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {user.role !== 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/monitoring" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="w-4 h-4" />
                        Monitoring
                        {unreadAlerts > 0 && (
                          <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                            {unreadAlerts}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/search" className="flex items-center gap-2 cursor-pointer">
                      <Search className="w-4 h-4" />
                      Search
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/intelligence" className="flex items-center gap-2 cursor-pointer">
                      <Zap className="w-4 h-4" />
                      Intelligence Hub
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/investigations" className="flex items-center gap-2 cursor-pointer">
                      <FolderOpen className="w-4 h-4" />
                      Investigations
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-primary">
                          <Settings className="w-4 h-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-zinc-800/60">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
              <div className="border-t border-zinc-800/60 mt-2 pt-2">
                <button
                  onClick={() => {
                    handleLogout()
                    setMobileMenuOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

