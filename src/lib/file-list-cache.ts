// Cache for file list to avoid scanning directory on every search
const fileListCache = new Map<string, { files: any[], timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getCachedFileList(
  dataDir: string,
  findAllFiles: (dir: string) => Promise<string[]>
): Promise<any[]> {
  const cacheKey = dataDir
  const cached = fileListCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.files
  }
  
  // Scan directory and cache result
  const allFiles = await findAllFiles(dataDir)
  fileListCache.set(cacheKey, {
    files: allFiles,
    timestamp: Date.now()
  })
  
  return allFiles
}

export function invalidateFileListCache(dataDir?: string) {
  if (dataDir) {
    fileListCache.delete(dataDir)
  } else {
    fileListCache.clear()
  }
}


