"use client"

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { safeJsonParse } from "@/lib/safe-json"
import { Search, Loader2, ShieldAlert, Lock, ChevronDown, ChevronUp, Eye, FileText, Filter, X, Upload, User, ArrowLeft, Home, LayoutDashboard, Skull, Fish, Users, Bug, Globe, Package, Key, Zap, Calendar, FileCode, Clock, EyeOff, Bookmark, BookmarkCheck, Plus, Download, Layers, ArrowUpDown, Sparkles } from "lucide-react"
import { AIAnalysisPanel, type AIAnalysisPayload } from "@/components/search/ai-analysis-panel"
import { IntelContextPanel } from "@/components/intelligence/intel-context-panel"
import { IdentityDossier } from "@/components/face/identity-dossier"
import { FaceSearchHistoryPanel } from "@/components/face/search-history-panel"
import { TimelineView } from "@/components/face/timeline-view"
import { BulkSearchPanel } from "@/components/face/bulk-search-panel"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArchiveViewer } from "@/components/archive-viewer"

interface SearchResult {
  FilePath: string
  FileName: string
  LineNum: number
  Content: string
  Preview: string
  totalMatchesInFile?: number
  isBlurred?: boolean
  fileType?: string
  displayPath?: string
  category?: string
  source?: string
  sourceLabel?: string
  sourceIcon?: string
  sourceType?: string
  severity?: string
  severityColor?: string
  riskScore?: number
  confidence?: number
  tags?: string[]
  entities?: any[]
  iocs?: any[]
  redactionLevel?: string
  safeDemo?: boolean
  matchReason?: string
  // source-specific fields
  threatActor?: string
  victimName?: string
  victimSector?: string
  victimCountry?: string
  leakType?: string
  discoveredAt?: string
  stealerFamily?: string
  machineId?: string
  domain?: string
  loginUser?: string
  country?: string
  capturedAt?: string
  cveId?: string
  cvssScore?: number
  cvssSeverity?: string
  epssScore?: number
  isKev?: boolean
  vendor?: string
  product?: string
  malwareFamily?: string
  sha256?: string
  targetBrand?: string
  phishType?: string
  ipAddress?: string
  active?: boolean
  publishedAt?: string
  matchedBrands?: string[]
  groupName?: string
  ransomAmount?: string
  status?: string
  leakSizeGb?: number
  aliases?: string[]
  sectors?: string[]
  highlightedContent?: string
}

interface StreamSearchEvent {
  type: "result" | "status" | "error" | "final_count"
  data?: SearchResult
  message?: string
  status?: string
  error?: string
  count?: number
}

function detectQueryIntent(query: string) {
  const v = query.trim()
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return { label: "CVE", color: "text-orange-300 border-orange-500/30 bg-orange-500/10" }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return { label: "IP", color: "text-sky-300 border-sky-500/30 bg-sky-500/10" }
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return { label: "Hash", color: "text-violet-300 border-violet-500/30 bg-violet-500/10" }
  if (/^https?:\/\//i.test(v)) return { label: "URL", color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" }
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) && !v.includes(" ")) return { label: "Domain", color: "text-[var(--mode-image)] border-[var(--mode-image)]/30 bg-[var(--mode-image)]/10" }
  if (/stealer|ulp|phish|ransom|malware|apt|leak|cookie|login|credential/i.test(v)) return { label: "Threat", color: "text-rose-300 border-rose-500/30 bg-rose-500/10" }
  return { label: "Keyword", color: "text-zinc-300 border-zinc-500/30 bg-zinc-500/10" }
}

function buildFollowUpQueries(query: string) {
  const v = query.trim()
  if (!v) return []
  if (/^CVE-\d{4}-\d{4,}$/i.test(v)) return ["exploit", "malware", "actor", "vendor", "product"]
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return ["cert transparency", "phishing", "typosquatting", "ioc", "related domain"]
  if (/^[0-9a-fA-F]{32}$/.test(v) || /^[0-9a-fA-F]{40}$/.test(v) || /^[0-9a-fA-F]{64}$/.test(v)) return ["malware family", "campaign", "source run", "hash lookup"]
  if (/stealer|ulp|phish|ransom|malware|apt|leak|cookie|login|credential/i.test(v)) return ["login", "cookie", "panel", "database", "url", "ULP"]
  return ["cve", "domain", "ip", "hash", "darkweb"]
}

