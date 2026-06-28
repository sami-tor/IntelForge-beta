const DEV_ACCESS_SECRET =
  "dev-access-secret-change-in-production-use-64-char-random-string"
const DEV_REFRESH_SECRET =
  "dev-refresh-secret-change-in-production-use-64-char-random-string"

const jwtSecret = process.env.JWT_SECRET
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET

if ((!jwtSecret || !jwtRefreshSecret) && process.env.NODE_ENV === "production") {
  throw new Error(
    "CRITICAL SECURITY ERROR: JWT_SECRET and JWT_REFRESH_SECRET environment variables MUST be set in production!\n" +
      'Generate secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  )
}

if ((!jwtSecret || !jwtRefreshSecret) && process.env.NODE_ENV !== "production") {
  const banner = "=".repeat(80)
  console.error("\n" + banner)
  console.error("⚠️  SECURITY WARNING: JWT secrets missing. Using development defaults.")
  console.error(
    '   Generate secure secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  )
  console.error(banner + "\n")
}

export const ACCESS_SECRET = jwtSecret || DEV_ACCESS_SECRET
export const REFRESH_SECRET = jwtRefreshSecret || DEV_REFRESH_SECRET

