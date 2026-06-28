import { NextResponse } from "next/server"

/**
 * Standardized API Response Format
 * Ensures all API endpoints return consistent response structure
 */

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  meta?: {
    timestamp: string
    requestId?: string
    pagination?: {
      page: number
      pageSize: number
      total: number
      hasMore: boolean
    }
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId?: string
  }
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create success response
 */
export function successResponse<T>(
  data: T,
  options?: {
    requestId?: string
    pagination?: {
      page: number
      pageSize: number
      total: number
    }
    status?: number
    headers?: Record<string, string>
  }
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(options?.requestId && { requestId: options.requestId }),
      ...(options?.pagination && {
        pagination: {
          ...options.pagination,
          hasMore: options.pagination.page * options.pagination.pageSize < options.pagination.total
        }
      })
    }
  }

  return NextResponse.json(response, {
    status: options?.status || 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...options?.headers
    }
  })
}

/**
 * Create error response
 */
export function errorResponse(
  code: string,
  message: string,
  options?: {
    details?: any
    requestId?: string
    status?: number
    headers?: Record<string, string>
  }
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(options?.details && { details: options.details })
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(options?.requestId && { requestId: options.requestId })
    }
  }

  return NextResponse.json(response, {
    status: options?.status || 500,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...options?.headers
    }
  })
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  options?: {
    requestId?: string
    status?: number
    headers?: Record<string, string>
  }
): NextResponse<ApiSuccessResponse<T[]>> {
  return successResponse(data, {
    ...options,
    pagination: {
      page,
      pageSize,
      total
    }
  })
}

/**
 * Create no content response (204)
 */
export function noContentResponse(headers?: Record<string, string>): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  })
}

/**
 * Create created response (201)
 */
export function createdResponse<T>(
  data: T,
  options?: {
    requestId?: string
    location?: string
    headers?: Record<string, string>
  }
): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, {
    ...options,
    status: 201,
    headers: {
      ...(options?.location && { Location: options.location }),
      ...options?.headers
    }
  })
}


