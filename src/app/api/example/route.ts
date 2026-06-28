/**
 * EXAMPLE API ENDPOINT
 * Demonstrates best practices:
 * - Zod validation
 * - Standardized responses
 * - Error handling
 * - Request logging
 * - Type safety
 * 
 * DELETE THIS FILE - IT'S JUST AN EXAMPLE
 */

import { NextRequest } from "next/server"
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api-response"
import { ApiErrors, withErrorHandler } from "@/lib/error-handler"
import { SearchQuerySchema, validate } from "@/lib/validation-schemas"
import { requireAuth } from "@/lib/middleware"
import { getOrGenerateRequestId } from "@/lib/request-logger"

// Example GET endpoint with pagination
export const GET = withErrorHandler(async (request: NextRequest) => {
  const requestId = getOrGenerateRequestId(request)
  
  // 1. Authenticate user
  const authResult = await requireAuth(request)
  if (!authResult.authorized || !authResult.user) {
    throw ApiErrors.unauthorized()
  }
  const user = authResult.user
  
  // 2. Parse and validate query parameters
  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  const validation = validate(SearchQuerySchema, searchParams)
  
  if (!validation.success) {
    throw ApiErrors.validation(
      "Invalid search parameters",
      validation.errors.errors
    )
  }
  
  const { q, page, pageSize } = validation.data
  
  // 3. Perform business logic
  // ... your database queries here ...
  const results = [
    { id: 1, title: "Result 1" },
    { id: 2, title: "Result 2" }
  ]
  const total = 100
  
  // 4. Return standardized response
  return paginatedResponse(results, page, pageSize, total, { requestId })
})

// Example POST endpoint
export const POST = withErrorHandler(async (request: NextRequest) => {
  const requestId = getOrGenerateRequestId(request)
  
  // 1. Authenticate user
  const authResult = await requireAuth(request)
  if (!authResult.authorized || !authResult.user) {
    throw ApiErrors.unauthorized()
  }
  const user = authResult.user
  
  // 2. Parse request body
  let body
  try {
    body = await request.json()
  } catch {
    throw ApiErrors.validation("Invalid JSON in request body")
  }
  
  // 3. Validate input
  // const validation = validate(YourSchema, body)
  // if (!validation.success) {
  //   throw ApiErrors.validation("Validation failed", validation.errors.errors)
  // }
  
  // 4. Perform business logic
  // ... your database operations here ...
  
  // 5. Return success response
  return successResponse(
    { message: "Created successfully", id: 123 },
    { requestId, status: 201 }
  )
})

// Example error handling
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request)
  if (!authResult.authorized || !authResult.user) {
    throw ApiErrors.unauthorized()
  }
  const user = authResult.user
  
  // Check admin role
  if (user.role !== "admin") {
    throw ApiErrors.forbidden("Only admins can delete resources")
  }
  
  // Example: Resource not found
  const resourceExists = false
  if (!resourceExists) {
    throw ApiErrors.notFound("Resource")
  }
  
  // ... perform deletion ...
  
  return successResponse({ message: "Deleted successfully" })
})


