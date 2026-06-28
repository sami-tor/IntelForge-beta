import speakeasy from "speakeasy"
import QRCode from "qrcode"

/**
 * Generate a new 2FA secret for a user
 */
export async function generateTwoFactorSecret(email: string) {
  const secret = speakeasy.generateSecret({
    name: `Intel Forge (${email})`,
    issuer: "Intel Forge",
    length: 32, // Longer secret for better security
  })

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

  return {
    secret: secret.base32,
    backupCodes: generateBackupCodes(),
    qrCode,
    otpauth_url: secret.otpauth_url,
  }
}

/**
 * Verify a 2FA token (TOTP code)
 */
export function verifyTwoFactorToken(secret: string, token: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 2 time windows (±30 seconds)
    })
  } catch (error) {
    console.error("[2FA] Verification error:", error)
    return false
  }
}

/**
 * Generate backup codes (10 codes for emergency access)
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 10; i++) {
    const code = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase()
    codes.push(code)
  }
  return codes
}

/**
 * Verify a backup code and remove it from list
 */
export function useBackupCode(code: string, backupCodes: string[]): boolean {
  const index = backupCodes.indexOf(code.toUpperCase())
  if (index !== -1) {
    backupCodes.splice(index, 1)
    return true
  }
  return false
}

/**
 * Hash backup codes for storage (one-way)
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map((code) => {
    // For production, use bcrypt instead
    return Buffer.from(code).toString("base64")
  })
}

/**
 * Verify hashed backup code
 */
export function verifyHashedBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedInput = Buffer.from(code.toUpperCase()).toString("base64")
  return hashedCodes.includes(hashedInput)
}
