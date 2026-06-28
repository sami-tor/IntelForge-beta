'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder, Search, Download, Printer, Trash2, Mail, Phone, Loader2, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  size?: number
}

interface ArchiveMetadata {
  totalFiles: number
  totalSize: number
  fileTypes: Record<string, number>
  emails: string[]
  phones: string[]
}

interface ArchiveViewerProps {
  archivePath: string
  onClose: () => void
  searchQuery?: string
}

export function ArchiveViewer({ archivePath, onClose, searchQuery }: ArchiveViewerProps) {
  const { user } = useAuth()
  const [treeData, setTreeData] = useState<FileNode | null>(null)
  const [metadata, setMetadata] = useState<ArchiveMetadata | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'tree' | 'document' | 'metadata' | 'selectors' | 'actions'>('tree')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  // Check if user is premium
  const isPremium = user && (
    user.role === 'admin' ||
    user.isLifetime ||
    ['starter', 'professional', 'enterprise', 'api_access'].includes((user.subscriptionType || '').toLowerCase())
  )

  // Fetch archive structure
  useEffect(() => {
    const fetchArchive = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/archive/explore?path=${encodeURIComponent(archivePath)}`)
        if (!res.ok) throw new Error('Failed to load archive')
        const data = await res.json()
        setTreeData(data.tree)
        setMetadata(data.metadata)
      } catch (err) {
        console.error('Archive error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchArchive()
  }, [archivePath])

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const loadFileContent = async (node: FileNode) => {
    if (node.isDirectory) return
    setSelectedFile(node)
    setActiveTab('document')
    
    // Fetch actual content from API
    try {
      setFileContent('Loading...')
      const filePath = `${archivePath}/${node.path}`.replace(/\\/g, '/')
      const response = await fetch(`/api/file-preview?file=${encodeURIComponent(filePath)}&contextLines=50`)
      
      if (response.ok) {
        const data = await response.json()
        // Format the content with line numbers
        const lines = data.content.map((line: any) => 
          `${String(line.lineNum).padStart(5)}: ${line.content}`
        ).join('\n')
        setFileContent(lines || 'File is empty')
      } else {
        setFileContent('Failed to load file content')
      }
    } catch (error) {
      console.error('Error loading file:', error)
      setFileContent(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const TreeNode = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
    const isExpanded = expandedPaths.has(node.path)
    const hasChildren = node.children && node.children.length > 0
    const isHighlighted = selectedFile?.path === node.path

    return (
      <div key={node.path}>
        <div
          className={`flex items-center py-2 px-3 hover:bg-white/10 cursor-pointer group rounded transition ${
            isHighlighted ? 'bg-blue-500/20 border-l-2 border-blue-500' : ''
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
          onClick={() => {
            if (hasChildren) toggleExpand(node.path)
            if (!node.isDirectory) loadFileContent(node)
          }}
        >
          {hasChildren && (
            <span className="w-4 mr-2 flex-shrink-0">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          {!hasChildren && <span className="w-4 mr-2 flex-shrink-0" />}

          {node.isDirectory ? (
            <Folder size={16} className="mr-2 text-blue-400 flex-shrink-0" />
          ) : (
            <File size={16} className="mr-2 text-gray-400 flex-shrink-0" />
          )}

          <span className="text-sm text-gray-300 group-hover:text-white truncate flex-1">
            {node.name}
          </span>
          {node.size && !node.isDirectory && (
            <span className="text-xs text-gray-500 ml-auto flex-shrink-0 ml-2">
              {(node.size / 1024).toFixed(1)}KB
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div>
            <h2 className="text-lg font-semibold text-white">{archivePath.split('/').pop()}</h2>
            <p className="text-xs text-gray-400 mt-1">{archivePath}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none p-2"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800/30">
          {['tree', 'document', 'metadata', 'selectors', 'actions'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-2" />
                <p className="text-gray-400">Loading archive...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tree View */}
              {activeTab === 'tree' && treeData && (
                <div>
                  <div className="text-sm text-gray-400 mb-4">
                    📁 {treeData.children?.length || 0} items
                  </div>
                  <div className="bg-gray-800/30 rounded p-3 font-mono text-sm border border-gray-700">
                    <TreeNode node={treeData} />
                  </div>
                </div>
              )}

              {/* Document View */}
              {activeTab === 'document' && (
                <div>
                  {selectedFile ? (
                    <div>
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
                        <File size={18} className="text-blue-400" />
                        <div className="flex-1">
                          <p className="font-semibold text-white">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">{selectedFile.path}</p>
                        </div>
                        {!isPremium && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                            <Lock size={14} className="text-red-400" />
                            <span className="text-xs text-red-300 font-semibold">Premium Only</span>
                          </div>
                        )}
                      </div>
                      
                      {!isPremium ? (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
                          <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
                          <h3 className="text-xl font-bold text-red-300 mb-3">🔒 Premium Feature</h3>
                          <p className="text-gray-300 mb-4 max-w-md mx-auto">
                            Archive file content is only available to Premium users. 
                            Upgrade your account to view files inside ZIP, RAR, and 7Z archives.
                          </p>
                          <div className="space-y-3">
                            <p className="text-sm text-gray-400">
                              <strong>File:</strong> {selectedFile.name}
                            </p>
                            <p className="text-sm text-gray-400">
                              <strong>Size:</strong> {selectedFile.size ? (selectedFile.size / 1024).toFixed(1) : 0}KB
                            </p>
                          </div>
                          <div className="mt-6 pt-6 border-t border-gray-700">
                            <a 
                              href="/pricing" 
                              className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                            >
                              Upgrade to Premium →
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-800/30 rounded p-4 border border-gray-700">
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono max-h-[50vh] overflow-auto">
                            {fileContent}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <File size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select a file from the tree view to view its content</p>
                      {!isPremium && (
                        <div className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg inline-block">
                          <p className="text-xs text-red-300 flex items-center gap-2">
                            <Lock size={12} />
                            Archive content requires Premium subscription
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              {activeTab === 'metadata' && (
                <div>
                  {!isPremium ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
                      <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-xl font-bold text-red-300 mb-3">🔒 Premium Feature</h3>
                      <p className="text-gray-300 mb-4 max-w-md mx-auto">
                        Archive metadata and statistics are only available to Premium users.
                      </p>
                      <div className="mt-6">
                        <a 
                          href="/pricing" 
                          className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                        >
                          Upgrade to Premium →
                        </a>
                      </div>
                    </div>
                  ) : metadata ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">Total Files</p>
                      <p className="text-3xl font-bold text-white">{metadata.totalFiles}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">Total Size</p>
                      <p className="text-3xl font-bold text-white">{(metadata.totalSize / 1024 / 1024).toFixed(1)}MB</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <File size={16} /> File Types
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(metadata.fileTypes).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm text-gray-400">
                          <span>{type || 'no-extension'}</span>
                          <span className="font-mono font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {metadata.emails.length > 0 && (
                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <Mail size={16} /> Emails Found ({metadata.emails.length})
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-auto">
                        {metadata.emails.slice(0, 20).map((email, i) => (
                          <p key={i} className="text-xs text-gray-400 font-mono">{email}</p>
                        ))}
                        {metadata.emails.length > 20 && (
                          <p className="text-xs text-gray-500 pt-2">+{metadata.emails.length - 20} more...</p>
                        )}
                      </div>
                    </div>
                  )}

                  {metadata.phones.length > 0 && (
                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <Phone size={16} /> Phone Numbers Found ({metadata.phones.length})
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-auto">
                        {metadata.phones.slice(0, 20).map((phone, i) => (
                          <p key={i} className="text-xs text-gray-400 font-mono">{phone}</p>
                        ))}
                        {metadata.phones.length > 20 && (
                          <p className="text-xs text-gray-500 pt-2">+{metadata.phones.length - 20} more...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <p>No metadata available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Selectors Tab - Data extracted from archive */}
              {activeTab === 'selectors' && (
                <div>
                  {!isPremium ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
                      <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-xl font-bold text-red-300 mb-3">🔒 Premium Feature</h3>
                      <p className="text-gray-300 mb-4 max-w-md mx-auto">
                        Selector statistics (emails, phones, etc.) are only available to Premium users.
                      </p>
                      <div className="mt-6">
                        <a 
                          href="/pricing" 
                          className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                        >
                          Upgrade to Premium →
                        </a>
                      </div>
                    </div>
                  ) : metadata ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-500/20 rounded p-3 border border-blue-500/30">
                      <p className="text-xs text-blue-300 mb-1">Total Files</p>
                      <p className="text-2xl font-bold text-white">{metadata.totalFiles}</p>
                    </div>
                    <div className="bg-purple-500/20 rounded p-3 border border-purple-500/30">
                      <p className="text-xs text-purple-300 mb-1">Emails</p>
                      <p className="text-2xl font-bold text-white">{metadata.emails.length}</p>
                    </div>
                    <div className="bg-green-500/20 rounded p-3 border border-green-500/30">
                      <p className="text-xs text-green-300 mb-1">Phones</p>
                      <p className="text-2xl font-bold text-white">{metadata.phones.length}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3">📧 Emails ({metadata.emails.length})</h4>
                      <div className="space-y-1 max-h-[300px] overflow-auto">
                        {metadata.emails.length === 0 ? (
                          <p className="text-xs text-gray-500">No emails found</p>
                        ) : (
                          metadata.emails.map((email, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono truncate">{email}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(email)}
                                className="text-xs text-[var(--primary)] hover:brightness-125 px-1 py-0.5 hover:bg-[var(--primary)]/20 rounded"
                              >
                                Copy
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-300 mb-3">📱 Phones ({metadata.phones.length})</h4>
                      <div className="space-y-1 max-h-[300px] overflow-auto">
                        {metadata.phones.length === 0 ? (
                          <p className="text-xs text-gray-500">No phones found</p>
                        ) : (
                          metadata.phones.map((phone, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono truncate">{phone}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(phone)}
                                className="text-xs text-green-400 hover:text-green-300 px-1 py-0.5 hover:bg-green-500/20 rounded"
                              >
                                Copy
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded p-4 border border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">📋 File Types Distribution</h4>
                    <div className="space-y-2">
                      {Object.entries(metadata.fileTypes).map(([type, count]) => {
                        const percentage = (count / metadata.totalFiles) * 100
                        return (
                          <div key={type}>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span className="font-mono">{type || 'no-extension'}</span>
                              <span>{count} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <p>No selector data available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {activeTab === 'actions' && (
                <div>
                  {!isPremium ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
                      <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-xl font-bold text-red-300 mb-3">🔒 Premium Feature</h3>
                      <p className="text-gray-300 mb-4 max-w-md mx-auto">
                        Archive actions (download, print, delete request) are only available to Premium users.
                      </p>
                      <div className="mt-6">
                        <a 
                          href="/pricing" 
                          className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                        >
                          Upgrade to Premium →
                        </a>
                      </div>
                    </div>
                  ) : (
                <div className="space-y-3">
                  {/* Download Archive Button */}
                  <a
                    href={`/data/${archivePath}`}
                    download
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
                  >
                    <Download size={18} /> Download Entire Archive
                  </a>

                  {/* Print Report Button */}
                  <button
                    onClick={() => {
                      if (!selectedFile) {
                        alert('Please select a file from Tree View first')
                        setActiveTab('tree')
                        return
                      }
                      
                      const printWindow = window.open('', '', 'width=900,height=700')
                      if (printWindow) {
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>Print - ${selectedFile.name}</title>
                              <style>
                                body { font-family: 'Courier New', monospace; margin: 20px; color: #333; }
                                h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
                                .header { background: #f0f0f0; padding: 10px; margin-bottom: 20px; border-radius: 5px; }
                                .content { white-space: pre-wrap; word-wrap: break-word; background: #fff; border: 1px solid #ddd; padding: 15px; }
                                .meta { color: #666; font-size: 0.9em; margin: 5px 0; }
                                @media print { body { margin: 0; } }
                              </style>
                            </head>
                            <body>
                              <h1>📄 File Report</h1>
                              <div class="header">
                                <p class="meta"><strong>Archive:</strong> ${archivePath}</p>
                                <p class="meta"><strong>File:</strong> ${selectedFile.path}</p>
                                <p class="meta"><strong>Size:</strong> ${selectedFile.size ? (selectedFile.size / 1024).toFixed(1) : 0}KB</p>
                                <p class="meta"><strong>Printed:</strong> ${new Date().toLocaleString()}</p>
                              </div>
                              <div class="content">${fileContent}</div>
                            </body>
                          </html>
                        `)
                        printWindow.document.close()
                        setTimeout(() => {
                          printWindow.focus()
                          printWindow.print()
                        }, 250)
                      }
                    }}
                    className="w-full px-4 py-3 bg-[var(--primary)] hover:brightness-110 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
                  >
                    <Printer size={18} /> Print Selected File
                  </button>

                  {/* Request Deletion Button */}
                  <button
                    onClick={() => setShowDeleteForm(true)}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
                  >
                    <Trash2 size={18} /> Request Data Deletion
                  </button>

                  <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-200">
                      💡 <strong>Tip:</strong> Download will save the entire archive. Print will print the currently selected file. Deletion requires admin approval.
                    </p>
                  </div>
                </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Deletion Request Form Modal */}
      {showDeleteForm && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">Request Data Deletion</h3>
            <p className="text-sm text-gray-400 mb-4">
              This archive will be marked for deletion and an admin will review your request. Admins will receive this request in their admin panel.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Archive</label>
                <p className="text-sm text-gray-400 bg-gray-800 p-2 rounded">{archivePath}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Reason for Deletion *</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Please explain why you want this data deleted..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--primary)]"
                  rows={4}
                />
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded p-3">
                <p className="text-xs text-yellow-200">
                  ⚠️ <strong>Important:</strong> An administrator will review your deletion request. This process may take 24-48 hours.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!deleteReason.trim()) {
                      alert('Please provide a reason for deletion')
                      return
                    }

                    try {
                      const res = await fetch('/api/admin/deletion-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          archivePath,
                          reason: deleteReason,
                          requestedAt: new Date().toISOString()
                        })
                      })

                      if (res.ok) {
                        alert('✅ Your deletion request has been submitted. An admin will review it soon.')
                        setShowDeleteForm(false)
                        onClose()
                      } else {
                        alert('❌ Failed to submit deletion request')
                      }
                    } catch (err) {
                      console.error('Deletion request error:', err)
                      alert('❌ Error submitting request')
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
