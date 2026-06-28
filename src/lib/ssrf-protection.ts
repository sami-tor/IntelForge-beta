import { NextRequest } from "next/server"

const BLOCKED_IP_RANGES = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
]

const ALLOWED_PROTOCOLS = ["http:", "https:"]

export function validateUrl(url: string): { valid: boolean; error?: string; parsed?: URL } {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Invalid URL" }
  }

  try {
    const parsed = new URL(url)
    
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: "Protocol not allowed" }
    }
    
    const hostname = parsed.hostname.toLowerCase()
    
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return { valid: false, error: "Localhost not allowed" }
    }
    
    if (hostname.startsWith("169.254.") || hostname.startsWith("10.") || 
        hostname.startsWith("172.16.") || hostname.startsWith("192.168.")) {
      return { valid: false, error: "Private IP range not allowed" }
    }
    
    if (hostname.includes("[") || hostname.includes("]")) {
      return { valid: false, error: "IPv6 not allowed" }
    }
    
    return { valid: true, parsed }
  } catch {
    return { valid: false, error: "Invalid URL format" }
  }
}

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  
  const blocked = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254",
    "metadata.google.internal",
    "169.254.169.254",
  ]
  
  return blocked.includes(lower) || 
         lower.startsWith("10.") ||
         lower.startsWith("172.16.") ||
         lower.startsWith("192.168.") ||
         lower.startsWith("169.254.")
}

