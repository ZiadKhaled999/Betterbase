# Authentication

BetterBase provides built-in authentication powered by BetterAuth, supporting multiple authentication methods out of the box.

## Features

- **Email/Password** - Classic authentication with email and password
- **OAuth Providers** - Google, GitHub, Discord, Apple, Microsoft, Twitter, Facebook
- **Magic Links** - Passwordless authentication via email
- **Phone Auth** - SMS/OTP verification
- **MFA** - Multi-factor authentication support
- **Sessions** - Secure session management with automatic refresh

## Quick Setup

```bash
# Initialize authentication
bb auth setup
```

This creates `src/auth/` with BetterAuth configuration.

## Configuration

Edit `src/auth/index.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite'
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24 // 1 day
  }
})
```

## Adding OAuth Providers

```bash
# Add GitHub OAuth
bb auth add-provider github

# Add Google OAuth
bb auth add-provider google
```

Available providers: `google`, `github`, `discord`, `apple`, `microsoft`, `twitter`, `facebook`

## Authentication Endpoints

BetterBase automatically provides auth endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/signin` | Sign in user |
| `POST` | `/api/auth/signout` | Sign out user |
| `GET` | `/api/auth/session` | Get current session |
| `POST` | `/api/auth/refresh` | Refresh session |
| `POST` | `/api/auth/magic-link` | Send magic link email |
| `GET` | `/api/auth/magic-link/verify` | Verify magic link |
| `POST` | `/api/auth/otp/send` | Send OTP |
| `POST` | `/api/auth/otp/verify` | Verify OTP |
| `POST` | `/api/auth/mfa/enable` | Enable MFA |
| `POST` | `/api/auth/mfa/verify` | Verify MFA |

## Using the Client SDK

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({
  url: 'http://localhost:3000'
})

// Sign up
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe'
})

// Sign in
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

// Sign in with OAuth
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github'
})

// Sign out
await client.auth.signOut()

// Get current user
const { data: { user } } = await client.auth.getUser()
```

## Protecting Routes

Use the auth middleware to protect routes:

```typescript
import { auth } from '../auth'

// Protect a route
app.post('/api/posts', auth, async (c) => {
  const user = c.get('user')
  // user is guaranteed to be authenticated
})
```

## Session Management

Sessions are automatically managed:
- Created on login
- Stored as HTTP-only cookies
- Refreshed before expiry
- Invalidated on logout

## Security Considerations

1. **Use strong passwords** - Enforce minimum length (default: 8 characters)
2. **Enable email verification** - Require email confirmation for sensitive actions
3. **Use MFA** - Enable for admin accounts
4. **Rotate secrets** - Change `AUTH_SECRET` periodically
5. **Use HTTPS** - Always use in production

## Environment Variables

```bash
# Required
AUTH_SECRET=your-secret-key-min-32-chars
AUTH_URL=https://your-domain.com

# OAuth (example for GitHub)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Email (optional, for magic links)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com

# Phone (optional)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Related

- [Client SDK](../api-reference/client-sdk.md) - Using auth in frontend
- [RLS](./rls.md) - Row Level Security with auth
- [Configuration](../getting-started/configuration.md) - Auth configuration
