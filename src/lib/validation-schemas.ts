import { z } from "zod"

/**
 * Zod Validation Schemas
 * Centralized validation for all API endpoints
 */

// ============================================
// 1. AUTHENTICATION SCHEMAS
// ============================================

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters")
})

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, - and _"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[a-z]/, "Password must contain lowercase letters")
    .regex(/[A-Z]/, "Password must contain uppercase letters")
    .regex(/\d/, "Password must contain numbers")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain special characters")
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[a-z]/, "Password must contain lowercase letters")
    .regex(/[A-Z]/, "Password must contain uppercase letters")
    .regex(/\d/, "Password must contain numbers")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain special characters")
})

// ============================================
// 2. SEARCH SCHEMAS
// ============================================

export const SearchQuerySchema = z.object({
  q: z.string()
    .min(5, "Query must be at least 5 characters")
    .max(500, "Query must be at most 500 characters")
    .trim(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  fileType: z.string().optional()
})

export const FilePreviewSchema = z.object({
  path: z.string().min(1, "File path is required"),
  query: z.string().optional(),
  line: z.coerce.number().int().min(1).optional(),
  context: z.coerce.number().int().min(0).max(100).default(10)
})

// ============================================
// 3. USER MANAGEMENT SCHEMAS
// ============================================

export const UpdateProfileSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, - and _")
    .optional(),
  email: z.string().email("Invalid email address").max(255).optional()
})

export const UpdateUserSchema = z.object({
  action: z.enum(["role", "verification", "status", "subscription"]),
  userId: z.coerce.number().int().positive(),
  value: z.union([z.string(), z.boolean(), z.number()]).optional(),
  subscription_type: z.string().optional(),
  subscription_duration_value: z.coerce.number().int().positive().optional(),
  subscription_duration_unit: z.enum(["days", "months", "years"]).optional(),
  is_lifetime: z.boolean().optional()
})

// ============================================
// 4. ADMIN SCHEMAS
// ============================================

export const CreateApiKeySchema = z.object({
  label: z.string()
    .min(1, "Label is required")
    .max(150, "Label must be at most 150 characters"),
  allowedIps: z.array(z.string().ip()).optional()
})

export const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0),
  duration_value: z.coerce.number().int().positive().optional(),
  duration_unit: z.enum(["days", "months", "years"]).optional(),
  is_lifetime: z.boolean().default(false),
  search_limit: z.coerce.number().int().min(0).default(50),
  is_active: z.boolean().default(true)
})

export const ContactMessageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000)
})

export const AuditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  eventType: z.string().optional(),
  userId: z.coerce.number().int().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// ============================================
// 5. PAGINATION & QUERY SCHEMAS
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

export const StringIdParamSchema = z.object({
  id: z.string().min(1)
})

// ============================================
// 6. FILE UPLOAD SCHEMAS
// ============================================

export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(500 * 1024 * 1024), // Max 500MB
  fileType: z.string().max(100)
})

// ============================================
// 7. UTILITY FUNCTIONS
// ============================================

/**
 * Validate data against a schema and return typed result
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error }
}

/**
 * Validate or throw error
 */
export function validateOrThrow<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data)
}

/**
 * Get formatted error messages from Zod error
 */
export function getErrorMessages(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.join(".")
    return path ? `${path}: ${err.message}` : err.message
  })
}

/**
 * Get first error message from Zod error
 */
export function getFirstErrorMessage(error: z.ZodError): string {
  const messages = getErrorMessages(error)
  return messages[0] || "Validation error"
}


