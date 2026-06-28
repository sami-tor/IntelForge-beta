"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileArchive, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const uploadData = await uploadResponse.json()

      if (!uploadData.success) {
        throw new Error(uploadData.error || "Upload failed")
      }

      setUploading(false)

      // If it's a ZIP file, process it
      if (file.name.endsWith(".zip")) {
        setProcessing(true)

        const processResponse = await fetch("/api/process-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filepath: uploadData.filename,
            fileId: uploadData.fileId,
          }),
        })

        const processData = await processResponse.json()

        if (!processData.success) {
          throw new Error(processData.error || "Processing failed")
        }

        setResult(processData.results)
        setProcessing(false)
      } else {
        setResult(uploadData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setUploading(false)
      setProcessing(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <FileArchive className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900">File Upload & Processing</h3>
      </div>

      <div className="space-y-4">
        {/* File Input */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".zip,.txt,.json,.csv"
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">{file ? file.name : "Click to upload or drag and drop"}</p>
            <p className="text-xs text-gray-500">ZIP, TXT, JSON, CSV files supported</p>
          </label>
        </div>

        {/* Upload Button */}
        {file && (
          <Button onClick={handleUpload} disabled={uploading || processing} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Process
              </>
            )}
          </Button>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">Processing Complete</p>
            </div>

            {result.total_files && (
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <strong>Total Files:</strong> {result.total_files}
                </p>
                <p>
                  <strong>Total Size:</strong> {(result.total_size / 1024).toFixed(2)} KB
                </p>
                <p>
                  <strong>Status:</strong> {result.status}
                </p>

                {result.file_types && (
                  <div>
                    <strong>File Types:</strong>
                    <ul className="ml-4 mt-1">
                      {Object.entries(result.file_types).map(([ext, count]) => (
                        <li key={ext}>
                          {ext}: {count as number}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