const sourceConfig: Record<string, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  darkweb: { label: "Dark Web", icon: "globe", color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
  demo: { label: "CTI Corpus", icon: "shield", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30" },
  index: { label: "Indexed Files", icon: "database", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  stealer: { label: "Stealer Logs", icon: "key", color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30" },
  cve: { label: "CVE Database", icon: "alert-triangle", color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
  malware: { label: "Malware DB", icon: "bug", color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/30" },
  phishing: { label: "Phishing DB", icon: "link", color: "text-pink-400", bgColor: "bg-pink-500/10", borderColor: "border-pink-500/30" },
  news: { label: "CTI News", icon: "newspaper", color: "text-cyan-400", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30" },
  paste: { label: "Paste Sites", icon: "file-text", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  actors: { label: "Threat Actors", icon: "user-x", color: "text-red-500", bgColor: "bg-red-600/10", borderColor: "border-red-600/30" },
  ransomware: { label: "Ransomware", icon: "lock", color: "text-rose-400", bgColor: "bg-rose-500/10", borderColor: "border-rose-500/30" },
  default: { label: "Result", icon: "search", color: "text-zinc-400", bgColor: "bg-zinc-500/10", borderColor: "border-zinc-500/30" },
}

function getResultMeta(result: SearchResult | null | undefined) {
  if (!result) return { isDemo: false, isDarkweb: false, tags: [] as string[], sourceConfig: sourceConfig["default"], source: "default" }
  const src = result.source || result.category || "default"
  const cfg = sourceConfig[src] || sourceConfig["default"]
  const isDemo = result.safeDemo || src === "demo" || result.category === "demo-corpus" || String(result.FilePath || "").startsWith("demo-corpus://")
  const isDarkweb = src === "darkweb" || result.category === "darkweb"
  const tags = [
    isDemo ? "DEMO" : null,
    isDarkweb ? "DARKWEB" : null,
    result.severity ? String(result.severity).toUpperCase() : null,
    result.isBlurred ? "BLURRED" : null,
  ].filter(Boolean) as string[]
  return { isDemo, isDarkweb, tags, sourceConfig: cfg, source: src }
}

interface FilePreview {
  fileName: string
  filePath: string
  totalLines: number
  content: Array<{
    lineNum: number
    content: string
    isMatch: boolean
    matchPos: number
  }>
  searchQuery: string
}

function SearchPageContent() {
  const { user, loading, refreshUser } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBlurred, setIsBlurred] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string; score?: number } | null>(null)
  const [selectedThreadsProfile, setSelectedThreadsProfile] = useState<any | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [showArchiveViewer, setShowArchiveViewer] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<string | null>(null)
  const [currentResultCount, setCurrentResultCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [searchStatus, setSearchStatus] = useState("")
  const [exporting, setExporting] = useState<"txt" | null>(null)
  const [searchMode, setSearchMode] = useState<"text" | "face" | "image">("text")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    category: "",
    country: "",
    mediaType: "",
    fileType: "",
    dateFrom: "",
    dateTo: "",
    includeDarkweb: true,
  })
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [faceResults, setFaceResults] = useState<any[]>([])
  const [imageResults, setImageResults] = useState<any[]>([])
  const [queryExif, setQueryExif] = useState<{ make?: string; model?: string; dateTaken?: string; gps?: { lat: number; lng: number }; software?: string; dimensions?: { width: number; height: number } } | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [isFaceSearchAvailable, setIsFaceSearchAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_VISUAL_SEARCH_URL || "http://localhost:8000"
    fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => setIsFaceSearchAvailable(r.ok))
      .catch(() => setIsFaceSearchAvailable(false))
  }, [])
  const [threshold, setThreshold] = useState(0.25)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [createIdentityFace, setCreateIdentityFace] = useState<{ faceId: string; faceIds: string[] } | null>(null)
  const [identityName, setIdentityName] = useState("")
  const [identityNotes, setIdentityNotes] = useState("")
  const [watchedFaces, setWatchedFaces] = useState<Set<string>>(new Set())
  const [selectedIdentity, setSelectedIdentity] = useState<any | null>(null)
  const [socialSources, setSocialSources] = useState<any[] | null>(null)
  const [facialAttributes, setFacialAttributes] = useState<{ age?: number; gender?: number } | null>(null)
  const [sortMode, setSortMode] = useState<"score" | "timeline">("score")
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPayload, setAiPayload] = useState<AIAnalysisPayload | null>(null)
  const [bulkSearchOpen, setBulkSearchOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const isAuthenticated = !!user
  const searchInProgressRef = useRef(false)

  // Initialize device quota if not logged in
  useEffect(() => {
    if (!user && !loading) {
      // Initialize device-based quota tracking (uses browser fingerprint + IP)
      fetch("/api/anonymous-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "create" })
      }).catch(err => console.error("Failed to initialize device quota:", err))
    }
  }, [user, loading])

  // Helper function to determine user type for API
  const determinateUserType = (userObj: any): string => {
    if (!userObj) return "free"
    
    // Check if lifetime premium
    if (userObj.isLifetime) return "premium"
    
    // Check subscription type
    const subType = userObj.subscriptionType?.toLowerCase() || "free"
    if (subType === "starter" || subType === "professional" || subType === "enterprise") {
      return "premium"
    }
    
    // Check if subscription is still active
    if (userObj.subscriptionEnd) {
      const endDate = new Date(userObj.subscriptionEnd)
      if (endDate > new Date()) {
        return "premium"
      }
    }
    
    return "free"
  }
  const openAIAnalysis = (selectedResult?: any) => {
    const payload: AIAnalysisPayload = {
      query: searchQuery || searchParams.get("q") || "",
      mode: searchMode,
      results: visibleSearchResults.length > 0 ? visibleSearchResults : faceResults,
      selectedResult,
      filters,
    }
    setAiPayload(payload)
    setAiPanelOpen(true)
  }

  const executeSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 5) {
      setSearchResults([])
      setCurrentResultCount(0)
      setError("Query must be at least 5 characters")
      return
    }

    // Prevent duplicate searches
    if (searching || searchInProgressRef.current) {
      return
    }

    searchInProgressRef.current = true
    setSearching(true)
    setIsSearching(true)
    setError(null)
    setIsCached(false)
    setCurrentResultCount(0)
    setSearchResults([]) // Clear previous results immediately to prevent glitch
    const startTime = Date.now()

    try {
      const params = new URLSearchParams({ q: query, limit: "5000" })
      if (filters.category) params.set("category", filters.category)
      if (filters.country) params.set("country", filters.country)
      if (filters.mediaType) params.set("media_type", filters.mediaType)
      if (filters.fileType) params.set("file_type", filters.fileType)
      if (filters.dateFrom) params.set("date_from", filters.dateFrom)
      if (filters.dateTo) params.set("date_to", filters.dateTo)
      if (!filters.includeDarkweb) params.set("darkweb", "0")

      // Use streaming search API
      const response = await fetch("/api/search/stream?" + params.toString(), {
        headers: user
          ? {
              "X-User-ID": user.id.toString(),
              "X-User-Type": determinateUserType(user),
            }
          : { "X-User-Type": "free" },
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Authentication required
          const data = await response.json().catch(() => ({}))
          setError(data.message || "Please login to access search results")
          setSearchResults([])
          router.push("/login?redirect=/search&q=" + encodeURIComponent(query))
          return
        }
        throw new Error(`Server error (${response.status})`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      setIsSearching(true)
      setSearchResults([])
      setCurrentResultCount(0)
      setSearchStatus("Starting search...")

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = safeJsonParse<StreamSearchEvent | null>(line, null)
            if (!data) continue

            if (data.type === "result" && data.data) {
              const result = data.data
              // Add result immediately as it's found
              setSearchResults(prev => {
                const safePrev = prev ?? []
                // Check for duplicates
                const exists = safePrev.some(r =>
                  r.FilePath === result.FilePath &&
                  r.LineNum === result.LineNum
                )
                if (exists) return safePrev
                return [...safePrev, result]
              })
              setCurrentResultCount(prev => prev + 1)
            } else if (data.type === "status") {
              setSearchStatus(data.message || "")
              if (data.status === "complete") {
                setIsSearching(false)
                const elapsed = Date.now() - startTime
                setSearchTime(elapsed)

                // Refresh user data
                if (user) {
                  refreshUser().catch(err => console.error("Failed to refresh user:", err))
                }

                // Check if no results were found
                setTimeout(() => {
                  setSearchResults(prev => {
                    const safePrev = prev ?? []
                    if (safePrev.length === 0) {
                      setError("No results found. Try refining your search.")
                    }
                    return safePrev
                  })
                }, 100)
              }
            } else if (data.type === "error") {
              throw new Error(data.error || "Search failed")
            }
          } catch (err) {
            console.error("Error parsing stream data:", err)
          }
        }
      }

      setIsBlurred(false)
    } catch (err: any) {
      console.error("Streaming search error:", err)

      // Fallback to regular search API if streaming fails
      try {
        const fallbackParams = new URLSearchParams({ q: query, limit: "5000" })
        if (filters.category) fallbackParams.set("category", filters.category)
        if (filters.country) fallbackParams.set("country", filters.country)
        if (filters.mediaType) fallbackParams.set("media_type", filters.mediaType)
        if (filters.fileType) fallbackParams.set("file_type", filters.fileType)
        if (filters.dateFrom) fallbackParams.set("date_from", filters.dateFrom)
        if (filters.dateTo) fallbackParams.set("date_to", filters.dateTo)

        const fallbackResponse = await fetch("/api/search?" + fallbackParams.toString(), {
          headers: {
            "X-User-ID": user?.id?.toString() || "anonymous",
            "X-User-Type": determinateUserType(user),
          },
          credentials: "include",
        })

        const fallbackData = await fallbackResponse.json()

        if (fallbackResponse.ok && fallbackData.results) {
          setSearchResults(fallbackData.results)
          setCurrentResultCount(fallbackData.results.length)
          setSearchTime(Date.now() - startTime)
          setIsCached(fallbackData.cached || false)

          if (fallbackData.results.length === 0) {
            setError("No results found. Try refining your search.")
          }
        } else {
          setError(fallbackData.error || "Search failed")
          setSearchResults([])
          setCurrentResultCount(0)
        }
      } catch (fallbackErr: any) {
        console.error("Fallback search also failed:", fallbackErr)
        setError(err.message || "Search failed")
        setSearchResults([])
        setCurrentResultCount(0)
      }
    } finally {
      setSearching(false)
      setIsSearching(false)
      searchInProgressRef.current = false
    }
  }, [user, refreshUser, filters, router, searching])

  const lastQueryRef = useRef<string>("")
  const hasSearchedRef = useRef(false)
  
  useEffect(() => {
    if (loading) return
    const q = searchParams.get("q")?.trim() ?? ""
    setSearchQuery(q)

    // Sync filters from URL
    setFilters(prev => ({
      ...prev,
      category: searchParams.get("category")?.trim() ?? "",
      country: searchParams.get("country")?.trim() ?? "",
      mediaType: searchParams.get("media_type")?.trim() ?? "",
      fileType: searchParams.get("file_type")?.trim() ?? "",
      dateFrom: searchParams.get("date_from")?.trim() ?? "",
      dateTo: searchParams.get("date_to")?.trim() ?? "",
      includeDarkweb: searchParams.get("darkweb") !== "0",
    }))
    
    // Only execute search if query changed and is valid, and we haven't searched this query yet
    if (q && q.length >= 5 && q !== lastQueryRef.current && !hasSearchedRef.current) {
      lastQueryRef.current = q
      hasSearchedRef.current = true
      executeSearch(q).finally(() => {
        hasSearchedRef.current = false
      })
    } else if (!q) {
      // Clear results if no query
      setSearchResults([])
      setCurrentResultCount(0)
      lastQueryRef.current = ""
      hasSearchedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (searchMode === "face") {
      if (!uploadedImage && !imageUrl) {
        setError("Please upload an image or provide an image URL for face search")
        return
      }
      await executeFaceSearch(uploadedImage!, imageUrl)
    } else if (searchMode === "image") {
      if (!uploadedImage && !imageUrl) {
        setError("Please upload an image or provide an image URL for reverse image search")
        return
      }
      await executeReverseImageSearch(uploadedImage!, imageUrl)
    } else {
      if (!searchQuery.trim()) return
      const params = new URLSearchParams({ q: searchQuery.trim() })
      // Add filters to URL
      if (filters.category) params.set("category", filters.category)
      if (filters.country) params.set("country", filters.country)
      if (filters.mediaType) params.set("media_type", filters.mediaType)
      if (filters.fileType) params.set("file_type", filters.fileType)
      if (filters.dateFrom) params.set("date_from", filters.dateFrom)
      if (filters.dateTo) params.set("date_to", filters.dateTo)
      if (!filters.includeDarkweb) params.set("darkweb", "0")
      router.replace(`/search?${params.toString()}`)
      await executeSearch(searchQuery.trim())
    }
  }


  const executeFaceSearch = async (imageFile?: File, imageUrlParam?: string) => {
    if (!user) {
      setError("Please login to use face search")
      router.push("/login?redirect=/search")
      return
    }

    setSearching(true)
    setIsSearching(true)
    setError(null)
    setFaceResults([])
    setSearchResults([])
    setQueryExif(null)

    try {
      const formData = new FormData()
      if (imageFile) {
        formData.append("image", imageFile)
      } else if (imageUrlParam) {
        formData.append("url", imageUrlParam)
      }

      const response = await fetch("/api/search/face?limit=30", {
        method: "POST",
        body: formData,
        credentials: "include"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Face search failed")
      }

      const data = await response.json()
      
      const results = data.results || []
      const enhancedResults = results.map((result: any) => ({
        ...result,
        thumbnail_url: result.thumbnail_url || result.url,
        file_name: result.face_id || result.image_id,
        score: result.score || 0,
        identity_id: result.identity_id,
        is_centroid: result.is_centroid
      }))
      
      setFaceResults(enhancedResults)
      setCurrentResultCount(data.total || results.length || 0)
      setSearchTime(Date.now())
      if (data.queryExif) setQueryExif(data.queryExif)
      if (data.social_sources) setSocialSources(data.social_sources)
      else setSocialSources(null)
      if (data.facial_attributes) setFacialAttributes(data.facial_attributes)
      else setFacialAttributes(null)
      
      
    } catch (err: any) {
      console.error("Face search error:", err)
      
      let errorMessage = "Face search is temporarily unavailable"
      if (err.message?.includes("Cannot connect") || err.message?.includes("ECONNREFUSED")) {
        errorMessage = "Face search service is not available. Please try again later."
      } else if (err.message?.includes("timeout")) {
        errorMessage = "Face search timed out. Please try a clearer face image."
      } else if (err.message?.includes("Authentication")) {
        errorMessage = "Please login to use face search"
      } else if (err.message?.includes("No face")) {
        errorMessage = "No face detected in the image. Please upload an image with a clear face."
      } else {
        errorMessage = err.message || "Face search failed. Please try again."
      }
      
      setError(errorMessage)
    } finally {
      setSearching(false)
      setIsSearching(false)
    }
  }

  const executeReverseImageSearch = async (imageFile?: File, imageUrlParam?: string) => {
    if (!user) {
      setError("Please login to use reverse image search")
      router.push("/login?redirect=/search")
      return
    }

    setSearching(true)
    setIsSearching(true)
    setError(null)
    setImageResults([])
    setSearchResults([])

    try {
      const formData = new FormData()
      if (imageFile) {
        formData.append("image", imageFile)
      } else if (imageUrlParam) {
        formData.append("url", imageUrlParam)
      }

      const response = await fetch("/api/search/visual?limit=30", {
        method: "POST",
        body: formData,
        credentials: "include"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || "Reverse image search failed")
      }

      const data = await response.json()
      const results = (data.results || []).map((r: any) => ({
        ...r,
        thumbnail_url: r.thumbnail_url || r.url,
        score: r.score || 0,
      }))

      setImageResults(results)
      setCurrentResultCount(data.total || results.length || 0)
      setSearchTime(Date.now())
    } catch (err: any) {
      console.error("Reverse image search error:", err)
      setError(err.message || "Reverse image search failed. Please try again.")
    } finally {
      setSearching(false)
      setIsSearching(false)
    }
  }

  const createIdentity = async (faceId: string, faceIds: string[], name: string, notes: string) => {
    try {
      const res = await fetch("/api/face/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, notes: notes || null, merged_faces: faceIds, primary_face_id: faceId }),
      })
      const data = await res.json()
      if (data.identity) {
        setCreateIdentityFace(null)
        setFaceResults(prev => (prev ?? []).map(r => {
          const fid = r.face_id || r.id
          if (faceIds.includes(fid)) {
            return { ...r, identity: { id: data.identity.id, name: data.identity.name } }
          }
          return r
        }))
      }
    } catch (err) {
      console.error("Failed to create identity:", err)
    }
  }

  const toggleWatchlist = async (faceId: string, currentlyWatched: boolean) => {
    try {
      if (currentlyWatched) {
        // Find the watchlist entry id first
        const listRes = await fetch("/api/intel/watchlists", { credentials: "include" })
        const listData = await listRes.json()
        const entries = listData.data || []
        const entry = entries.find((e: any) => e.entity_type === "face" && e.entity_value === faceId)
        if (entry) {
          await fetch(`/api/intel/watchlists?id=${entry.id}`, { method: "DELETE", credentials: "include" })
        }
        setWatchedFaces(prev => { const next = new Set(prev); next.delete(faceId); return next })
        setFaceResults(prev => (prev ?? []).map(r => {
          if ((r.face_id || r.id) === faceId) return { ...r, watched: false }
          return r
        }))
      } else {
        await fetch("/api/intel/watchlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ entity_type: "face", entity_value: faceId, label: `Face ${faceId.substring(0, 12)}` }),
        })
        setWatchedFaces(prev => { const next = new Set(prev); next.add(faceId); return next })
        setFaceResults(prev => (prev ?? []).map(r => {
          if ((r.face_id || r.id) === faceId) return { ...r, watched: true }
          return r
        }))
      }
    } catch (err) {
      console.error("Failed to toggle watchlist:", err)
    }
  }

  const fetchIdentity = async (id: number) => {
    try {
      const res = await fetch("/api/face/identities", { credentials: "include" })
      const data = await res.json()
      const found = (data.identities || []).find((i: any) => i.id === id)
      if (found) setSelectedIdentity(found)
    } catch (err) {
      console.error("Failed to fetch identity:", err)
    }
  }

  const handleHistoryReSearch = (entry: any) => {
    setShowHistoryPanel(false)
    if (entry.query_url) {
      setImageUrl(entry.query_url)
      setSearchMode("face")
      executeFaceSearch(undefined, entry.query_url)
    }
  }

  const handleExportPdf = async () => {
    const resultsToExport = filteredFaceResults.length > 0 ? filteredFaceResults : faceResults
    if (resultsToExport.length === 0) return

    setExportingPdf(true)
    try {
      const res = await fetch("/api/search/face/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `Face Search — ${new Date().toLocaleString()}`,
          query_url: imageUrl || undefined,
          query_exif: queryExif || undefined,
          results: resultsToExport.map((r: any) => ({
            face_id: r.face_id || r.id,
            score: r.score || 0,
            identity_id: r.identity_id,
            url: r.url,
            metadata: r.metadata,
            threads_profile: r.threads_profile,
            identity: r.identity,
            intel: r.intel,
          })),
        }),
      })

      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `face-dossier-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error("PDF export failed:", err)
      setError("Failed to export PDF dossier")
    } finally {
      setExportingPdf(false)
    }
  }

  const handleBulkViewResult = (imagePreview: string, results: any[], exif?: any) => {
    const enhancedResults = results.map((result: any) => ({
      ...result,
      thumbnail_url: result.thumbnail_url || result.url,
    }))
    setFaceResults(enhancedResults)
    setCurrentResultCount(results.length)
    setSearchMode("face")
    setBulkSearchOpen(false)
    if (imagePreview) setImagePreview(imagePreview)
    if (exif) setQueryExif(exif)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file")
        return
      }
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearFilters = () => {
    setFilters({
      category: "",
      country: "",
      mediaType: "",
      fileType: "",
      dateFrom: "",
      dateTo: "",
      includeDarkweb: true,
    })
  }

  const toggleFile = (filePath: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath)
    } else {
      newExpanded.add(filePath)
    }
    setExpandedFiles(newExpanded)
  }

  const viewFilePreview = async (filePath: string, lineNum?: number) => {
    setLoadingPreview(true)
    try {
      // If lineNum is provided, show 10 lines before and after
      const contextLines = lineNum ? 10 : 50
      const url = lineNum 
        ? `/api/file-preview?file=${encodeURIComponent(filePath)}&q=${encodeURIComponent(searchQuery)}&line=${lineNum}&context=${contextLines}&maxLines=10000`
        : `/api/file-preview?file=${encodeURIComponent(filePath)}&q=${encodeURIComponent(searchQuery)}&maxLines=10000`
      
      const response = await fetch(url, { credentials: "include" })
      const data = await response.json()
      setSelectedFile(data)
    } catch (err) {
      console.error("Error loading file preview:", err)
      setError("Failed to load file preview")
    } finally {
      setLoadingPreview(false)
    }
  }

  // View image in modal (for face search results from MinIO)
  const viewImage = (url: string, title: string, score?: number) => {
    setSelectedImage({ url, title, score })
  }

  const visibleSearchResults = useMemo(() => {
    if (!searchResults) return []
    if (filters.includeDarkweb) return searchResults
    return searchResults.filter(result => result.category !== "darkweb")
  }, [searchResults, filters.includeDarkweb])

  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>()
    for (const result of (visibleSearchResults ?? [])) {
      const key = result.FileName || result.FilePath || "Unknown"
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(result)
    }
    return Array.from(groups.entries()).sort()
  }, [visibleSearchResults])

  const queryIntent = useMemo(() => detectQueryIntent(searchQuery || searchParams.get("q") || ""), [searchQuery, searchParams])
  const followUpQueries = useMemo(() => buildFollowUpQueries(searchQuery || searchParams.get("q") || ""), [searchQuery, searchParams])
  const demoResultCount = visibleSearchResults?.filter((result) => getResultMeta(result).isDemo).length ?? 0
  const darkwebResultCount = visibleSearchResults?.filter((result) => getResultMeta(result).isDarkweb).length ?? 0
  const highRiskResultCount = visibleSearchResults?.filter((result) => String(result.severity || "").match(/high|critical/i) || Number(result.riskScore || 0) >= 70).length ?? 0

  const filteredFaceResults = useMemo(() =>
    (faceResults ?? []).filter(r => (r.score || 0) >= threshold),
    [faceResults, threshold]
  )

  // Image viewer modal (for face search results)
  if (selectedImage) {
    return (
      <div className="min-h-screen bg-[#0b090f] text-zinc-100 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{selectedImage.title}</h2>
              {selectedImage.score !== undefined && (
                <p className="text-sm text-zinc-400 mt-1">
                  Match Score: <span className="text-green-400 font-semibold">{(selectedImage.score * 100).toFixed(1)}%</span>
                </p>
              )}
            </div>
            <Button onClick={() => setSelectedImage(null)} variant="outline" className="bg-red-600/20 hover:bg-red-600/30 border-red-600/30">
              Close
            </Button>
          </div>

          <div className="bg-[#16111f] border border-[#2c2535] rounded-xl overflow-hidden">
            <div className="flex justify-center items-center p-4 bg-black/30">
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#141018] border border-[#2c2535] rounded-lg">
            <p className="text-sm text-zinc-300">
              <span className="text-zinc-500">Image URL:</span>{" "}
              <a href={selectedImage.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                {selectedImage.url}
              </a>
            </p>
          </div>

          <Button onClick={() => setSelectedImage(null)} variant="outline" className="mt-6 w-full">
            Close
          </Button>
        </div>
      </div>
    )
  }

  // File preview modal
  if (selectedFile) {
    // Show ALL lines (not just matches) - matches will be highlighted
    const allLines = selectedFile.content
    const matchingLines = allLines.filter(line => line.isMatch)
    
    // Check if this is a CSV file and user is free
    const isCsvFile = selectedFile.fileName.toLowerCase().includes(".csv")
    const isUserFree = user?.subscriptionType === "free" || !user
    const shouldBlur = isCsvFile && isUserFree
    
    return (
      <div className="min-h-screen bg-[#0b090f] text-zinc-100 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{selectedFile.fileName}</h2>
              <p className="text-xs text-zinc-400 mt-1">{selectedFile.filePath}</p>
              <p className="text-xs text-zinc-500 mt-1">{selectedFile.totalLines} lines total</p>
              <p className="text-xs text-yellow-400 mt-1 font-semibold">
                {matchingLines.length} matching lines for "{selectedFile.searchQuery}"
              </p>
              {shouldBlur && (
                <p className="text-xs text-red-400 mt-2">
                  🔒 CSV results are blurred for free users - Upgrade to view
                </p>
              )}
            </div>
            <Button onClick={() => setSelectedFile(null)} variant="outline" className="bg-red-600/20 hover:bg-red-600/30 border-red-600/30">
              Close Preview
            </Button>
          </div>

          <div className={`bg-[#16111f] border border-[#2c2535] rounded-xl overflow-hidden ${shouldBlur ? "blur-sm bg-white/10" : ""}`}>
            <div className="max-h-[70vh] overflow-y-auto font-mono text-sm">
              {allLines.length > 0 ? (
                allLines.map((line) => (
                  <div
                    key={line.lineNum}
                    className={`px-4 py-2 border-b border-[#2c2535] ${
                      line.isMatch
                        ? shouldBlur 
                          ? "bg-white/10 text-white/20" 
                          : "bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20"
                        : "text-zinc-300 hover:bg-[#1a1523]"
                    } transition`}
                    style={shouldBlur && line.isMatch ? {
                      filter: "blur(4px)",
                      WebkitFilter: "blur(4px)",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      pointerEvents: "none",
                      cursor: "not-allowed"
                    } as React.CSSProperties : undefined}
                    data-blurred={shouldBlur && line.isMatch ? "true" : "false"}
                  >
                    <span className={`inline-block w-12 text-right mr-4 ${
                      line.isMatch 
                        ? shouldBlur ? "text-white/30" : "text-yellow-400 font-semibold"
                        : "text-zinc-500"
                    }`}>
                      {line.lineNum}
                    </span>
                    <span className="break-all">{line.content}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-zinc-400">
                  No lines found
                </div>
              )}
            </div>
          </div>

          {shouldBlur && (
            <div className="mt-6 p-6 bg-blue-500/20 border border-blue-500/50 rounded-lg text-center">
              <p className="text-sm text-blue-200 mb-3">
                Upgrade your account to view CSV file results
              </p>
              <Button className="bg-blue-600 hover:bg-blue-500">
                View Pricing Plans
              </Button>
            </div>
          )}

          <div className="mt-6 p-4 bg-[#141018] border border-[#2c2535] rounded-lg">
            <p className="text-sm text-zinc-300">
              Showing <span className="font-semibold text-yellow-400">{matchingLines.length}</span> matching lines 
              out of <span className="font-semibold text-zinc-100">{selectedFile.totalLines}</span> total lines
              {allLines.length < selectedFile.totalLines && (
                <span className="text-zinc-500 ml-2">
                  (Displaying {allLines.length} lines with context)
                </span>
              )}
            </p>
          </div>

          <Button onClick={() => setSelectedFile(null)} variant="outline" className="mt-6 w-full">
            Close Preview
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b090f] text-zinc-100">
      {/* Navigation Header */}
      <div className="sticky top-0 z-40 bg-[#0b090f]/95 backdrop-blur border-b border-[#2c2535]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.back()}
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1523]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-4 w-px bg-[#2c2535]" />
              <Link 
                href="/"
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              {user && (
                <>
                  <div className="h-4 w-px bg-[#2c2535]" />
                  <Link 
                    href="/dashboard"
                    className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-zinc-300 hidden sm:block">{user.username}</span>
                </div>
              ) : (
                <Link href="/login">
                  <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white">
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search Hero Section ─── */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:"linear-gradient(#ffffff04 1px, transparent 1px), linear-gradient(90deg, #ffffff04 1px, transparent 1px)",backgroundSize:"64px 64px"}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none" style={{background:"radial-gradient(ellipse at center, #ef444410 0%, transparent 65%)"}} />
        <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              OSINT Search Engine
            </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-zinc-50 mb-3 leading-tight">
          Search <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">268B+ Intelligence Records</span>
        </h1>
        <p className="text-sm text-zinc-500 mb-7 max-w-xl">
          {isAuthenticated ? (
            <>Logged in as <span className="text-zinc-200 font-semibold">{user?.username}</span> · Query across all data sources</>
          ) : (
            <>
              <Lock className="w-4 h-4" /> Sign in to unlock full, unblurred results
            </>
          )}
        </p>

        {/* Search Mode Selector */}
        <div className="flex gap-2 mb-4">
            <Button
              type="button"
              onClick={() => {
                setSearchMode("text")
                setUploadedImage(null)
                setImagePreview(null)
                setFaceResults([])
              }}
              variant={searchMode === "text" ? "default" : "outline"}
              className={searchMode === "text" 
                ? "bg-red-600 hover:bg-red-500 text-white border-red-600" 
                : "bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-[#1a1523] hover:border-red-500/50"}
            >
              <Search className="w-4 h-4 mr-2" /> Text Search
            </Button>
            <Button
              type="button"
              onClick={() => setSearchMode("face")}
              variant={searchMode === "face" ? "default" : "outline"}
              className={searchMode === "face"
                ? "text-white border-[var(--mode-face)] bg-[var(--mode-face)]"
                : "bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-[#1a1523] hover:border-[var(--mode-face)]/50"}
            >
              <User className="w-4 h-4 mr-2" /> Face Search
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSearchMode("image")
                setUploadedImage(null)
                setImagePreview(null)
                setFaceResults([])
              }}
              variant={searchMode === "image" ? "default" : "outline"}
              className={searchMode === "image"
                ? "text-white border-[var(--mode-image)] bg-[var(--mode-image)]"
                : "bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-[#1a1523] hover:border-[var(--mode-image)]/50"}
            >
              <Search className="w-4 h-4 mr-2" /> Image Search <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-[var(--mode-image)]/20 text-[var(--mode-image)] border border-[var(--mode-image)]/30 font-semibold">BETA</span>
            </Button>
            <Button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className={showFilters
                ? "bg-red-600/20 border-red-600/50 text-red-300 hover:bg-red-600/30"
                : "bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-[#1a1523] hover:border-red-500/50"}
            >
              <Filter className="w-4 h-4 mr-2" /> Filters
            </Button>
            {searchMode === "face" && (
              <Button
                type="button"
                onClick={() => setShowHistoryPanel(true)}
                variant="outline"
                className="bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-[#1a1523] hover:border-[var(--mode-face)]/50"
              >
                <Clock className="w-4 h-4 mr-2" /> History
              </Button>
            )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
            <div className="mb-4 p-4 bg-[#0f0c12] border border-[#2c2535] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-300">Search Filters</h3>
                <Button
                  type="button"
                  onClick={clearFilters}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                  <Input
                    value={filters.category}
                    onChange={(e) => setFilters({...filters, category: e.target.value})}
                    placeholder="database, scraped/telegram"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Country</label>
                  <Input
                    value={filters.country}
                    onChange={(e) => setFilters({...filters, country: e.target.value})}
                    placeholder="e.g. US, IN"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Media Type</label>
                  <select
                    value={filters.mediaType}
                    onChange={(e) => setFilters({...filters, mediaType: e.target.value})}
                    className="h-8 w-full rounded-md border border-[#2c2535] bg-[#0f0c12] text-zinc-100 text-xs px-2"
                  >
                    <option value="">All</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">File Type</label>
                  <Input
                    value={filters.fileType}
                    onChange={(e) => setFilters({...filters, fileType: e.target.value})}
                    placeholder="jpg, pdf, txt"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Date From</label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Date To</label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-md border border-[#2c2535] bg-[#0b090f] px-3 py-2">
                  <div>
                    <label className="text-xs text-zinc-300 font-medium">Darkweb results</label>
                    <p className="text-[11px] text-zinc-500">Include allowlisted onion intelligence in search</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ ...filters, includeDarkweb: !filters.includeDarkweb })}
                    className={`h-8 text-xs ${filters.includeDarkweb ? "bg-[var(--mode-face)]/20 border-[var(--mode-face)]/40 text-[var(--mode-face)]" : "bg-[#0f0c12] text-zinc-500"}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {filters.includeDarkweb ? "On" : "Off"}
                  </Button>
                </div>
              </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {searchMode === "text" ? (
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by domain, URL, email, IP, file name, etc."
                    className="h-12 text-base rounded-xl border-[#2c2535] bg-[#0f0c12] text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={searching}
                  className="h-12 px-6 rounded-xl bg-red-600 hover:bg-red-500"
                >
                  {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" />Search</>}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block mb-2 text-sm text-zinc-300 font-medium">
                      Upload Image for {searchMode === "image" ? "Image Search (BETA)" : "Face Search"}
                      {isFaceSearchAvailable === false && (
                        <span className="ml-2 text-xs text-yellow-400 font-normal">
                          Service unavailable
                        </span>
                      )}
                      {isFaceSearchAvailable === true && (
                        <span className="ml-2 text-xs text-green-400 font-normal">
                          Service ready
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className="h-32 border-2 border-dashed border-[#2c2535] rounded-xl flex items-center justify-center hover:border-red-500/50 transition-colors bg-[#0f0c12]">
                          {imagePreview ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img src={imagePreview} alt="Preview" className="max-h-28 max-w-full rounded-lg object-contain" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-zinc-400">
                              <Upload className="w-8 h-8" />
                              <span className="text-sm">Click to upload image</span>
                              <span className="text-xs text-zinc-500">JPG, PNG, GIF, WEBP</span>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {imagePreview && (
                        <Button
                          type="button"
                          onClick={() => {
                            setUploadedImage(null)
                            setImagePreview(null)
                          }}
                          variant="outline"
                          size="sm"
                          className="bg-[#0f0c12] border-[#2c2535] text-zinc-300 hover:bg-red-600/20 hover:border-red-500/50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={searching || (!uploadedImage && !imageUrl) || (searchMode === "face" && isFaceSearchAvailable === false)}
                      className={`h-12 px-6 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                        searchMode === "image"
                          ? "bg-[var(--mode-image)] hover:brightness-110"
                          : "bg-[var(--mode-face)] hover:brightness-110"
                      }`}
                    >
                      {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        searchMode === "image"
                          ? <><Search className="w-5 h-5 mr-2" />Search Images</>
                          : <><User className="w-5 h-5 mr-2" />Search Faces</>
                      )}
                    </Button>
                  </div>
                </div>
                {/* URL input for face search */}
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-zinc-500">or paste image URL:</span>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder={searchMode === "image" ? "https://example.com/image.jpg" : "https://example.com/face.jpg"}
                    className="flex-1 h-8 px-3 rounded-lg border border-[#2c2535] bg-[#0f0c12] text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                {/* Confidence Threshold */}
                {faceResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">Min match:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className="flex-1 h-1 accent-purple-500"
                    />
                    <span className="text-xs text-zinc-400 font-mono w-10 text-right">{(threshold * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )}
        </form>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <ShieldAlert className="w-4 h-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Live search progress indicator */}
        {isSearching && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">
                {searchStatus || "Searching..."}
                {currentResultCount > 0 && ` - Found ${currentResultCount} result${currentResultCount !== 1 ? 's' : ''} so far`}
              </span>
            </div>
          </div>
        )}

        {searchQuery && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#2c2535] bg-[#141018] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Intent</div>
              <div className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${queryIntent.color}`}>{queryIntent.label}</div>
            </div>
            <div className="rounded-xl border border-[#2c2535] bg-[#141018] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Demo Corpus</div>
              <div className="mt-1 text-base font-semibold text-zinc-100">{demoResultCount > 0 ? "Safe Demo Available" : "None Detected"}</div>
            </div>
            <div className="rounded-xl border border-[#2c2535] bg-[#141018] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Dark web index</div>
              <div className="mt-1 text-base font-semibold text-zinc-100">{darkwebResultCount > 0 ? "Active Coverage" : "Monitoring"}</div>
            </div>
            <div className="rounded-xl border border-[#2c2535] bg-[#141018] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Threat Status</div>
              <div className="mt-1 text-base font-semibold text-zinc-100">{highRiskResultCount > 0 ? "Threat Monitored" : "Nominal Security"}</div>
            </div>
          </div>
        )}

        {searchQuery && followUpQueries.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#2c2535] bg-[#141018] p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Follow-up pivots</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(followUpQueries ?? []).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term)
                    void executeSearch(term)
                  }}
                  className="rounded-full border border-[#2c2535] bg-[#0f0c12] px-3 py-1 text-xs text-zinc-300 hover:border-[var(--mode-face)]/40 hover:text-white"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {searchQuery && visibleSearchResults.length === 0 && !searching && !error && (
          <div className="mt-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 text-center">
            <p className="text-sm text-zinc-500">
              No results for <span className="text-zinc-200 font-semibold">"{searchQuery}"</span>.
              Try: <span className="text-zinc-300">stealer, ULP, CVE-2024-3094, APT-29, meta-corp.invalid</span>
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Results Section */}
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Intel Context Panel */}
        {searchQuery.length >= 3 && searchMode === "text" && (
          <IntelContextPanel query={searchQuery} />
        )}

        {/* Text Search Results - Grouped by File */}
        {searchMode === "text" && groupedResults.length > 0 && (
          <div className={`space-y-4 ${visibleSearchResults.length > 0 ? 'animate-slideInTop' : ''}`}>
            {(groupedResults ?? []).map(([fileName, results], idx) => {
              const isExpanded = expandedFiles.has(fileName)
              const totalMatches = results[0]?.totalMatchesInFile || results.length
              const fileType = results[0]?.fileType || "unknown"
              const isAdmin = user && user.role === "admin"
              const shouldBlur = results[0]?.isBlurred === true && !isAdmin
              const firstMeta = getResultMeta(results[0])
              const firstEntity = Array.isArray(results[0]?.entities) ? results[0].entities[0] : null
              const firstEntityType = String(firstEntity?.type || "").toLowerCase()
              const firstEntityValue = String(firstEntity?.value || "")
              const entityHref = firstEntityType && firstEntityValue ? `/intel/${encodeURIComponent(firstEntityType)}/${encodeURIComponent(firstEntityValue)}` : ""
              const graphHref = `/intelligence/relationship-graph?focus=${encodeURIComponent(firstEntityValue || searchQuery || fileName)}`
              const matchReason = results[0]?.matchReason || (firstMeta.isDemo ? "demo corpus match" : firstMeta.isDarkweb ? "darkweb record match" : "content match")
              const getFileIcon = (type: string) => {
                const icons: Record<string, string> = { txt: "TXT", csv: "CSV", html: "HTML", pdf: "PDF", excel: "XLS", archive: "ZIP", unknown: "FILE" }
                return icons[type] || "FILE"
              }

              return (
                <div
                  key={fileName}
                  className="bg-[#16111f] border border-[#2c2535] rounded-2xl overflow-hidden animate-fadeIn"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <button
                    onClick={() => toggleFile(fileName)}
                    className="w-full flex items-center justify-between p-6 hover:bg-[#1a1523] transition"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/40 text-zinc-400">{getFileIcon(fileType)}</span>
                        <div className="flex flex-col">
                          <h3 className={`text-lg font-semibold ${shouldBlur ? "text-white/50" : "text-zinc-100"}`}>
                            {fileName}
                          </h3>
                          {results[0]?.displayPath && (
                            <p className={`text-xs ${shouldBlur ? "text-white/30" : "text-zinc-400"} font-mono`}>
                              {results[0].displayPath}
                            </p>
                          )}
                        </div>
                        {shouldBlur && (
                          <span className="text-xs px-2 py-1 bg-white/10 text-white/60 rounded">BLURRED</span>
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${shouldBlur ? "text-white/40" : "text-yellow-400"} font-semibold`}>
                        Threat Evidence Available
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(firstMeta.tags ?? []).map((tag) => (
                          <span key={tag} className="rounded-full border border-[#2c2535] bg-[#0f0c12] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-300">
                            {tag}
                          </span>
                        ))}
                        <span className="rounded-full border border-[#2c2535] bg-[#0f0c12] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-400">
                          {matchReason}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entityHref && (
                          <Link href={entityHref} onClick={(e) => e.stopPropagation()} className="rounded-full border border-[var(--mode-face)]/30 bg-[var(--mode-face)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--mode-face)] hover:border-[var(--mode-face)]/50">
                            Open Entity
                          </Link>
                        )}
                        <Link href={graphHref} onClick={(e) => e.stopPropagation()} className="rounded-full border border-[var(--mode-image)]/30 bg-[var(--mode-image)]/10 px-3 py-1 text-[10px] font-semibold text-[var(--mode-image)] hover:border-[var(--mode-image)]/50">
                          Open Graph
                        </Link>
                        {firstMeta.isDemo && (
                          <Link href="/admin/demo-corpus" onClick={(e) => e.stopPropagation()} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-200 hover:border-emerald-400/50">
                            Demo Source
                          </Link>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); openAIAnalysis(results[0]) }} className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-semibold text-fuchsia-200 hover:border-fuchsia-400/50">
                          Analyze
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          viewFilePreview(results[0].FilePath)
                        }}
                        disabled={loadingPreview}
                        size="sm"
                        className={`${
                          shouldBlur
                            ? "bg-white/10 hover:bg-white/20 border-white/20 text-white/60"
                            : "bg-red-600/20 hover:bg-red-600/30 border-red-600/30 text-red-300"
                        }`}
                      >
                        <FileText className="w-4 h-4 mr-2" /> Preview
                      </Button>
                      <div className="text-right">
                        <p className="text-sm text-zinc-100 font-semibold">{totalMatches} match{totalMatches !== 1 ? "es" : ""}</p>
                        <p className="text-[11px] text-zinc-500">{firstMeta.sourceConfig.label}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#2c2535]">
                      {(results ?? []).map((result, rIdx) => (
                        <div
                          key={rIdx}
                          className={`px-6 py-3 border-b border-[#2c2535]/50 hover:bg-[#1a1523] transition cursor-pointer ${result.isBlurred && !isAdmin ? "blur-sm" : ""}`}
                          onClick={() => viewFilePreview(result.FilePath, result.LineNum)}
                        >
                          <div className="flex items-start gap-4">
                            <span className="text-xs font-mono text-zinc-500 w-10 pt-0.5 shrink-0">L{result.LineNum}</span>
                            <p className={`text-sm ${shouldBlur ? "text-white/40" : "text-zinc-300"} break-all`}>
                              {result.Preview || result.Content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Image Search Results */}
        {searchMode === "image" && imageResults.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(imageResults ?? []).map((result: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-[#2c2535] overflow-hidden hover:border-[var(--mode-image)]/50 transition cursor-pointer" onClick={() => setSelectedImage({url: result.thumbnail_url || result.url, title: "Image Result", score: result.score})}>
                <img src={result.thumbnail_url || result.url} alt="result" className="w-full h-40 object-cover" />
                <div className="p-3">
                  <p className="text-xs text-zinc-400">Match Score: {((result.score || 0) * 100).toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Face Search Results */}
        {searchMode === "face" && filteredFaceResults.length > 0 && (
          <div className="mt-6">
            {selectedIdentity && (
              <IdentityDossier identity={selectedIdentity} onClose={() => setSelectedIdentity(null)} onUpdate={() => {}} onDelete={() => {}} />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(filteredFaceResults ?? []).map((result: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-[#2c2535] overflow-hidden hover:border-[var(--mode-face)]/50 transition cursor-pointer" onClick={() => viewImage(result.thumbnail_url || result.url, result.file_name || `Face ${idx + 1}`, result.score)}>
                  <div className="relative">
                    <img src={result.thumbnail_url} alt="face" className="w-full h-48 object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-xs px-2 py-1 rounded font-semibold">
                      {((result.score || 0) * 100).toFixed(1)}%
                    </div>
                    {result.is_centroid && (
                      <div className="absolute top-2 left-2 bg-yellow-500/80 text-black text-[10px] px-2 py-0.5 rounded font-bold">CENTROID</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[var(--mode-face)]">{result.file_name || result.face_id || `Face ${idx + 1}`}</p>
                      {result.identity_id && (
                        <button onClick={(e) => { e.stopPropagation(); setSelectedIdentity({ identity_id: result.identity_id }) }} className="text-[10px] text-zinc-400 hover:text-white">
                          View Identity
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredFaceResults.length > 1 && (
              <TimelineView results={filteredFaceResults} onSelectResult={() => {}} sortMode={sortMode} />
            )}
          </div>
        )}

        {/* Social Sources Panel */}
        {searchMode === "face" && socialSources && socialSources.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#2c2535] bg-[#141018] p-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Social Sources</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(socialSources ?? []).map((s: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-[#2c2535] bg-[#0f0c12]">
                  <p className="text-xs font-semibold text-zinc-200">{s.platform || s.source || "Unknown"}</p>
                  <p className="text-[11px] text-zinc-400 mt-1">{s.username || s.url || ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No results fallback */}
        {searchQuery && visibleSearchResults.length === 0 && !searching && !error && searchMode === "text" && (
          <div className="mt-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 text-center">
            <p className="text-sm text-zinc-500">
              No results found. Try different keywords like <span className="text-zinc-300">stealer, ULP, CVE-2024-3094, APT-29</span>
            </p>
          </div>
        )}

      </div>

      {/* AI Analysis Panel */}
      <AIAnalysisPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} payload={aiPayload} />

      {/* Face Search History Panel */}
      {showHistoryPanel && (
        <FaceSearchHistoryPanel isOpen={showHistoryPanel} onClose={() => setShowHistoryPanel(false)} onReSearch={() => {}} />
      )}

      {/* Bulk Search Panel */}
      {bulkSearchOpen && (
        <BulkSearchPanel isOpen={bulkSearchOpen} onClose={() => setBulkSearchOpen(false)} onViewResult={() => {}} />
      )}

    </div>
  )
}

function SearchPageFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-red-500" />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  )
}
