// Shared test fixtures for BetterBase CLI tests
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export const SIMPLE_SCHEMA = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
`;

export const MULTI_TABLE_SCHEMA = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').notNull().references(() => users.id),
  published: integer('published', { mode: 'boolean' }).default(0),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  body: text('body').notNull(),
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
});
`;

export const SIMPLE_ROUTES = `
import { Hono } from 'hono'
const app = new Hono()
app.get('/users', async (c) => c.json([]))
app.post('/users', async (c) => c.json({}))
export default app
`;

export const PROTECTED_ROUTES = `
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
const app = new Hono()
const createSchema = z.object({ title: z.string(), content: z.string().optional() })
app.get('/posts', requireAuth, async (c) => c.json([]))
app.post('/posts', requireAuth, zValidator('json', createSchema), async (c) => c.json({}))
app.get('/health', async (c) => c.json({ status: 'ok' }))
export default app
`;

export const EMPTY_SCHEMA = `export {}`;
export const EMPTY_ROUTES = `export {}`;

export async function createMinimalProject(dir: string) {
  await mkdir(join(dir, 'src/db'), { recursive: true });
  await mkdir(join(dir, 'src/routes'), { recursive: true });
  await mkdir(join(dir, 'src/middleware'), { recursive: true });
  await writeFile(join(dir, 'src/db/schema.ts'), SIMPLE_SCHEMA);
  await writeFile(
    join(dir, 'src/routes/index.ts'),
    `
    import { Hono } from 'hono'
    const app = new Hono()
    export default app
  `
  );
  await writeFile(join(dir, '.env'), 'PORT=3000\n');
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'test-project',
        version: '0.0.1',
        private: true,
      },
      null,
      2
    )
  );
}
