'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for error in URL params (from OAuth callbacks)
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      // SECURITY: Admin users should go to admin panel, not dashboard
      if (user.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password)

    if (result.success) {
      // SECURITY: Check user role after login
      // Admin users should use /admin/login, not regular login
      // Wait a bit for user state to update, then check role
      setTimeout(async () => {
        try {
          const checkResponse = await fetch('/api/auth/me', {
            credentials: 'include',
            headers: { 'Cache-Control': 'no-cache' },
          })
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json()
            
            // If user is admin, redirect to admin panel
            if (checkData.user && checkData.user.role === 'admin') {
              router.push('/admin')
              return
            }
          }
          
          // Regular users go to dashboard
          router.push('/dashboard')
        } catch (error) {
          // If check fails, still redirect to dashboard
          router.push('/dashboard')
        }
      }, 500)
    } else {
      setError(result.error || 'Login failed')
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form (40%) */}
      <div className="w-full lg:w-[40%] bg-card flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
              Welcome Back
            </h1>
            <p className="text-muted-foreground text-lg">
              Sign in to continue your investigative journey and access deep insights.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                Email <span className="text-primary">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Example@email.com"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <Link href="#" className="text-primary hover:underline">
                Forgot password?
              </Link>
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Register Link */}
            <div className="text-center">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link href="/register" className="text-primary hover:underline font-medium">
                Sign Up
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Geometric Pattern (60%) */}
      <div className="hidden lg:flex lg:w-[60%] bg-background relative overflow-hidden">
        <GeometricPattern />
      </div>
    </div>
  )
}

// Geometric Pattern Component
function GeometricPattern() {
  return (
    <div className="absolute inset-0 opacity-30">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(239, 68, 68, 0.03) 20px, rgba(239, 68, 68, 0.03) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(239, 68, 68, 0.03) 20px, rgba(239, 68, 68, 0.03) 40px)
        `,
      }}>
        {/* Quarter circles pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 0% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(239, 68, 68, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(239, 68, 68, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 70%)
          `,
          backgroundSize: '200px 200px',
          backgroundPosition: '0 0, 100px 0, 0 100px, 100px 100px, 50px 50px',
        }}></div>
      </div>
    </div>
  )
}

