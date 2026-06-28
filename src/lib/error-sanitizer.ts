/**
 * SECURITY: Error Message Sanitization
 * Converts database errors and technical messages into user-friendly messages
 * Prevents information disclosure about database structure, constraints, etc.
 */

export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return "An error occurred. Please try again."
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  // Database constraint violations
  if (errorString.includes("duplicate key") || errorString.includes("unique constraint")) {
    if (errorString.includes("username") || errorString.includes("users_username_key")) {
      return "This username is already taken. Please choose a different one."
    }
    if (errorString.includes("email") || errorString.includes("users_email_key")) {
      return "This email is already registered. Please use a different email or try logging in."
    }
    return "This information is already in use. Please try a different value."
  }

  // Foreign key violations
  if (errorString.includes("foreign key") || errorString.includes("violates foreign key")) {
    return "Invalid reference. Please check your input and try again."
  }

  // Not null violations
  if (errorString.includes("not null") || errorString.includes("null value")) {
    return "Required information is missing. Please fill in all required fields."
  }

  // Check constraint violations
  if (errorString.includes("check constraint") || errorString.includes("violates check")) {
    return "Invalid value provided. Please check your input and try again."
  }

  // Connection errors
  if (errorString.includes("connection") || errorString.includes("timeout") || errorString.includes("econnrefused")) {
    return "Unable to connect to the server. Please try again later."
  }

  // SQL syntax errors (shouldn't happen, but just in case)
  if (errorString.includes("syntax error") || errorString.includes("sql")) {
    console.error("[SECURITY] SQL error exposed:", errorMessage)
    return "An error occurred processing your request. Please try again."
  }

  // Generic database errors
  if (errorString.includes("database") || errorString.includes("postgres") || errorString.includes("pq:")) {
    console.error("[SECURITY] Database error exposed:", errorMessage)
    return "An error occurred. Please try again later."
  }

  // Default: return generic message for unknown errors
  // Log the actual error server-side for debugging
  console.error("[ERROR] Unhandled error:", errorMessage)
  return "An unexpected error occurred. Please try again."
}

/**
 * Check if error is a database constraint violation
 */
export function isConstraintError(error: any): boolean {
  if (!error) return false
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()
  
  return (
    errorString.includes("duplicate key") ||
    errorString.includes("unique constraint") ||
    errorString.includes("foreign key") ||
    errorString.includes("check constraint") ||
    errorString.includes("not null")
  )
}

