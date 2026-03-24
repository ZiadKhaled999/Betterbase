# Blog

Build a complete blog with posts, comments, and categories.

## Features

- Create and manage blog posts
- Categories and tags
- Comments system
- Rich text content
- Draft/publish workflow

## Project Setup

```bash
bb init blog
cd blog
bb auth setup
```

## Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, boolean, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  image: text('image'),
  bio: text('bio')
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique()
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  featuredImage: text('featured_image'),
  published: boolean('published').default(false),
  authorId: text('author_id').notNull(),
  categoryId: text('category_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date())
})

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  postId: text('post_id').notNull(),
  authorId: text('author_id').notNull(),
  parentId: text('parent_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique()
})

export const postTags = sqliteTable('post_tags', {
  postId: text('post_id').notNull(),
  tagId: text('tag_id').notNull()
})
```

## API Routes

### Posts API

```typescript
// src/routes/posts.ts
import { Hono } from 'hono'
import { db } from '../db'
import { posts, users, categories } from '../db/schema'
import { eq, desc, like } from 'drizzle-orm'
import { auth } from '../auth'

const postsRouter = new Hono()

// Get published posts (public)
postsRouter.get('/', async (c) => {
  const allPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      featuredImage: posts.featuredImage,
      published: posts.published,
      createdAt: posts.createdAt,
      category: { id: categories.id, name: categories.name },
      author: { id: users.id, name: users.name, image: users.image }
    })
    .from(posts)
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.published, true))
    .order(desc(posts.createdAt))
  
  return c.json(allPosts)
})

// Get single post by slug (public)
postsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const [post] = await db
    .select()
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .leftJoin(categories, eq(posts.categoryId, categories.id))
    .where(eq(posts.slug, slug))
  
  if (!post || !post.published) {
    return c.json({ error: 'Post not found' }, 404)
  }
  
  return c.json(post)
})

// Create post (auth required)
postsRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { title, slug, content, excerpt, categoryId, published } = await c.req.json()
  
  const id = crypto.randomUUID()
  await db.insert(posts).values({
    id,
    title,
    slug,
    content,
    excerpt,
    categoryId,
    published: published ?? false,
    authorId: user.id
  })
  
  return c.json({ id }, 201)
})

// Update post (author only)
postsRouter.patch('/:id', auth, async (c) => {
  const user = c.get('user')
  const postId = c.req.param('id')
  const data = await c.req.json()
  
  const [existing] = await db.select().from(posts).where(eq(posts.id, postId))
  
  if (!existing || existing.authorId !== user.id) {
    return c.json({ error: 'Not authorized' }, 403)
  }
  
  await db.update(posts).set({ ...data, updatedAt: new Date() }).where(eq(posts.id, postId))
  
  return c.json({ success: true })
})

export default postsRouter
```

### Comments API

```typescript
// src/routes/comments.ts
import { Hono } from 'hono'
import { db } from '../db'
import { comments, posts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '../auth'

const commentsRouter = new Hono()

// Get comments for a post (public)
commentsRouter.get('/:postId', async (c) => {
  const postId = c.req.param('postId')
  
  const allComments = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .order(desc(comments.createdAt))
  
  return c.json(allComments)
})

// Add comment (auth required)
commentsRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { content, postId, parentId } = await c.req.json()
  
  const id = crypto.randomUUID()
  await db.insert(comments).values({
    id,
    content,
    postId,
    authorId: user.id,
    parentId
  })
  
  return c.json({ id }, 201)
})

export default commentsRouter
```

## Rich Text Editor

For rich text content, consider storing Markdown or using a library:

```typescript
// When creating/editing posts
const { content } = await c.req.json()

// Store as Markdown
await db.insert(posts).values({
  // ...
  content, // Store Markdown
  // Or convert to HTML: const html = markdownToHtml(content)
})
```

## Frontend Example

```typescript
// PostList.tsx
function PostList() {
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadPosts(page)
  }, [page])

  const loadPosts = async (page) => {
    const offset = (page - 1) * 10
    const { data } = await client
      .from('posts')
      .select()
      .eq('published', true)
      .order('createdAt', { ascending: false })
      .limit(10)
      .offset(offset)
    setPosts(data)
  }

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
          <a href={`/posts/${post.slug}`}>Read more</a>
        </article>
      ))}
      <Pagination page={page} onChange={setPage} />
    </div>
  )
}

// PostDetail.tsx
function PostDetail({ slug }) {
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])

  useEffect(() => {
    loadPost(slug)
  }, [slug])

  const loadPost = async (slug) => {
    const { data: posts } = await client
      .from('posts')
      .select()
      .eq('slug', slug)
      .single()
    setPost(posts)
    
    const { data } = await client
      .from('comments')
      .select()
      .eq('postId', posts.id)
    setComments(data)
  }

  if (!post) return <Loading />

  return (
    <div>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <Comments comments={comments} postId={post.id} />
    </div>
  )
}
```

## What's Included

This example demonstrates:
- Blog post CRUD
- Categories and tags
- Comments system
- Draft/publish workflow
- Rich text content

## Related

- [Database Feature](../features/database.md) - Database operations
- [Auth Feature](../features/authentication.md) - User authentication
- [Client SDK](../api-reference/client-sdk.md) - Client usage
