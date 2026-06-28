"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Building2 } from "lucide-react"
import Link from "next/link"
import DashboardNavbar from "@/components/dashboard-navbar"
import { BrandingEditor } from "@/components/tenant/branding-editor"

export default function WhiteLabelPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get("orgId")

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading])

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Settings</p>
          <h1 className="text-3xl font-bold">White-Label & Branding</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Customize the platform appearance with your own branding, colors, logo, custom domain,
            and white-label the entire experience for your team or clients.
          </p>
        </div>

        <BrandingEditor orgId={orgId ? parseInt(orgId) : undefined} />
      </main>
    </div>
  )
}
