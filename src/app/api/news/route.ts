import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAdmin, createAuthResponse } from "@/lib/middleware"

interface NewsItem {
  id: string
  title: string
  description: string
  image?: string
  createdAt: string
  author?: string
}

const NEWS_FILE = path.join(process.cwd(), 'data', '.news.json')

async function readNews(): Promise<NewsItem[]> {
  try {
    const content = await fs.readFile(NEWS_FILE, 'utf-8')
    const { safeJsonParse } = await import("@/lib/safe-json")
    const news = safeJsonParse<NewsItem[]>(content, []) || []
    return news.sort((a: NewsItem, b: NewsItem) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch {
    return []
  }
}

async function writeNews(news: NewsItem[]): Promise<void> {
  await fs.mkdir(path.dirname(NEWS_FILE), { recursive: true })
  await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 2))
}

export async function GET() {
  try {
    const news = await readNews()
    return NextResponse.json({ news })
  } catch (err) {
    console.error('[NEWS] Error reading:', err)
    return NextResponse.json({ error: 'Failed to read news' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const { title, description, image, author } = await request.json()

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing title or description' },
        { status: 400 }
      )
    }

    const news = await readNews()
    
    const newPost: NewsItem = {
      id: Date.now().toString(),
      title,
      description,
      image: image || undefined,
      createdAt: new Date().toISOString(),
      author: author || 'Admin'
    }

    news.unshift(newPost)
    await writeNews(news)

    return NextResponse.json({
      success: true,
      message: 'News posted successfully',
      post: newPost
    })
  } catch (err) {
    console.error('[NEWS] Error creating:', err)
    return NextResponse.json(
      { error: 'Failed to create news post' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if user is admin
    const authResult = await requireAdmin(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error || "Admin access required", authResult.status || 403)
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Missing news ID' },
        { status: 400 }
      )
    }

    let news = await readNews()
    news = news.filter((item: NewsItem) => item.id !== id)
    await writeNews(news)

    return NextResponse.json({
      success: true,
      message: 'News deleted successfully'
    })
  } catch (err) {
    console.error('[NEWS] Error deleting:', err)
    return NextResponse.json(
      { error: 'Failed to delete news' },
      { status: 500 }
    )
  }
}
