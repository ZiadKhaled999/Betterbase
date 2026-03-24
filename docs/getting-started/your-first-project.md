# Your First Project

Build a complete blog application using BetterBase.

## Project Overview

We'll build a simple blog with:
- User authentication
- Create, read, update, delete posts
- Real-time updates when posts change

## Step 1: Initialize the Project

```bash
bb init my-blog
cd my-blog
bun install
```

## Step 2: Set Up Authentication

```bash
bb auth setup
```

This creates `src/auth/` with BetterAuth configuration.

## Step 3: Define the Database Schema

Update `src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, boolean } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// Users table (managed by BetterAuth)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

// Posts table
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: boolean('published').default(false),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date())
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

// Types
export type User = typeof users.$inferSelect
export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
```

## Step 4: Apply Migrations

```bash
bun run db:generate
bun run db:push
```

## Step 5: Create API Routes

Create `src/routes/posts.ts`:

```typescript
import { Hono } from 'hono'
import { db } from '../db'
import { posts, users } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '../auth'

const postsRouter = new Hono()

// Get all published posts
postsRouter.get('/', async (c) => {
  const allPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      published: posts.published,
      createdAt: posts.createdAt,
      author: {
        name: users.name,
        image: users.image
      }
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.published, true))
    .order(desc(posts.createdAt))
  
  return c.json(allPosts)
})

// Get single post
postsRouter.get('/:id', async (c) => {
  const postId = c.req.param('id')
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .leftJoin(users, eq(posts.userId, users.id))
  
  if (!post) {
    return c.json({ error: 'Post not found' }, 404)
  }
  
  return c.json(post)
})

// Create a post (authenticated)
postsRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { title, content, published = false } = await c.req.json()
  
  const id = crypto.randomUUID()
  const now = new Date()
  
  await db.insert(posts).values({
    id,
    title,
    content,
    published,
    userId: user.id,
    createdAt: now,
    updatedAt: now
  })
  
  return c.json({ id, title, content, published }, 201)
})

// Update a post (author only)
postsRouter.patch('/:id', auth, async (c) => {
  const user = c.get('user')
  const postId = c.req.param('id')
  const { title, content, published } = await c.req.json()
  
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
  
  if (!existing) {
    return c.json({ error: 'Post not found' }, 404)
  }
  
  if (existing.userId !== user.id) {
    return c.json({ error: 'Not authorized' }, 403)
  }
  
  await db
    .update(posts)
    .set({
      title: title ?? existing.title,
      content: content ?? existing.content,
      published: published ?? existing.published,
      updatedAt: new Date()
    })
    .where(eq(posts.id, postId))
  
  return c.json({ success: true })
})

// Delete a post (author only)
postsRouter.delete('/:id', auth, async (c) => {
  const user = c.get('user')
  const postId = c.req.param('id')
  
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
  
  if (!existing) {
    return c.json({ error: 'Post not found' }, 404)
  }
  
  if (existing.userId !== user.id) {
    return c.json({ error: 'Not authorized' }, 403)
  }
  
  await db.delete(posts).where(eq(posts.id, postId))
  
  return c.json({ success: true })
})

export default postsRouter
```

## Step 6: Mount Routes

Update `src/routes/index.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from 'better-auth/hono'
import posts from './posts'
import health from './health'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => c.json({ message: 'My Blog API' }))

// Public routes
app.route('/', health)

// Protected routes (require authentication)
app.route('/posts', auth, posts)

export default app
```

## Step 7: Run and Test

```bash
bun run dev
```

### Test with cURL

```bash
# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "author@example.com", "password": "secure123", "name": "Author"}'

# Create a post (include session cookie)
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello World", "content": "My first post!", "published": true}'

# Get all posts
curl http://localhost:3000/posts
```

### Test with Client SDK

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({
  url: 'http://localhost:3000'
})

// Sign up
await client.auth.signUp({
  email: 'author@example.com',
  password: 'secure123',
  name: 'Author'
})

// Create post
await client.from('posts').insert({
  title: 'Hello World',
  content: 'My first post!',
  published: true
})

// Subscribe to real-time updates
client.channel('posts').on('postgres_changes', 
  { event: 'INSERT', table: 'posts' },
  (payload) => console.log('New post:', payload.new)
)
```

## Step 8: Add Real-time Subscriptions

Enable real-time updates by configuring BetterBase:

```typescript
// betterbase.config.ts
export default defineConfig({
  project: { name: 'my-blog' },
  realtime: {
    enabled: true,
    tables: ['posts']
  }
})
```

Now clients can subscribe to database changes:

```typescript
// Client-side
const channel = client.channel('public:posts')

channel
  .on('postgres_changes', 
    { event: '*', table: 'posts' },
    (payload) => {
      console.log('Post changed:', payload)
    }
  )
  .subscribe()
```

## What's Next

You've built a complete blog with:
- User authentication
- CRUD operations for posts
- Authorization (author-only edits)
- Real-time subscriptions

Explore more:
- [Configuration](../getting-started/configuration.md) - Customize your setup
- [Features](../features/authentication.md) - Deep dive into auth
- [Deployment](../guides/deployment.md) - Deploy to production
