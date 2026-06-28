export interface JWTPayload {
  userId: number
  email: string
  role: string
  subscriptionType?: string
  isLifetime?: boolean
  fingerprint: string
  type: "access" | "refresh"
  iat?: number
  exp?: number
}

export const JWT_ISSUER = "search-platform"
export const JWT_AUDIENCE = "search-platform-users"

