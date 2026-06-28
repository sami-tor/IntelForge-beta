"use client"

import { useState, useRef } from "react"
import { Upload, X, Loader2, Search, Image, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BulkResult {
  fileName: string
  imagePreview?: string
  results: any[]
  total: number
  searchTime: number
  error?: string
  social_sources?: any[]
  queryExif?: any
}

interface CrossMatch {
  faceId1: string
  faceId2: string
  fileName1: string
  fileName2: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onViewResult: (imagePreview: string, results: any[], exif?: any) => void
}

export function BulkSearchPanel({ isOpen, onClose, onViewResult }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<BulkResult[]>([])
  const [crossMatches, setCrossMatches] = useState<CrossMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (newFiles.length === 0) return

    const valid = newFiles.filter(f => f.type.startsWith("image/"))
    if (valid.length !== newFiles.length) {
      setError("Some files were skipped (not images)")
    }

    setFiles(prev => [...prev, ...valid].slice(0, 10))
    valid.forEach(f => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(f)
    })
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleBulkSearch = async () => {
    if (files.length === 0) return
    setSearching(true)
    setError(null)
    setResults([])
    setCrossMatches([])

    try {
      const formData = new FormData()
      files.forEach(f => formData.append("images", f))

      const res = await fetch("/api/search/face/bulk?limit=20", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk search failed")

      setResults(data.results || [])
      setCrossMatches(data.cross_matches || [])

      if (data.results?.length === 0) {
        setError("No faces found in any of the uploaded images")
      }
    } catch (err: any) {
      setError(err.message || "Bulk search failed")
    } finally {
      setSearching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="relative max-w-3xl w-full bg-[#0f0c12] rounded-xl overflow-hidden border border-[#2c2535] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border-b border-[#2c2535] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[var(--mode-face)]" />
            <h2 className="text-lg font-semibold text-zinc-100">Bulk Face Search</h2>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* File Upload Area */}
          {results.length === 0 && (
            <>
              <div
                className="border-2 border-dashed border-[#2c2535] rounded-xl p-8 text-center hover:border-[var(--mode-face)]/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">Click to add images (up to 10)</p>
                <p className="text-xs text-zinc-500 mt-1">JPG, PNG, GIF, WEBP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddFiles}
                  className="hidden"
                />
              </div>

              {/* Preview Thumbnails */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#2c2535] group">
                      <img src={preview} alt={`File ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center text-zinc-300 py-0.5">
                        {files[idx]?.name?.substring(0, 12)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {files.length > 0 && (
                <Button
                  onClick={handleBulkSearch}
                  disabled={searching}
                  className="w-full bg-[var(--mode-face)] hover:brightness-110 text-white"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {searching ? "Searching..." : `Search ${files.length} Image${files.length > 1 ? "s" : ""}`}
                </Button>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Results Summary */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">
                  {results.reduce((sum, r) => sum + r.total, 0)} total faces across {results.length} images
                </h3>
                <Button
                  onClick={() => {
                    setFiles([])
                    setPreviews([])
                    setResults([])
                    setCrossMatches([])
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-[#0f0c12] border-[#2c2535] text-zinc-300"
                >
                  New Search
                </Button>
              </div>

              {/* Cross-matches */}
              {crossMatches.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--mode-face)]/10 border border-[var(--mode-face)]/20">
                  <p className="text-xs text-[var(--mode-face)] font-semibold mb-2">
                    Cross-Matches Found ({crossMatches.length})
                  </p>
                  {crossMatches.map((cm, i) => (
                    <p key={i} className="text-[10px] text-zinc-400">
                      Same face in <span className="text-[var(--mode-face)]">{cm.fileName1}</span> and{" "}
                      <span className="text-[var(--mode-face)]">{cm.fileName2}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Per-image results */}
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="bg-[#16111f] border border-[#2d2636] rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    {result.imagePreview && (
                      <img
                        src={result.imagePreview}
                        alt={result.fileName}
                        className="w-12 h-12 rounded object-cover border border-[#2c2535]"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 font-medium truncate">{result.fileName}</p>
                      <p className="text-xs text-zinc-500">
                        {result.total > 0
                          ? `${result.total} face${result.total !== 1 ? "s" : ""} found in ${result.searchTime}ms`
                          : result.error || "No faces detected"}
                      </p>
                    </div>
                    {result.total > 0 && (
                      <Button
                        size="sm"
                        onClick={() => onViewResult(
                          result.imagePreview || "",
                          result.results,
                          result.queryExif,
                        )}
                        className="bg-[var(--mode-face)] hover:brightness-110 text-white text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" /> View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
