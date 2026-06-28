import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAuth, requireAdmin, createAuthResponse } from "@/lib/middleware"

interface DeletionRequest {
  id: string
  archivePath: string
  reason: string
  requestedAt: string
  requestedBy: string
  status: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
}

const REQUESTS_FILE = path.join(process.cwd(), 'data', '.deletion-requests.json')

async function readRequests(): Promise<DeletionRequest[]> {
  try {
    const content = await fs.readFile(REQUESTS_FILE, 'utf-8')
    const { safeJsonParse } = await import("@/lib/safe-json")
    return safeJsonParse<DeletionRequest[]>(content, []) || []
  } catch {
    return []
  }
}

async function writeRequests(requests: DeletionRequest[]): Promise<void> {
  await fs.mkdir(path.dirname(REQUESTS_FILE), { recursive: true })
  await fs.writeFile(REQUESTS_FILE, JSON.stringify(requests, null, 2))
}

export async function GET(request: NextRequest) {
  try {
    const requests = await readRequests()
    return NextResponse.json({ requests })
  } catch (err) {
    console.error('[DELETION] Error reading requests:', err)
    return NextResponse.json(
      { error: 'Failed to read deletion requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication for deletion requests
    const authResult = await requireAuth(request)
    if (!authResult.authorized) {
      return createAuthResponse(authResult.error!, authResult.status!)
    }
    
    const { archivePath, reason } = await request.json()

    if (!archivePath || !reason) {
      return NextResponse.json(
        { error: 'Missing archivePath or reason' },
        { status: 400 }
      )
    }
    
    const { validateFilePath } = await import("@/lib/validation")
    const dataDir = path.join(process.cwd(), 'data')
    const validation = validateFilePath(archivePath, dataDir)
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid archive path' },
        { status: 400 }
      )
    }

    const requests = await readRequests()
    
    const newRequest: DeletionRequest = {
      id: Date.now().toString(),
      archivePath,
      reason,
      requestedAt: new Date().toISOString(),
      requestedBy: authResult.user.id.toString(), // SECURITY: Use authenticated user ID
      status: 'pending'
    }

    requests.push(newRequest)
    await writeRequests(requests)

    return NextResponse.json({
      success: true,
      message: 'Deletion request submitted successfully',
      requestId: newRequest.id
    })
  } catch (err) {
    // SECURITY: Don't log detailed errors in production
    if (process.env.NODE_ENV === "development") {
      console.error('[DELETION] Error submitting request:', err)
    }
    return NextResponse.json(
      { error: 'Failed to submit deletion request' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // SECURITY: Require admin authentication
  const authResult = await requireAdmin(request)
  if (!authResult.authorized) {
    return createAuthResponse(authResult.error!, authResult.status!)
  }

  const body = await request.json()
  const { requireCSRF, createCSRFResponse } = await import("@/lib/csrf")
  const csrfResult = await requireCSRF(request, body.csrfToken)
  if (!csrfResult.authorized) {
    return createCSRFResponse(csrfResult.error || "CSRF validation failed", csrfResult.status || 403)
  }
  
  try {
    const { requestId, status, adminNotes } = body

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Missing requestId or status' },
        { status: 400 }
      )
    }
    
    // SECURITY: Validate status value
    const validStatuses = ['pending', 'approved', 'rejected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const requests = await readRequests()
    const requestIndex = requests.findIndex(r => r.id === requestId)

    if (requestIndex === -1) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    requests[requestIndex].status = status
    if (adminNotes) {
      requests[requestIndex].adminNotes = adminNotes
    }

    // If approved, delete the archive file
    if (status === 'approved') {
      try {
        const archivePath = requests[requestIndex].archivePath
        const { validateFilePath } = await import("@/lib/validation")
        const dataDir = path.join(process.cwd(), 'data')
        const validation = validateFilePath(archivePath, dataDir)
        
        if (!validation.valid || !validation.path) {
          if (process.env.NODE_ENV === "development") {
            console.error(`[DELETION] Invalid archive path: ${archivePath}`)
          }
          return NextResponse.json(
            { error: validation.error || 'Invalid archive path' },
            { status: 403 }
          )
        }
        
        const fullPath = validation.path
        
        await fs.unlink(fullPath)
      } catch (err) {
        console.error(`[DELETION] Failed to delete archive:`, err)
      }
    }

    await writeRequests(requests)

    return NextResponse.json({
      success: true,
      message: `Deletion request ${status} successfully`
    })
  } catch (err) {
    console.error('[DELETION] Error updating request:', err)
    return NextResponse.json(
      { error: 'Failed to update deletion request' },
      { status: 500 }
    )
  }
}
