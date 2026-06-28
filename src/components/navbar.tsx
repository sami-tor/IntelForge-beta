"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, User, LogOut, Search } from "lucide-react"
import LoginModal from "./login-modal"
import RegisterModal from "./register-modal"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getDisplaySubscription } from "@/lib/roles"
import Logo from "./logo"

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const isActive = (path: string) => pathname === path

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
  }

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60 shadow-sm" : "bg-zinc-950/80"
        }`}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 cursor-pointer" aria-label="IntelForge Home">
              <Logo variant="full" size="md" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className={`text-sm transition-colors ${
                  isActive("/") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                Home
              </Link>
              {user && (
                <Link
                  href="/search"
                  className={`text-sm transition-colors flex items-center gap-1 ${
                    isActive("/search") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <Search size={16} />
                  Search
                </Link>
              )}
              {user && (
                <Link
                  href="/intelligence"
                  className={`text-sm transition-colors ${
                    pathname.startsWith("/intelligence") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  Intelligence Hub
                </Link>
              )}
              <Link
                href="/about"
                className={`text-sm transition-colors ${
                  isActive("/about") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                About
              </Link>
              <Link
                href="/help"
                className={`text-sm transition-colors ${
                  isActive("/help") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                Help
              </Link>
              <Link
                href="/news"
                className={`text-sm transition-colors ${
                  isActive("/news") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                News
              </Link>
              <Link
                href="/api-docs"
                className={`text-sm transition-colors ${
                  isActive("/api-docs") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                API
              </Link>
              <Link
                href="/pricing"
                className={`text-sm transition-colors ${
                  isActive("/pricing") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                Pricing
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="text-sm flex items-center gap-2"
                  >
                    <User size={18} />
                    {user.username}
                  </Button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg p-4">
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-sm font-medium text-foreground">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-primary mt-1">{getDisplaySubscription(user)} Plan</p>
                      </div>
                        <div className="mb-3 text-xs text-muted-foreground">
                          <p>
                            Searches: {user.searchCount} / {user.searchLimit === -1 ? "Unlimited" : user.searchLimit}
                          </p>
                        </div>
                        <Link href="/search" onClick={() => setShowUserMenu(false)}>
                          <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                            <Search size={16} className="mr-2" />
                            Search
                          </Button>
                        </Link>
                      <Link href="/dashboard" onClick={() => setShowUserMenu(false)}>
                        <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                          Dashboard
                        </Button>
                      </Link>
                      {user.role === "admin" && (
                        <Link href={(process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || "/admin")} onClick={() => setShowUserMenu(false)}>
                          <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                            Admin Panel
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full justify-start text-sm text-destructive hover:text-destructive"
                      >
                        <LogOut size={16} className="mr-2" />
                        Logout
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setShowLogin(true)} className="text-sm">
                    Login
                  </Button>
                  <Button onClick={() => setShowRegister(true)} className="text-sm bg-primary hover:bg-primary/90">
                    Sign up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-foreground">
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-4">
                <Link
                  href="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  Home
                </Link>
                {user && (
                  <Link
                    href="/search"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`text-sm transition-colors text-left py-2 flex items-center gap-2 ${
                      isActive("/search") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    <Search size={16} />
                    Search
                  </Link>
                )}
                <Link
                  href="/about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/about") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  About
                </Link>
                <Link
                  href="/help"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/help") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  Help
                </Link>
                <Link
                  href="/news"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/news") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  News
                </Link>
                <Link
                  href="/api-docs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/api-docs") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  API
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm transition-colors text-left py-2 ${
                    isActive("/pricing") ? "text-primary font-semibold" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  Pricing
                </Link>
                {user ? (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="w-full justify-start text-sm flex items-center gap-2"
                    >
                      <User size={18} />
                      {user.username}
                    </Button>
                    {showUserMenu && (
                      <div className="absolute left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg p-4">
                        <div className="mb-3 pb-3 border-b border-border">
                          <p className="text-sm font-medium text-foreground">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-primary mt-1">{getDisplaySubscription(user)} Plan</p>
                        </div>
                        <div className="mb-3 text-xs text-muted-foreground">
                          <p>
                            Searches: {user.searchCount} / {user.searchLimit === -1 ? "Unlimited" : user.searchLimit}
                          </p>
                        </div>
                        <Link href="/search" onClick={() => setShowUserMenu(false)}>
                          <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                            <Search size={16} className="mr-2" />
                            Search
                          </Button>
                        </Link>
                        <Link href="/dashboard" onClick={() => setShowUserMenu(false)}>
                          <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                            Dashboard
                          </Button>
                        </Link>
                        {user.role === "admin" && (
                          <Link href={(process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || "/admin")} onClick={() => setShowUserMenu(false)}>
                            <Button variant="ghost" className="w-full justify-start text-sm mb-2">
                              Admin Panel
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          onClick={handleLogout}
                          className="w-full justify-start text-sm text-destructive hover:text-destructive"
                        >
                          <LogOut size={16} className="mr-2" />
                          Logout
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowLogin(true)
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full justify-start text-sm"
                    >
                      Login
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRegister(true)
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full text-sm bg-primary hover:bg-primary/90"
                    >
                      Sign up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <LoginModal open={showLogin} onOpenChange={setShowLogin} />
      <RegisterModal open={showRegister} onOpenChange={setShowRegister} />
    </>
  )
}

export { Navbar }
export default Navbar
