'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, Shield, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const { user, loading: authLoading, login, refreshUser } = useAuth()
  const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'admin') {
        router.push(ADMIN_ALIAS)
      } else {
        setError('Access denied. Admin credentials required.')
        // Redirect non-admin users after 2 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // SECURITY: Use dedicated admin login endpoint that only allows admin users
    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Admin login successful - refresh user data
        try {
          await refreshUser()
        } catch (refreshError) {
          console.error('[Admin Login] Refresh user error:', refreshError)
          // Continue anyway - cookies are set
        }
        
        // Small delay to ensure cookies are set and propagated
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Redirect to admin portal (use window.location for hard refresh)
        // This ensures cookies are properly set and state is refreshed
        const adminPath = ADMIN_ALIAS || '/admin'
        
        window.location.href = adminPath
      } else {
        // Login failed - server rejected (likely non-admin user)
        setError(data.error || 'Access denied. Admin credentials required.')
        setLoading(false)
      }
    } catch (error) {
      console.error('[Admin Login] Error:', error)
      setError('Login failed. Please try again.')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Admin Login Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-2xl space-y-8">
          {/* Header with Icon */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Admin Portal</h1>
              <p className="text-muted-foreground">
                Secure access to administrative controls
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-foreground">
                Admin Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Security Notice</p>
                  <p>This is a restricted area. All access attempts are logged and monitored.</p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 text-lg transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Access Admin Portal
                </>
              )}
            </Button>

            {/* Back to regular login */}
            <div className="text-center pt-4 border-t border-border">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                ← Back to User Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

