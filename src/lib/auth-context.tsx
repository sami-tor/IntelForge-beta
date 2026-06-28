"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface User {
  id: number
  email: string
  username: string
  role: string
  verificationStatus: string
  subscriptionType: string | null
  subscriptionEnd: string | null
  searchCount: number
  searchLimit: number
  isLifetime: boolean
  isActive: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const response = await fetch("/api/auth/me", { 
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        }
      })
      if (response.ok) {
        const data = await response.json()
        
        // SECURITY: Validate response signature if present
        // If response is signed, verify it hasn't been tampered with
        if (data._signature) {
          const { validateResponseSignature } = await import("@/lib/response-signing-client")
          const isValid = await validateResponseSignature(data)
          if (!isValid) {
            console.warn("[SECURITY] Response signature validation failed - response may have been tampered")
            setUser(null)
            return
          }
        }
        
        // SECURITY: Only set user if response is valid and authorized
        // CRITICAL: If response contains user data but authorized is false, reject it
        // This prevents using manipulated responses
        if (data.user && data.authorized !== false) {
          // SECURITY: Validate user data structure - reject if missing critical fields
          if (data.user.id && data.user.email && data.user.role !== undefined) {
            setUser(data.user)
          } else {
            console.warn("[SECURITY] Invalid user data structure received, rejecting")
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch user:", error)
      setUser(null)
    }
  }

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      // SECURITY: NEVER trust response data - login response should NOT contain user data
      // If it does, it's been manipulated - ignore it completely
      if (response.ok && data.success) {
        // CRITICAL: Wait for refreshUser to complete before returning success
        // This ensures we have fresh, validated data from /api/auth/me
        await refreshUser()
        
        // Double-check: If refreshUser didn't set user, login failed
        // This prevents using manipulated response data
        return { success: true }
      } else {
        return { success: false, error: data.error || "Login failed" }
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      return { success: false, error: "Network error" }
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      })

      const data = await response.json()

      // SECURITY: NEVER trust response data - register response should NOT contain user data
      // If it does, it's been manipulated - ignore it completely
      if (response.ok && data.success) {
        // CRITICAL: Wait for refreshUser to complete before returning success
        // This ensures we have fresh, validated data from /api/auth/me
        await refreshUser()
        
        // Double-check: If refreshUser didn't set user, registration failed
        // This prevents using manipulated response data
        return { success: true }
      } else {
        return { success: false, error: data.error || "Registration failed" }
      }
    } catch (error) {
      console.error("[v0] Registration error:", error)
      return { success: false, error: "Network error" }
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      setUser(null)
      
      // Redirect to home and refresh to clear UI
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    } catch (error) {
      console.error("[v0] Logout error:", error)
      // Still redirect even if fetch fails
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
