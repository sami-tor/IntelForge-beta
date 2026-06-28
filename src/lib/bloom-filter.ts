/**
 * Bloom Filter implementation for fast "not found" detection
 * Skips files that definitely don't contain the search term
 */

interface BloomFilterData {
  size: number
  hashCount: number
  bitArray: number[]
}

export class BloomFilter {
  private size: number
  private hashCount: number
  private bitArray: number[]

  constructor(size: number = 1000000, hashCount: number = 3) {
    this.size = size
    this.hashCount = hashCount
    this.bitArray = new Array(size).fill(0)
  }

  // Add item to bloom filter
  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = this.hash(item, i)
      const index = hash % this.size
      this.bitArray[index] = 1
    }
  }

  // Check if item might exist (false positives possible, but no false negatives)
  has(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = this.hash(item, i)
      const index = hash % this.size
      if (this.bitArray[index] === 0) {
        return false // Definitely not in set
      }
    }
    return true // Might be in set
  }

  // Hash function
  private hash(str: string, seed: number): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char + seed
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  // Serialize for storage
  serialize(): BloomFilterData {
    return {
      size: this.size,
      hashCount: this.hashCount,
      bitArray: this.bitArray
    }
  }

  // Deserialize from storage
  static deserialize(data: BloomFilterData): BloomFilter {
    const filter = new BloomFilter(data.size, data.hashCount)
    filter.bitArray = data.bitArray
    return filter
  }
}

// File-level bloom filter cache
const fileBloomFilters = new Map<string, BloomFilter>()

// Get or create bloom filter for a file
export async function getFileBloomFilter(filePath: string): Promise<BloomFilter | null> {
  // Check cache first
  if (fileBloomFilters.has(filePath)) {
    return fileBloomFilters.get(filePath)!
  }

  // In production, load from database or file system
  // For now, return null (file needs to be indexed)
  return null
}

// Check if file might contain query (using bloom filter)
export async function fileMightContain(filePath: string, query: string): Promise<boolean> {
  const filter = await getFileBloomFilter(filePath)
  if (!filter) {
    return true // If no filter, assume it might contain (search the file)
  }
  return filter.has(query.toLowerCase())
}

