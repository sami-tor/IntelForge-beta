import { NextRequest } from "next/server"

const ALLOWED_REDIRECT_DOMAINS = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "http://localhost:3000",
  "https://localhost:3000",
]

export function validateRedirectUrl(url: string | null, defaultUrl: string = "/"): string {
  if (!url) return defaultUrl
  
  try {
    const parsed = new URL(url, "http://localhost:3000")
    
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return defaultUrl
    }
    
    const origin = `${parsed.protocol}//${parsed.host}`
    const isAllowed = ALLOWED_REDIRECT_DOMAINS.some(domain => origin.startsWith(domain))
    
    if (!isAllowed) {
      return defaultUrl
    }
    
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return parsed.pathname + parsed.search
    }
    
    return url
  } catch {
    return defaultUrl
  }
}

export function getRedirectUrl(request: NextRequest, defaultUrl: string = "/"): string {
  const redirectParam = request.nextUrl.searchParams.get("redirect") || 
                       request.nextUrl.searchParams.get("returnUrl") ||
                       request.nextUrl.searchParams.get("return_to")
  
  return validateRedirectUrl(redirectParam, defaultUrl)
}

