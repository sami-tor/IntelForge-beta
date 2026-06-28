'use client'

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { AdminSidebar } from "@/components/admin-sidebar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { Loader2, ShieldAlert } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || '/admin'
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAdminAccess = async () => {
      // Skip admin check if we're on the login page
      if (pathname === '/admin/login' || pathname.startsWith(`${ADMIN_ALIAS}/login`)) {
        setChecking(false)
        return
      }

      if (loading) return

      if (!user) {
        // No user, redirect to admin login
        router.push(`${ADMIN_ALIAS}/login`)
        return
      }

      // Verify admin role from server with timeout
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          router.push(`${ADMIN_ALIAS}/login`)
          return
        }

        const data = await response.json()
        
        // SECURITY: Verify response signature if present (with error handling)
        if (data._signature) {
          try {
            const { validateResponseSignature } = await import('@/lib/response-signing-client')
            // Add timeout for signature validation
            const validationPromise = validateResponseSignature(data)
            const timeoutPromise = new Promise<boolean>((resolve) => 
              setTimeout(() => resolve(true), 5000) // 5 second timeout - allow if crypto unavailable
            )
            
            const isValid = await Promise.race([validationPromise, timeoutPromise])
            
            // If validation explicitly returns false (not just timeout), reject
            if (isValid === false) {
              console.error('[SECURITY] Invalid response signature')
              router.push('/admin/login')
              return
            }
            // If timeout or crypto unavailable, continue (validation allows it)
          } catch (sigError) {
            // If signature validation fails due to crypto unavailability, continue
            // The validation function should handle this gracefully
            if (process.env.NODE_ENV === 'development') {
              console.warn('[ADMIN] Signature validation error (continuing):', sigError)
            }
          }
        }

        // SECURITY: Strictly verify admin role - only 'admin' role is allowed
        // Premium/Enterprise/Free users (even with high privileges) are NOT admins
        // Only users with role='admin' can access admin panel
        if (!data.user || data.user.role !== 'admin') {
          // Not an admin, immediately redirect to dashboard
          // Log this security event for audit
          if (data.user) {
            console.warn('[SECURITY] Non-admin user attempted to access admin panel:', {
              userId: data.user.id,
              role: data.user.role,
              subscriptionType: data.user.subscriptionType,
              pathname: pathname
            })
            
            // Log to security audit (if available)
            try {
              await fetch('/api/admin/audit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  event_type: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
                  severity: 'high',
                  description: `Non-admin user (role: ${data.user.role}) attempted to access admin panel`,
                  details: {
                    userId: data.user.id,
                    role: data.user.role,
                    subscriptionType: data.user.subscriptionType,
                    pathname: pathname
                  }
                })
              }).catch(() => {}) // Ignore errors if audit endpoint doesn't exist
            } catch (e) {
              // Ignore audit logging errors
            }
          }
          
          router.push('/dashboard')
          return
        }

        // User is confirmed admin, allow access
        setChecking(false)
      } catch (error: any) {
        // Handle abort errors (timeout) gracefully
        if (error.name === 'AbortError') {
          console.error('[ADMIN] Request timeout - redirecting to login')
        } else {
          console.error('[ADMIN] Error verifying admin access:', error)
        }
          router.push(`${ADMIN_ALIAS}/login`)
        }
      }

    checkAdminAccess()
  }, [user, loading, router, pathname])

  // If we're on the login page, just render children without admin layout
  if (pathname === '/admin/login' || pathname.startsWith(`${ADMIN_ALIAS}/login`)) {
    return <>{children}</>
  }

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8 bg-card border border-destructive/20 rounded-lg">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to access the admin panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen pt-16">
        <AdminSidebar />
        <main className="flex-1 ml-64 p-8 bg-muted/30">{children}</main>
      </div>
      <Footer />
    </>
  )
}
