# Quick Start

Get up and running with BetterBase in under 5 minutes.

## Prerequisites

- Bun v1.0+ installed
- BetterBase CLI installed (`bun add -g @betterbase/cli`)

## Step 1: Create a New Project

```bash
bb init my-first-app
cd my-first-app
```

## Step 2: Install Dependencies

```bash
bun install
```

## Step 3: Define Your Schema

Edit `src/db/schema.ts` to define your database tables:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts)
}))

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id]
  })
}))
```

## Step 4: Generate and Apply Migrations

```bash
bun run db:generate
bun run db:push
```

## Step 5: Start the Development Server

```bash
bun run dev
```

Your API is now running at `http://localhost:3000`.

## What's Available Out of the Box

### REST API Endpoints

BetterBase automatically generates REST endpoints based on your schema:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create new user |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |

Same endpoints work for `posts` table.

### GraphQL API

Access the GraphQL playground at `http://localhost:graphql`

```graphql
# Query users
query {
  users {
    id
    name
    email
    posts {
      id
      title
    }
  }
}
```

### Authentication

Built-in auth endpoints at `/api/auth/*`:

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Storage

Upload and manage files at `/storage/*`:

```typescript
// Using the client SDK
const { data } = await client.storage.upload('avatars', file)
const url = client.storage.getPublicUrl('avatars', file.name)
```

## Testing Your API

### Using cURL

```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user-1", "name": "John", "email": "john@example.com"}'

# Get all users
curl http://localhost:3000/api/users
```

### Using the Client SDK

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({
  url: 'http://localhost:3000'
})

// Sign up
await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe'
})

// Create a post
await client.from('posts').insert({
  title: 'My First Post',
  content: 'Hello, BetterBase!'
})
```

## Next Steps

- [Your First Project](./your-first-project.md) - Build a complete application
- [Configuration](./configuration.md) - Customize your setup
- [Features](../features/authentication.md) - Learn about all features
