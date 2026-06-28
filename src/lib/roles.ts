/**
 * Role and Subscription Management
 * 
 * ROLE HIERARCHY:
 * 1. Admin - Full access to everything
 * 2. Premium Users - API access, unlimited searches
 * 3. Free Users - Limited access
 */

export type UserRole = "admin" | "user"

export type SubscriptionType = 
  | "free" 
  | "starter" 
  | "professional" 
  | "enterprise" 
  | "api_access"

export interface UserPermissions {
  canAccessAdmin: boolean
  canUseAPI: boolean
  canGenerateAPIKeys: boolean
  hasUnlimitedSearch: boolean
  searchLimit: number
  canAccessPremiumData: boolean
  displayRole: string
  displaySubscription: string
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: any): boolean {
  return user?.role === "admin"
}

/**
 * Check if user has premium subscription (any paid tier)
 */
export function isPremiumUser(user: any): boolean {
  if (!user) return false
  
  // Admin always has premium access
  if (isAdmin(user)) return true
  
  // Check subscription type
  const subType = (user.subscriptionType || user.subscription_type || "").toLowerCase()
  const premiumTypes = ["starter", "professional", "enterprise", "api_access"]
  
  return premiumTypes.includes(subType) || user.isLifetime === true
}

/**
 * Check if user can generate API keys
 */
export function canGenerateAPIKeys(user: any): boolean {
  if (!user) return false
  
  // Admin can always generate API keys
  if (isAdmin(user)) return true
  
  // Premium users can generate API keys
  return isPremiumUser(user)
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdminPanel(user: any): boolean {
  return isAdmin(user)
}

/**
 * Check if user has unlimited searches
 */
export function hasUnlimitedSearch(user: any): boolean {
  if (!user) return false
  
  // Admin always has unlimited
  if (isAdmin(user)) return true
  
  // Lifetime or enterprise users
  if (user.isLifetime === true) return true
  
  const subType = (user.subscriptionType || user.subscription_type || "").toLowerCase()
  return subType === "enterprise" || subType === "api_access"
}

/**
 * Get search limit for user
 */
export function getSearchLimit(user: any): number {
  if (!user) return 50 // Anonymous/Free default
  
  // Admin has unlimited
  if (isAdmin(user)) return -1 // -1 = unlimited
  
  // Check user's search_limit field first
  if (user.searchLimit !== undefined) return user.searchLimit
  if (user.search_limit !== undefined) return user.search_limit
  
  // Check subscription type
  const subType = (user.subscriptionType || user.subscription_type || "").toLowerCase()
  
  switch (subType) {
    case "enterprise":
    case "api_access":
      return -1 // Unlimited
    case "professional":
      return 1500
    case "starter":
      return 500
    case "free":
    default:
      return 50
  }
}

/**
 * Get user's display role
 */
export function getDisplayRole(user: any): string {
  if (!user) return "Guest"
  
  if (isAdmin(user)) return "Administrator"
  
  if (isPremiumUser(user)) return "Premium User"
  
  return "Free User"
}

/**
 * Get user's display subscription
 */
export function getDisplaySubscription(user: any): string {
  if (!user) return "None"
  
  // Admin special display
  if (isAdmin(user)) return "admin_access"
  
  const subType = (user.subscriptionType || user.subscription_type || "").toLowerCase()
  
  // Map internal names to display names
  switch (subType) {
    case "api_access":
      return "api_access"
    case "enterprise":
      return "Enterprise"
    case "professional":
      return "Professional"
    case "starter":
      return "Starter"
    case "free":
    default:
      return "Free"
  }
}

/**
 * Get comprehensive user permissions
 */
export function getUserPermissions(user: any): UserPermissions {
  const admin = isAdmin(user)
  const premium = isPremiumUser(user)
  
  return {
    canAccessAdmin: admin,
    canUseAPI: admin || premium,
    canGenerateAPIKeys: admin || premium,
    hasUnlimitedSearch: hasUnlimitedSearch(user),
    searchLimit: getSearchLimit(user),
    canAccessPremiumData: admin || premium,
    displayRole: getDisplayRole(user),
    displaySubscription: getDisplaySubscription(user),
  }
}

/**
 * Validate if user can perform action
 */
export function canPerformAction(user: any, action: string): boolean {
  const permissions = getUserPermissions(user)
  
  switch (action) {
    case "access_admin":
      return permissions.canAccessAdmin
    case "use_api":
      return permissions.canUseAPI
    case "generate_api_key":
      return permissions.canGenerateAPIKeys
    case "access_premium_data":
      return permissions.canAccessPremiumData
    default:
      return false
  }
}

