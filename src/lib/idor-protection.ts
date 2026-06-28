import { query } from "./db"

/**
 * SECURITY: IDOR Protection
 * Verifies that a user owns or has access to a resource before allowing access
 */

export async function verifyResourceOwnership(
  userId: number,
  resourceType: "api_key" | "search_history" | "login_activity" | "profile",
  resourceId: number | string
): Promise<{ authorized: boolean; error?: string }> {
  try {
    switch (resourceType) {
      case "api_key":
        const keyResult = await query(
          "SELECT user_id FROM api_keys WHERE id = $1 AND user_id = $2",
          [resourceId, userId]
        )
        if (!keyResult.success || !keyResult.data || keyResult.data.length === 0) {
          return { authorized: false, error: "API key not found or access denied" }
        }
        break

      case "search_history":
        const historyResult = await query(
          "SELECT user_id FROM search_history WHERE id = $1 AND user_id = $2",
          [resourceId, userId]
        )
        if (!historyResult.success || !historyResult.data || historyResult.data.length === 0) {
          return { authorized: false, error: "Search history not found or access denied" }
        }
        break

      case "login_activity":
        const activityResult = await query(
          "SELECT user_id FROM login_activity WHERE id = $1 AND user_id = $2",
          [resourceId, userId]
        )
        if (!activityResult.success || !activityResult.data || activityResult.data.length === 0) {
          return { authorized: false, error: "Login activity not found or access denied" }
        }
        break

      case "profile":
        // Profile is always owned by the user themselves
        if (Number(resourceId) !== userId) {
          return { authorized: false, error: "Access denied" }
        }
        break

      default:
        return { authorized: false, error: "Invalid resource type" }
    }

    return { authorized: true }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[IDOR] Verification error:", error)
    }
    return { authorized: false, error: "Verification failed" }
  }
}

/**
 * SECURITY: Verify user has permission to access another user's resource
 * Only admins can access other users' resources
 */
export async function verifyResourceAccess(
  requesterUserId: number,
  requesterRole: string,
  resourceUserId: number,
  resourceType: string
): Promise<{ authorized: boolean; error?: string }> {
  // User can always access their own resources
  if (requesterUserId === resourceUserId) {
    return { authorized: true }
  }

  // Only admins can access other users' resources
  if (requesterRole !== "admin") {
    return { authorized: false, error: "Access denied: Insufficient permissions" }
  }

  return { authorized: true }
}

