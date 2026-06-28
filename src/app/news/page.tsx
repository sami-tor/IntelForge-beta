"use client"

import { useState, useEffect } from "react"
import { Loader2, Calendar, User, X, ExternalLink } from "lucide-react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"

interface NewsItem {
  id: string
  title: string
  description: string
  image?: string
  createdAt: string
  author?: string
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news")
        const data = await res.json()
        setNews(data.news || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <div className="pt-16 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-14 mt-8">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
              Platform Updates
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-3">Latest News</h1>
            <p className="text-zinc-500 text-sm max-w-md">
              Announcements, features, and updates from the IntelForge team
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📰</span>
              </div>
              <p className="text-zinc-500 text-sm">No news posted yet. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {news.map((item) => (
                <article key={item.id}
                  className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden hover:border-zinc-700/60 transition-all duration-300">
                  {item.image && (
                    <div className="relative w-full h-48 bg-zinc-900 overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                  <div className="p-7">
                    <h2 className="text-lg font-bold text-zinc-100 mb-4 group-hover:text-white transition-colors">{item.title}</h2>
                    <div className="flex items-center gap-4 text-xs text-zinc-600 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                      {item.author && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {item.author}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3">{item.description}</p>
                    <button onClick={() => setSelectedNews(item)}
                      className="mt-5 flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors">
                      Read More <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedNews && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNews(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-5 flex items-center justify-between z-10">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Article</span>
              <button onClick={() => setSelectedNews(null)} aria-label="Close"
                className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedNews.image && (
              <div className="relative w-full h-64 bg-zinc-900 overflow-hidden">
                <img src={selectedNews.image} alt={selectedNews.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-8">
              <h2 className="text-2xl font-bold text-zinc-100 mb-4">{selectedNews.title}</h2>
              <div className="flex items-center gap-4 text-xs text-zinc-600 mb-6 pb-5 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(selectedNews.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                {selectedNews.author && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {selectedNews.author}
                  </div>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{selectedNews.description}</p>
              <div className="mt-8 pt-5 border-t border-zinc-800">
                <Button onClick={() => setSelectedNews(null)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 h-10 rounded-xl border border-zinc-700">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  )
}
