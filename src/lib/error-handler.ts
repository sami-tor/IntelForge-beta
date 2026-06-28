import { NextResponse } from "next/server"

/**
 * Centralized Error Handling
 * Provides consistent error responses and logging
 */

export interface ApiError {
  code: string
  message: string
  details?: any
  status: number
}

// Common error codes
export const ErrorCodes = {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  
  // Validation (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  
  // Resources (404, 409)
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  
  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  
  // Server Errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  
  // CSRF (403)
  CSRF_TOKEN_INVALID: "CSRF_TOKEN_INVALID",
  CSRF_TOKEN_MISSING: "CSRF_TOKEN_MISSING",
} as const

/**
 * Standard API error class
 */
export class ApiErrorClass extends Error {
  code: string
  status: number
  details?: any
  
  constructor(code: string, message: string, status: number = 500, details?: any) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
  }
}

/**
 * Create common API errors
 */
export const ApiErrors = {
  unauthorized: (message = "Authentication required") =>
    new ApiErrorClass(ErrorCodes.UNAUTHORIZED, message, 401),
  
  forbidden: (message = "Access denied") =>
    new ApiErrorClass(ErrorCodes.FORBIDDEN, message, 403),
  
  notFound: (resource = "Resource", message?: string) =>
    new ApiErrorClass(ErrorCodes.NOT_FOUND, message || `${resource} not found`, 404),
  
  validation: (message: string, details?: any) =>
    new ApiErrorClass(ErrorCodes.VALIDATION_ERROR, message, 400, details),
  
  rateLimit: (message = "Too many requests. Please try again later.") =>
    new ApiErrorClass(ErrorCodes.RATE_LIMIT_EXCEEDED, message, 429),
  
  quotaExceeded: (message = "Search quota exceeded") =>
    new ApiErrorClass(ErrorCodes.QUOTA_EXCEEDED, message, 429),
  
  internal: (message = "Internal server error") =>
    new ApiErrorClass(ErrorCodes.INTERNAL_ERROR, message, 500),
  
  database: (message = "Database operation failed") =>
    new ApiErrorClass(ErrorCodes.DATABASE_ERROR, message, 500),
  
  conflict: (message: string) =>
    new ApiErrorClass(ErrorCodes.CONFLICT, message, 409),
  
  csrfInvalid: (message = "Invalid CSRF token") =>
    new ApiErrorClass(ErrorCodes.CSRF_TOKEN_INVALID, message, 403),
}

/**
 * Handle errors and return appropriate response
 */
export function handleApiError(error: unknown): NextResponse {
  // Log error for debugging (sanitize in production)
  const shouldLog = process.env.NODE_ENV === "development"
  
  if (error instanceof ApiErrorClass) {
    // Known API error
    if (shouldLog) {
      console.error(`[API ERROR] ${error.code}:`, error.message, error.details)
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details })
        }
      },
      {
        status: error.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    )
  }
  
  // Unknown error - log full error in development
  if (shouldLog && error instanceof Error) {
    console.error("[UNEXPECTED ERROR]", error.stack || error.message)
  } else if (shouldLog) {
    console.error("[UNEXPECTED ERROR]", error)
  }
  
  // Return generic error in production
  return NextResponse.json(
    {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: process.env.NODE_ENV === "production" 
          ? "An unexpected error occurred" 
          : error instanceof Error ? error.message : "Unknown error"
      }
    },
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  )
}

/**
 * Async error wrapper for API routes
 * Automatically catches and handles errors
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter(field => !data[field])
  
  if (missing.length > 0) {
    throw new ApiErrorClass(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `Missing required fields: ${missing.join(", ")}`,
      400,
      { missing }
    )
  }
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: ApiErrorClass | string,
  status = 400
): asserts condition {
  if (!condition) {
    if (typeof error === "string") {
      throw new ApiErrorClass(ErrorCodes.VALIDATION_ERROR, error, status)
    }
    throw error
  }
}


