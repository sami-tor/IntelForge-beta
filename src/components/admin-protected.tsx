"use client"

import { useEffect, ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

interface AdminProtectedProps {
  children: ReactNode
}

export function AdminProtected({ children }: AdminProtectedProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const ADMIN_ALIAS = process.env.NEXT_PUBLIC_ADMIN_UI_ALIAS || '/admin'
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if user is admin
    if (!loading) {
      setIsChecking(false)
      if (!user || user.role !== "admin") {
        // Redirect non-admin users to admin login
        const loginPath = `${ADMIN_ALIAS}/login`
        window.location.href = loginPath
        return
      }
    }
  }, [user, loading, router, ADMIN_ALIAS])

  // Show loading while checking auth
  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // If not admin, show nothing (redirect is happening)
  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

