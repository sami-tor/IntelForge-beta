import { jwtVerify } from "jose"
import { ACCESS_SECRET, REFRESH_SECRET } from "./jwt-constants"
import { JWT_AUDIENCE, JWT_ISSUER, type JWTPayload } from "./jwt-types"

const encoder = new TextEncoder()
const accessSecretKey = encoder.encode(ACCESS_SECRET)
const refreshSecretKey = encoder.encode(REFRESH_SECRET)

export async function verifyAccessTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecretKey, {
      algorithms: ["HS512"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    if (payload.type !== "access") {
      return null
    }

    return {
      userId: Number(payload.userId),
      email: String(payload.email),
      role: String(payload.role),
      subscriptionType: payload.subscriptionType as string | undefined,
      isLifetime: payload.isLifetime as boolean | undefined,
      fingerprint: String(payload.fingerprint || ""),
      type: payload.type as "access" | "refresh",
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Edge JWT] Failed to verify access token:", error)
    }
    return null
  }
}

export async function verifyRefreshTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecretKey, {
      algorithms: ["HS512"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    if (payload.type !== "refresh") {
      return null
    }

    return {
      userId: Number(payload.userId),
      email: String(payload.email),
      role: String(payload.role),
      subscriptionType: payload.subscriptionType as string | undefined,
      isLifetime: payload.isLifetime as boolean | undefined,
      fingerprint: String(payload.fingerprint || ""),
      type: payload.type as "access" | "refresh",
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Edge JWT] Failed to verify refresh token:", error)
    }
    return null
  }
}

