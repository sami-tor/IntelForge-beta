'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verificationSuccess, setVerificationSuccess] = useState(false)

  // Check for error in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Simulate Cloudflare verification (in real app, this would be actual verification)
  useEffect(() => {
    if (email && email.includes('@')) {
      const timer = setTimeout(() => {
        setVerificationSuccess(true)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setVerificationSuccess(false)
    }
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!agreeTerms || !agreePrivacy) {
      setError('Please agree to Terms & Conditions and Privacy Policy')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Client-side validation matching server requirements
    if (username.length < 3 || username.length > 20) {
      setError('Username must be 3-20 characters')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, hyphens (-) and underscores (_)')
      return
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters')
      return
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain a lowercase letter')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain an uppercase letter')
      return
    }
    if (!/\d/.test(password)) {
      setError('Password must contain a number')
      return
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError('Password must contain a special character (!@#$%^&*)')
      return
    }

    setLoading(true)

    const result = await register(username, email, password)

    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Registration failed')
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
              Begin Your Investigative Journey
            </h1>
            <p className="text-muted-foreground text-lg">
              Register to access deep insights and explore the unseen layers of the web.
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
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username <span className="text-primary">*</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">3-20 characters · letters, numbers, hyphens (-) and underscores (_) only</p>
            </div>

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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Min 12 chars · requires uppercase, lowercase, number &amp; special character (!@#$%^&amp;*)</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm Password <span className="text-primary">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-foreground text-sm">
                  I agree to the{' '}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms & Conditions
                  </Link>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-foreground text-sm">
                  I agree to the{' '}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            {/* Cloudflare Verification */}
            {email && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                {verificationSuccess ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">Success!</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Email verification passed
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">Verifying email...</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !agreeTerms || !agreePrivacy}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 text-lg transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            {/* Sign In Link */}
            <div className="text-center">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign In
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

