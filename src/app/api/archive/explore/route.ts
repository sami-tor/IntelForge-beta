import { NextRequest, NextResponse } from "next/server"
import AdmZip from "adm-zip"
import path from "path"
import { existsSync } from "fs"
import { promises as fs } from "fs"
import { execFileSync } from "child_process"
import { validateFilePath } from "@/lib/validation"

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  size?: number
}

async function handleArchiveWith7z(fullPath: string, archivePath: string) {
  try {
    const normalizedPath = path.normalize(fullPath)
    if (!path.isAbsolute(normalizedPath)) {
      throw new Error("Path must be absolute")
    }

    const dangerousChars = ['`', '$', ';', '|', '&', '\n', '\r']
    if (dangerousChars.some(char => normalizedPath.includes(char))) {
      throw new Error("Invalid path characters detected")
    }
    
    const tempDir = path.join(process.cwd(), `.temp_archive_${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      execFileSync('7z', ['x', normalizedPath, `-o${tempDir}`, '-y'], { 
        stdio: "pipe",
        timeout: 60000,
        maxBuffer: 50 * 1024 * 1024,
        shell: false
      })
    } catch {
      try {
        const winrarPath = 'C:\\Program Files\\WinRAR\\UnRAR.exe'
        execFileSync(winrarPath, ['x', normalizedPath, tempDir, '-y'], {
          stdio: "pipe",
          timeout: 60000,
          maxBuffer: 50 * 1024 * 1024,
          shell: false
        })
      } catch {
        if (archivePath.toLowerCase().endsWith('.zip')) {
          const psCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${normalizedPath.replace(/'/g, "''")}', '${tempDir.replace(/'/g, "''")}', $true)`
          execFileSync('powershell', ['-NoProfile', '-Command', psCommand], {
            stdio: "pipe",
            timeout: 60000,
            shell: false
          })
        } else {
          throw new Error("Archive extraction not supported")
        }
      }
    }

    // Build tree from extracted files
    const buildTreeFromDir = async (dir: string, prefix = ""): Promise<FileNode> => {
      const name = prefix || path.basename(archivePath)
      const node: FileNode = {
        name,
        path: archivePath,
        isDirectory: true,
        children: []
      }

      const files = await fs.readdir(dir, { withFileTypes: true })
      for (const file of files) {
        const fullFilePath = path.join(dir, file.name)
        const filePath = prefix ? `${prefix}/${file.name}` : file.name

        if (file.isDirectory()) {
          const subNode = await buildTreeFromDir(fullFilePath, filePath)
          if (node.children) node.children.push(subNode)
        } else {
          const stat = await fs.stat(fullFilePath)
          const fileNode: FileNode = {
            name: file.name,
            path: filePath,
            isDirectory: false,
            size: stat.size
          }
          if (node.children) node.children.push(fileNode)
        }
      }

      return node
    }

    const tree = await buildTreeFromDir(tempDir)

    // Extract metadata
    const metadata = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {} as Record<string, number>,
      emails: new Set<string>(),
      phones: new Set<string>(),
      keywords: [] as string[]
    }

    // Walk directory tree and analyze files
    const walkDir = async (dir: string) => {
      const files = await fs.readdir(dir, { withFileTypes: true })
      for (const file of files) {
        const fullFilePath = path.join(dir, file.name)
        
        if (file.isDirectory()) {
          await walkDir(fullFilePath)
        } else {
          metadata.totalFiles++
          const stat = await fs.stat(fullFilePath)
          metadata.totalSize += stat.size

          // Count file types
          const ext = path.extname(file.name).toLowerCase() || "no-extension"
          metadata.fileTypes[ext] = (metadata.fileTypes[ext] || 0) + 1

          // Extract emails and phones from files
          try {
            const content = await fs.readFile(fullFilePath, "utf-8").catch(() => "")
            if (content) {
              const emails = content.match(EMAIL_REGEX) || []
              emails.forEach((email: string) => metadata.emails.add(email.toLowerCase()))

              const phones = content.match(PHONE_REGEX) || []
              phones.forEach((phone: string) => metadata.phones.add(phone))
            }
          } catch {
            // Skip binary files
          }
        }
      }
    }

    await walkDir(tempDir)

    try {
      execFileSync('rmdir', ['/s', '/q', tempDir], { 
        stdio: "pipe",
        shell: false
      })
    } catch {
    }

    return NextResponse.json({
      tree,
      metadata: {
        totalFiles: metadata.totalFiles,
        totalSize: metadata.totalSize,
        fileTypes: metadata.fileTypes,
        emails: Array.from(metadata.emails).slice(0, 100),
        phones: Array.from(metadata.phones).slice(0, 100),
        keywords: metadata.keywords
      }
    })
  } catch (err) {
    console.error("[ARCHIVE] 7z Error:", err)
    return NextResponse.json(
      { error: "Failed to extract archive - ensure 7-Zip or WinRAR is installed" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const archivePath = request.nextUrl.searchParams.get("path")
    
    if (!archivePath) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      )
    }

    // SECURITY: Use validateFilePath to prevent directory traversal attacks
    const dataDir = path.join(process.cwd(), "data")
    const validation = validateFilePath(archivePath, dataDir)
    
    if (!validation.valid || !validation.path) {
      console.error(`[ARCHIVE API] Invalid path: ${archivePath}`)
      return NextResponse.json(
        { error: validation.error || "Invalid archive path" },
        { status: 403 }
      )
    }
    
    const fullPath = validation.path
    if (!existsSync(fullPath)) {
      console.error(`[ARCHIVE API] File not found: ${fullPath}`)
      return NextResponse.json(
        { error: "Archive not found" },
        { status: 404 }
      )
    }

    const fileExt = path.extname(archivePath).toLowerCase()

    // Only support ZIP files in Node.js natively
    if (fileExt !== ".zip") {
      return NextResponse.json(
        { error: `${fileExt} archives require 7-Zip or WinRAR installed` },
        { status: 400 }
      )
    }

    try {
      // Load ZIP archive
      const zip = new AdmZip(fullPath)
      const entries = zip.getEntries()

      // Build tree structure
      const buildTree = (): FileNode => {
        const root: FileNode = {
          name: path.basename(archivePath),
          path: archivePath,
          isDirectory: true,
          children: []
        }

        const pathMap = new Map<string, FileNode>()
        pathMap.set("", root)

        for (const entry of entries) {
          const parts = entry.entryName.split("/").filter((p: string) => p)
          let currentPath = ""

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const parentPath = currentPath
            currentPath = currentPath ? `${currentPath}/${part}` : part

            if (!pathMap.has(currentPath)) {
              const isFile = i === parts.length - 1 && !entry.isDirectory
              const node: FileNode = {
                name: part,
                path: currentPath,
                isDirectory: !isFile,
                children: isFile ? undefined : [],
                size: isFile ? entry.header.size : undefined
              }

              const parent = pathMap.get(parentPath)!
              if (parent.children) {
                parent.children.push(node)
              }
              pathMap.set(currentPath, node)
            }
          }
        }

        return root
      }

      const tree = buildTree()

      // Extract metadata
      const metadata = {
        totalFiles: entries.filter(e => !e.isDirectory).length,
        totalSize: entries.reduce((sum, e) => sum + e.header.size, 0),
        fileTypes: {} as Record<string, number>,
        emails: new Set<string>(),
        phones: new Set<string>(),
        keywords: [] as string[]
      }

      // Analyze files
      for (const entry of entries) {
        if (entry.isDirectory) continue

        // Count file types
        const ext = path.extname(entry.entryName).toLowerCase() || "no-extension"
        metadata.fileTypes[ext] = (metadata.fileTypes[ext] || 0) + 1

        // Extract emails and phones from file names and small files
        try {
          const content = entry.getData().toString("utf-8")

          // Extract emails
          const emails = content.match(EMAIL_REGEX) || []
          emails.forEach((email: string) => metadata.emails.add(email.toLowerCase()))

          // Extract phone numbers
          const phones = content.match(PHONE_REGEX) || []
          phones.forEach((phone: string) => metadata.phones.add(phone))

          // Limit scanning to reasonable size
          if (content.length > 10 * 1024 * 1024) break
        } catch {
          // Skip files that can't be read as text
          continue
        }
      }

      const result = {
        tree,
        metadata: {
          totalFiles: metadata.totalFiles,
          totalSize: metadata.totalSize,
          fileTypes: metadata.fileTypes,
          emails: Array.from(metadata.emails).slice(0, 100),
          phones: Array.from(metadata.phones).slice(0, 100),
          keywords: metadata.keywords
        }
      }


      return NextResponse.json(result)
    } catch (zipErr) {
      console.error(`[ARCHIVE API] ZIP parsing error:`, zipErr)
      return NextResponse.json(
        { error: `Failed to parse ZIP: ${zipErr instanceof Error ? zipErr.message : String(zipErr)}` },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error("[ARCHIVE API] Error:", err)
    return NextResponse.json(
      { error: "Failed to explore archive" },
      { status: 500 }
    )
  }
}
