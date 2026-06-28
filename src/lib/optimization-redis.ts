/**
 * Redis caching layer for search results
 * Provides distributed caching across multiple servers
 */

import Redis from 'ioredis'

let redis: Redis | null = null

// Initialize Redis connection
export function initRedis() {
  if (redis) return redis
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY'
      if (err.message.includes(targetError)) {
        return true // Reconnect on READONLY error
      }
      return false
    }
  })

  redis.on('error', (err) => {
    console.error('[REDIS] Connection error:', err)
  })

  redis.on('connect', () => {
  })

  return redis
}

// Get cached search results
export async function getCachedSearch(query: string, userType: string): Promise<any[] | null> {
  try {
    if (!redis) initRedis()
    const key = `search:${query.toLowerCase()}:${userType}`
    const cached = await redis!.get(key)
    if (cached) {
      return JSON.parse(cached)
    }
    return null
  } catch (error) {
    console.error('[REDIS] Get cache error:', error)
    return null
  }
}

// Set cached search results
export async function setCachedSearch(
  query: string, 
  userType: string, 
  results: any[], 
  ttl: number = 300 // 5 minutes default
): Promise<void> {
  try {
    if (!redis) initRedis()
    const key = `search:${query.toLowerCase()}:${userType}`
    await redis!.setex(key, ttl, JSON.stringify(results))
  } catch (error) {
    console.error('[REDIS] Set cache error:', error)
  }
}

// Invalidate cache for a query
export async function invalidateCache(query: string): Promise<void> {
  try {
    if (!redis) initRedis()
    const pattern = `search:${query.toLowerCase()}:*`
    const keys = await redis!.keys(pattern)
    if (keys.length > 0) {
      await redis!.del(...keys)
    }
  } catch (error) {
    console.error('[REDIS] Invalidate cache error:', error)
  }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  hits: number
  misses: number
  size: number
}> {
  try {
    if (!redis) initRedis()
    const keys = await redis!.keys('search:*')
    return {
      hits: 0, // Would need to track this separately
      misses: 0,
      size: keys.length
    }
  } catch (error) {
    return { hits: 0, misses: 0, size: 0 }
  }
}

