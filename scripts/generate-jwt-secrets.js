/**
 * JWT Secret Generator
 * 
 * Generates cryptographically secure secrets for JWT authentication
 * Run this script ONCE during initial setup and save the secrets in .env.local
 * 
 * SECURITY: Keep these secrets PRIVATE and NEVER commit them to version control
 */

const crypto = require('crypto')

console.log('\n' + '='.repeat(80))
console.log('🔐 JWT SECRET GENERATOR')
console.log('='.repeat(80))
console.log('\nGenerating cryptographically secure secrets for JWT authentication...\n')

// Generate secrets
const jwtSecret = crypto.randomBytes(64).toString('hex')
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex')
const sessionSecret = crypto.randomBytes(32).toString('hex')
const responseSigningSecret = crypto.randomBytes(32).toString('hex')
const cronSecret = crypto.randomBytes(32).toString('hex')

console.log('✅ Secrets generated successfully!\n')
console.log('📋 Add these to your .env.local file:\n')
console.log('─'.repeat(80))
console.log(`JWT_SECRET=${jwtSecret}`)
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`)
console.log(`SESSION_SECRET=${sessionSecret}`)
console.log(`RESPONSE_SIGNING_SECRET=${responseSigningSecret}`)
console.log(`CRON_SECRET=${cronSecret}`)
console.log('─'.repeat(80))
console.log('\nOr run: node scripts/ensure-env-secrets.mjs  (appends only missing keys)')

console.log('\n⚠️  SECURITY WARNINGS:')
console.log('  1. NEVER commit these secrets to version control (Git)')
console.log('  2. NEVER share these secrets publicly')
console.log('  3. Keep .env.local in .gitignore')
console.log('  4. If secrets are compromised, regenerate them and update .env.local')
console.log('  5. Use different secrets for development and production')

console.log('\n📖 Additional configuration (optional):')
console.log('  COOKIE_DOMAIN=yourdomain.com  # For subdomain support in production')

console.log('\n' + '='.repeat(80) + '\n')

