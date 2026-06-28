'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Trash2, Plus } from 'lucide-react'
import { AdminProtected } from '@/components/admin-protected'

interface NewsItem {
  id: string
  title: string
  description: string
  image?: string
  createdAt: string
  author?: string
}

function AdminNewsPageContent() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: '',
    author: 'Admin'
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchNews()
  }, [])

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news')
      const data = await res.json()
      setNews(data.news || [])
    } catch (err) {
      console.error('Failed to fetch news:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setFormData({ title: '', description: '', image: '', author: 'Admin' })
        setShowForm(false)
        await fetchNews()
        alert('✅ News posted successfully!')
      } else {
        alert('❌ Failed to post news')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('❌ Error posting news')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this news?')) return

    try {
      const res = await fetch('/api/news', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        await fetchNews()
        alert('✅ News deleted successfully!')
      } else {
        alert('❌ Failed to delete news')
      }
    } catch (err) {
      console.error('Error:', err)
      alert('❌ Error deleting news')
    }
  }

  return (
    <div className="min-h-screen bg-[#0b090f] text-zinc-100 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">📰 Manage News</h1>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-[var(--primary)] hover:brightness-110 flex items-center gap-2"
          >
            <Plus size={16} />
            Create News
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">✍️ Create News Post</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter news title"
                  className="bg-gray-800 border-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter news description"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[var(--primary)]"
                  rows={5}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Image URL (optional)</label>
                <Input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Author</label>
                <Input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="Author name"
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post News'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* News List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">📋 All News Posts</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No news posts yet. Create your first post!
            </div>
          ) : (
            <div className="space-y-4">
              {news.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-400 mb-2">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} · By {item.author}
                      </p>
                      <p className="text-sm text-gray-300 mb-2 line-clamp-2">{item.description}</p>
                      {item.image && (
                        <p className="text-xs text-gray-500">🖼️ Image attached</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                      title="Delete news"
                    >
                      <Trash2 size={18} />
                    </button>
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

export default function AdminNewsPage() {
  return (
    <AdminProtected>
      <AdminNewsPageContent />
    </AdminProtected>
  )
}
