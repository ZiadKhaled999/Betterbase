# BetterBase Auth Template

This template provides a complete authentication setup using BetterAuth.

## Features

- **Email & Password Authentication** - Built-in sign up, sign in, and sign out
- **Session Management** - Automatic session handling with cookies
- **Protected Routes** - Middleware for requiring authentication
- **TypeScript Support** - Full type inference for users and sessions

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set environment variables in `.env`:
   ```bash
   AUTH_SECRET=your-secret-key-change-in-production
   AUTH_URL=http://localhost:3000
   ```

3. Run database migrations:
   ```bash
   bun run db:push
   ```

4. Start the development server:
   ```bash
   bun run dev
   ```

## API Endpoints

BetterAuth automatically provides these endpoints:

- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/signin` - Sign in to an account
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/get-session` - Get current session
- `POST /api/auth/verify-email` - Verify email (if enabled)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

## Protected Routes

Use the `requireAuth` middleware to protect routes:

```typescript
import { requireAuth } from "./middleware/auth"

app.get("/protected", requireAuth, async (c) => {
  const user = c.get("user")
  return c.json({ message: `Hello, ${user.name}!` })
})
```

## Client Usage

Use the `@betterbase/client` package:

```typescript
import { createClient } from "@betterbase/client"

const client = createClient({
  url: "http://localhost:3000",
})

// Sign up
await client.auth.signUp.email("user@example.com", "password123", "John Doe")

// Sign in
await client.auth.signIn.email("user@example.com", "password123")

// Get session
const { data } = await client.auth.getSession()

// Sign out
await client.auth.signOut()
```

## Project Structure

```
src/
├── auth/
│   ├── index.ts      # BetterAuth instance
│   └── types.ts      # TypeScript types
├── db/
│   ├── index.ts      # Database connection
│   └── schema.ts     # Drizzle schema (includes auth tables)
├── middleware/
│   └── auth.ts       # Auth middleware
├── routes/
│   └── auth-example.ts  # Example protected routes
└── index.ts          # Main app entry
```
