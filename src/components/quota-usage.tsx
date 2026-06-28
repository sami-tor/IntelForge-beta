"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card } from "@/components/ui/card"
import { AlertCircle, TrendingUp, Zap } from "lucide-react"
import Link from "next/link"

interface QuotaStatus {
  searches_used: number
  searches_limit: number
  results_used: number
  results_limit: number
}

export function QuotaUsage() {
  const { user } = useAuth()
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Use data from auth context if user is authenticated
    if (user) {
      setQuota({
        searches_used: user.searchCount || 0,
        searches_limit: user.searchLimit || 50,
        results_used: 0,
        results_limit: user.searchLimit === -1 ? -1 : 50,
      })
      setLoading(false)
    } else {
      // For anonymous users, fetch quota data
      fetchAnonymousQuota()
    }
  }, [user])

  const fetchAnonymousQuota = async () => {
    try {
      const response = await fetch("/api/anonymous-session", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setQuota({
          searches_used: data.searchCount || 0,
          searches_limit: data.searchLimit || 10,
          results_used: 0,
          results_limit: 50,
        })
      }
    } catch (error) {
      console.error("Failed to fetch anonymous quota:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchQuota = async () => {
    try {
      const response = await fetch("/api/user/quota", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        // API returns quota data directly, not nested
        setQuota({
          searches_used: data.searches_used || 0,
          searches_limit: data.searches_limit || 50,
          results_used: data.results_used || 0,
          results_limit: data.results_limit || 50,
        })
      }
    } catch (error) {
      console.error("Failed to fetch quota:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !quota) {
    return null
  }

  // Handle unlimited quotas
  const isUnlimited = quota.searches_limit === -1

  const searchPercentage = isUnlimited ? 0 : (quota.searches_used / quota.searches_limit) * 100
  const resultsPercentage = isUnlimited ? 0 : (quota.results_used / quota.results_limit) * 100

  const isSearchNearLimit = !isUnlimited && searchPercentage >= 80
  const isResultsNearLimit = !isUnlimited && resultsPercentage >= 80

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getStatusBgColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500/10"
    if (percentage >= 75) return "bg-yellow-500/10"
    return "bg-green-500/10"
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-background to-background/80 border-primary/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Monthly Quota
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
          {isUnlimited && (
            <div className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
              <p className="text-xs font-semibold text-green-600">✓ Unlimited</p>
            </div>
          )}
        </div>

        {!isUnlimited && (
          <>
            {/* Searches Quota */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Searches</label>
                <span className="text-sm text-muted-foreground">
                  {quota.searches_used} / {quota.searches_limit}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStatusColor(searchPercentage)}`}
                  style={{ width: `${Math.min(searchPercentage, 100)}%` }}
                />
              </div>
              {isSearchNearLimit && (
                <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-600">
                    {searchPercentage >= 100
                      ? "You've reached your search limit"
                      : `${Math.round(100 - searchPercentage)}% remaining this month`}
                  </p>
                </div>
              )}
            </div>

            {/* Results Quota */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Results</label>
                <span className="text-sm text-muted-foreground">
                  {quota.results_used} / {quota.results_limit}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getStatusColor(resultsPercentage)}`}
                  style={{ width: `${Math.min(resultsPercentage, 100)}%` }}
                />
              </div>
              {isResultsNearLimit && (
                <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-600">
                    {resultsPercentage >= 100
                      ? "You've reached your results limit"
                      : `${Math.round(100 - resultsPercentage)}% remaining this month`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Upgrade CTA */}
        {!isUnlimited && (searchPercentage >= 50 || resultsPercentage >= 50) && (
          <div className="pt-4 border-t border-border">
            <Link href="/pricing" className="inline-block w-full">
              <button className="w-full px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors text-sm font-medium text-primary flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Upgrade to get unlimited searches
              </button>
            </Link>
          </div>
        )}

        {/* Resets info */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Quota resets on the 1st of each month
          </p>
        </div>
      </div>
    </Card>
  )
}
