/**
 * API Security Configuration
 * 
 * Control who can access the search API and how
 */

export interface ApiSecurityConfig {
  requireApiKeyForAll: boolean        // If true, ALL requests need API key (even web users)
  allowAnonymousSearch: boolean       // If true, anonymous users can search (with limits)
  allowWebSessionSearch: boolean      // If true, logged-in web users can search without API key
  anonymousResultLimit: number        // Max results for anonymous users
  anonymousBlurAll: boolean          // Blur all results for anonymous users
}

/**
 * DEFAULT SECURITY CONFIGURATION
 * 
 * Current settings (BALANCED):
 * - Website users (logged in OR anonymous with temp session) = ALLOW
 * - Direct API calls without key = BLOCK
 * - API calls with valid key = ALLOW
 */
export const API_SECURITY_CONFIG: ApiSecurityConfig = {
  // ⚠️ Set to TRUE to require API key for ALL requests (even logged-in web users)
  requireApiKeyForAll: false,
  
  // ✅ Allow anonymous WEBSITE users (with 10-min temp session, blurred results)
  allowAnonymousSearch: true,
  
  // ✅ Allow logged-in web users to search without API key
  allowWebSessionSearch: true,
  
  // Limits for anonymous users
  anonymousResultLimit: 10,
  anonymousBlurAll: true,
}

/**
 * Check if a request is allowed based on security config
 */
export function isRequestAllowed(
  hasApiKey: boolean,
  hasSession: boolean,
  isAnonymous: boolean
): { allowed: boolean; reason?: string } {
  
  // If API key is required for ALL requests
  if (API_SECURITY_CONFIG.requireApiKeyForAll) {
    if (!hasApiKey) {
      return { 
        allowed: false, 
        reason: "API key required. Please provide a valid API key in the Authorization header." 
      }
    }
    return { allowed: true }
  }
  
  // If user has API key, always allow
  if (hasApiKey) {
    return { allowed: true }
  }
  
  // If user has session (logged in on web)
  if (hasSession && API_SECURITY_CONFIG.allowWebSessionSearch) {
    return { allowed: true }
  }
  
  // If user is anonymous
  if (isAnonymous) {
    if (!API_SECURITY_CONFIG.allowAnonymousSearch) {
      return { 
        allowed: false, 
        reason: "Authentication required. Please log in or provide an API key." 
      }
    }
    return { allowed: true }
  }
  
  // Default: deny
  return { 
    allowed: false, 
    reason: "Authentication required. Please log in or provide an API key." 
  }
}

/**
 * PRESET CONFIGURATIONS
 */

// Most Secure: API key required for everyone
export const SECURITY_PRESET_MAXIMUM: ApiSecurityConfig = {
  requireApiKeyForAll: true,
  allowAnonymousSearch: false,
  allowWebSessionSearch: false,
  anonymousResultLimit: 0,
  anonymousBlurAll: true,
}

// Balanced: Logged-in users can search, anonymous blocked
export const SECURITY_PRESET_BALANCED: ApiSecurityConfig = {
  requireApiKeyForAll: false,
  allowAnonymousSearch: false,
  allowWebSessionSearch: true,
  anonymousResultLimit: 10,
  anonymousBlurAll: true,
}

// Least Secure: Everyone can search (with limits)
export const SECURITY_PRESET_OPEN: ApiSecurityConfig = {
  requireApiKeyForAll: false,
  allowAnonymousSearch: true,
  allowWebSessionSearch: true,
  anonymousResultLimit: 10,
  anonymousBlurAll: true,
}

