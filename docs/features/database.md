# Database

BetterBase supports multiple database providers and uses Drizzle ORM for type-safe database operations.

## Supported Providers

| Provider | Use Case | Notes |
|----------|----------|-------|
| **SQLite** | Local development | Zero config, file-based |
| **PostgreSQL** | Production | Full SQL capabilities |
| **Neon** | Serverless PostgreSQL | Automatic scaling |
| **Turso** | Edge deployments | libSQL, distributed |
| **PlanetScale** | Serverless MySQL | Branch-based schema |
| **Supabase** | Supabase hosted | PostgreSQL compatible |

## Schema Definition

Define your database schema using Drizzle ORM:

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core'
import { pgTable, serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// SQLite example
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

// PostgreSQL example
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  published: boolean('published').default(false),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow()
})

// Relations
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

## Database Initialization

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres'
import { migrate } from 'drizzle-orm/postgres/migrator'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)

export const db = drizzle(client)

// Run migrations
await migrate(db, { migrationsFolder: './drizzle' })
```

## Querying Data

### Select

```typescript
import { db } from '../db'
import { users, posts } from './schema'
import { eq, desc, asc, like, and, or } from 'drizzle-orm'

// Get all users
const allUsers = await db.select().from(users)

// Get user by ID
const [user] = await db.select().from(users).where(eq(users.id, 'user-123'))

// Get posts with filtering
const publishedPosts = await db
  .select()
  .from(posts)
  .where(and(
    eq(posts.published, true),
    like(posts.title, '%tutorial%')
  ))
  .order(desc(posts.createdAt))
  .limit(10)
```

### Insert

```typescript
// Insert single
await db.insert(users).values({
  id: crypto.randomUUID(),
  name: 'John Doe',
  email: 'john@example.com'
})

// Insert multiple
await db.insert(posts).values([
  { title: 'Post 1', content: 'Content 1', userId: 1 },
  { title: 'Post 2', content: 'Content 2', userId: 1 }
])
```

### Update

```typescript
await db
  .update(posts)
  .set({ 
    title: 'Updated Title',
    published: true
  })
  .where(eq(posts.id, 1))
```

### Delete

```typescript
await db.delete(posts).where(eq(posts.id, 1))
```

## Relationships

```typescript
// With relations
const usersWithPosts = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId))

// Using Drizzle's withRelations
const userWithPosts = await db.query.users.findFirst({
  with: {
    posts: true
  }
})
```

## Transactions

```typescript
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({
    id: crypto.randomUUID(),
    name: 'New User',
    email: 'new@example.com'
  }).returning()
  
  await tx.insert(posts).values({
    title: 'First Post',
    content: 'Hello!',
    userId: user.id
  })
})
```

## Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:push

# Or use CLI
bb migrate generate my-migration
bb migrate up
```

## Auto-REST

BetterBase automatically generates REST endpoints from your schema:

```bash
# Endpoints are automatically available:
GET    /api/users        # List users
GET    /api/users/:id    # Get user by ID
POST   /api/users        # Create user
PATCH  /api/users/:id    # Update user
DELETE /api/users/:id    # Delete user
```

### Filtering

```
GET /api/users?filter=active.eq.true&sort=createdAt.desc&limit=10&offset=0
```

### Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equals |
| `ne` | Not equals |
| `gt` | Greater than |
| `gte` | Greater or equal |
| `lt` | Less than |
| `lte` | Less or equal |
| `like` | Pattern match |
| `in` | In array |

## Indexes

Add indexes for better query performance:

```typescript
export const posts = pgTable('posts', {
  // ...
}, (table) => ({
  userIdx: index('user_idx').on(table.userId),
  publishedIdx: index('published_idx').on(table.published),
  createdIdx: index('created_idx').on(table.createdAt)
}))
```

## Best Practices

1. **Use proper types** - Leverage Drizzle's type inference
2. **Add indexes** - Index frequently queried columns
3. **Use transactions** - For multi-step operations
4. **Limit results** - Always use pagination for lists
5. **Validate inputs** - Sanitize before queries

## Related

- [Configuration](../getting-started/configuration.md) - Database provider config
- [RLS](./rls.md) - Row Level Security
- [GraphQL](./graphql.md) - GraphQL API
