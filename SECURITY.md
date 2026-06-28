# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| IntelForge-beta (main) | Active development |

## Reporting a vulnerability

If you discover a security vulnerability, **do not** open a public GitHub issue.

Instead:

1. Email the maintainers privately (use your university supervisor channel or create a private security advisory on GitHub)
2. Include: description, steps to reproduce, impact assessment
3. Allow 90 days for remediation before public disclosure

## Security practices for contributors

### Never commit

- `.env.local` or any file containing real secrets
- API keys, tokens, passwords, or private keys
- SSL certificates (`*.pem`, `*.key`)
- Real breach data, stealer logs, or personal information
- Local machine paths or student personal details

### Environment variables

All secrets must be loaded from environment variables. See `.env.example` for the full list.

Generate local secrets:

```bash
npm run env:secrets
```

### Default credentials

The database migration seeds a default admin account. **Change this password immediately** after setup. Do not use default credentials in production.

### API keys in documentation

Documentation must use placeholders only:

```
VIRUSTOTAL_API_KEY=your_key_here
```

Never paste real keys into README, issues, or pull requests.

### Data handling

IntelForge is designed for **authorized security research and education**. Do not use the platform to:

- Access systems without authorization
- Store or distribute real stolen credentials
- Violate privacy laws or terms of service of third-party APIs

## Dependency security

- Run `npm audit` periodically
- Enable GitHub Dependabot on the repository
- Keep Node.js and Docker images updated

## Authentication security features

- JWT access + refresh tokens
- HTTP-only session cookies
- CSRF protection on mutations
- Response signing (HMAC)
- Rate limiting on auth endpoints
- 2FA (TOTP) support
- IP policy management (admin)

## If secrets were exposed

1. Rotate all secrets in `.env.local` immediately (`npm run env:secrets`)
2. Rotate any third-party API keys that were exposed
3. Change database passwords
4. Invalidate all active sessions (restart app + clear `sessions` table if needed)
5. Review git history — if secrets were committed, use `git filter-repo` or GitHub secret scanning remediation
