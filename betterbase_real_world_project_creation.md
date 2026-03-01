
# PHASE 2: FULL SCAFFOLD PROJECT — "TaskFlow"

**TaskFlow** is a real-world task management app that uses every BetterBase feature. Build it by following the steps below. This is both a reference implementation and a stress test of the entire platform.

---

## 2.1 Project Overview

**What TaskFlow does:**
- Users can register and log in
- Users can create projects (workspaces)
- Users can create tasks inside projects
- Tasks can have comments
- Real-time updates when tasks change
- Webhooks notify a Slack-like endpoint on task completion
- File attachments via S3 storage
- Full REST and GraphQL APIs
- RLS ensures users only see their own projects and tasks
- An edge function handles email notification on task assignment

---

## 2.2 Initialize the Project

```bash
bb init taskflow
cd taskflow

# When prompted:
# Provider: Neon (or Raw Postgres for RLS support)
# Storage: Yes — S3 (or R2)
# Enter your DATABASE_URL when asked
```

---

## 2.3 Define the Schema

Replace `src/db/schema.ts` with:

```typescript
import { pgTable, text, boolean, timestamp, uuid, integer } from 'drizzle-orm/pg-core'

// Helper columns
const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  ...timestamps,
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  isArchived: boolean('is_archived').default(false).notNull(),
  ...timestamps,
})

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] }).default('todo').notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).default('medium').notNull(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  assigneeId: uuid('assignee_id').references(() => users.id),
  attachmentUrl: text('attachment_url'),   // S3 URL
  dueDate: timestamp('due_date'),
  ...timestamps,
})

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  taskId: uuid('task_id').notNull().references(() => tasks.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
  ...timestamps,
})

export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'member', 'viewer'] }).default('member').notNull(),
  ...timestamps,
})
```

---

## 2.4 Run Migrations + Auth Setup

```bash
# Apply schema to database
bb migrate

# Set up authentication
bb auth setup
# This adds sessions/accounts tables and auth middleware

# Migrate again for auth tables
bb migrate

# Generate AI context
bb generate context

# Verify context file
cat .betterbase-context.json
```

---

## 2.5 Generate CRUD for All Tables

```bash
bb generate crud projects
bb generate crud tasks
bb generate crud comments
bb generate crud project-members
```

---

## 2.6 Set Up RLS Policies

```bash
bb rls create projects
bb rls create tasks
bb rls create comments
bb rls create project-members
```

Edit each policy file:

**`src/db/policies/projects.policy.ts`**
```typescript
import { definePolicy } from '@betterbase/core/rls'

export default definePolicy('projects', {
  select: "auth.uid() = owner_id OR auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = id)",
  insert: "auth.uid() = owner_id",
  update: "auth.uid() = owner_id",
  delete: "auth.uid() = owner_id",
})
```

**`src/db/policies/tasks.policy.ts`**
```typescript
import { definePolicy } from '@betterbase/core/rls'

export default definePolicy('tasks', {
  select: "auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = tasks.project_id)",
  insert: "auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = tasks.project_id)",
  update: "auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = tasks.project_id)",
  delete: "auth.uid() IN (SELECT user_id FROM project_members WHERE project_id = tasks.project_id)",
})
```

```bash
# Apply RLS policies
bb migrate
```

---

## 2.7 Set Up Webhooks

```bash
bb webhook create
# Table: tasks
# Events: UPDATE (to catch status changes)
# URL env var: WEBHOOK_TASK_STATUS_URL
# Secret env var: WEBHOOK_SECRET
```

Add to `.env`:
```
WEBHOOK_TASK_STATUS_URL=https://hooks.slack.com/your-webhook-url
WEBHOOK_SECRET=your-secret-here
```

---

## 2.8 Set Up Storage

```bash
bb storage init
# Follow prompts for your S3/R2 provider
```

Add a file upload endpoint to `src/routes/tasks.ts`:
```typescript
// POST /api/tasks/:id/attachment
tasksRoute.post('/:id/attachment', requireAuth(), async (c) => {
  const taskId = c.req.param('id')
  const formData = await c.req.formData()
  const file = formData.get('file') as File

  const { data, error } = await storage
    .from(env.STORAGE_BUCKET)
    .upload(`tasks/${taskId}/${file.name}`, await file.arrayBuffer(), {
      contentType: file.type,
    })

  if (error) return c.json({ data: null, error }, 500)

  await db.update(tasks)
    .set({ attachmentUrl: data.publicUrl })
    .where(eq(tasks.id, taskId))

  return c.json({ data: { url: data.publicUrl }, error: null })
})
```

---

## 2.9 Set Up GraphQL

```bash
bb generate graphql
# Expected: generates /api/graphql endpoint with all tables
```

Test the generated schema covers all tables:
```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
# Verify: Users, Projects, Tasks, Comments, ProjectMembers all appear
```

---

## 2.10 Create an Edge Function: Task Assignment Notifier

```bash
bb function create task-notifier
```

Edit `src/functions/task-notifier/index.ts`:
```typescript
import { Hono } from 'hono'
import { createClient } from '@betterbase/client'

const app = new Hono()

app.post('/', async (c) => {
  const { taskId, assigneeEmail, taskTitle } = await c.req.json()

  // In a real app, call a transactional email provider here
  // e.g., Resend, Postmark, SendGrid
  console.log(`Notifying ${assigneeEmail} about task: ${taskTitle}`)

  // Simulate sending email
  return c.json({
    success: true,
    message: `Notification sent to ${assigneeEmail} for task "${taskTitle}"`,
  })
})

export default app
```

Edit `src/functions/task-notifier/config.ts`:
```typescript
export default {
  name: 'task-notifier',
  runtime: 'cloudflare-workers' as const,
  env: ['RESEND_API_KEY'],
}
```

```bash
# Run locally
bb function dev task-notifier
# Test it
curl -X POST http://localhost:3001 \
  -H "Content-Type: application/json" \
  -d '{"taskId": "123", "assigneeEmail": "john@example.com", "taskTitle": "Build auth system"}'
# Expected: { "success": true, "message": "Notification sent to..." }

# Deploy
bb function build task-notifier
bb function deploy task-notifier
```

---

## 2.11 Full End-to-End Test of TaskFlow

Run every feature together:

```bash
# 1. Start server
bun dev

# 2. Register two users
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@taskflow.com", "password": "pass123", "name": "Alice"}'
# Save token as TOKEN_ALICE

curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@taskflow.com", "password": "pass123", "name": "Bob"}'
# Save token as TOKEN_BOB

# 3. Alice creates a project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"name": "BetterBase Launch", "description": "Ship the platform"}'
# Save project_id as PROJECT_ID

# 4. Alice adds Bob as a member
curl -X POST http://localhost:3000/api/project-members \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "'$PROJECT_ID'", "userId": "BOB_ID", "role": "member"}'

# 5. Bob subscribes to task updates via WebSocket
# wscat -c ws://localhost:3000/ws -H "Authorization: Bearer $TOKEN_BOB"
# Send: {"type": "subscribe", "table": "tasks"}

# 6. Alice creates a task assigned to Bob
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN_ALICE" \
  -H "Content-Type: application/json" \
  -d '{"title": "Write API docs", "projectId": "'$PROJECT_ID'", "assigneeId": "BOB_ID", "priority": "high"}'
# Expected: Bob receives WebSocket event with new task
# Save task_id as TASK_ID

# 7. Bob adds a comment via GraphQL
curl -X POST http://localhost:3000/api/graphql \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createComment(input: { content: \"On it!\", taskId: \"'$TASK_ID'\", authorId: \"BOB_ID\" }) { id content } }"}'

# 8. Bob uploads a file attachment
curl -X POST http://localhost:3000/api/tasks/$TASK_ID/attachment \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -F "file=@./api-docs.pdf"
# Expected: { "data": { "url": "https://..." } }

# 9. Bob marks task as done (triggers webhook)
curl -X PUT http://localhost:3000/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN_BOB" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
# Expected: webhook fires to WEBHOOK_TASK_STATUS_URL
# Expected: Bob's WebSocket receives UPDATE event

# 10. Verify RLS — Carol (unauthenticated) cannot see Alice's project
curl http://localhost:3000/api/projects
# Expected: 401 Unauthorized (no token)

# Create Carol with no project membership
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "carol@taskflow.com", "password": "pass123", "name": "Carol"}'
# Save as TOKEN_CAROL

curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN_CAROL"
# Expected: empty array — RLS filters out Alice's project

# 11. Verify .betterbase-context.json is complete
cat .betterbase-context.json
# Expected: tables (users, projects, tasks, comments, project_members)
# Expected: rls_policies for projects, tasks, comments
# Expected: graphql_schema with all types
# Expected: graphql_endpoint: "/api/graphql"

# 12. Test edge function in production
curl -X POST https://task-notifier.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"taskId": "'$TASK_ID'", "assigneeEmail": "bob@taskflow.com", "taskTitle": "Write API docs"}'
# Expected: { "success": true, "message": "Notification sent to bob@taskflow.com..." }

echo "✅ TaskFlow full end-to-end test complete"
```

---

## 2.12 Verify Final Project Structure

After completing all steps, your TaskFlow project should look like:

```
taskflow/
├── src/
│   ├── db/
│   │   ├── schema.ts              ← 5 tables: users, projects, tasks, comments, project_members
│   │   ├── index.ts               ← Drizzle DB instance
│   │   ├── migrate.ts             ← Migration runner
│   │   └── policies/
│   │       ├── projects.policy.ts ← RLS: owner + members
│   │       └── tasks.policy.ts    ← RLS: project members only
│   ├── routes/
│   │   ├── index.ts               ← Route registration
│   │   ├── health.ts              ← GET /health
│   │   ├── auth.ts                ← Auth endpoints (signUp/signIn/signOut)
│   │   ├── users.ts               ← CRUD /api/users
│   │   ├── projects.ts            ← CRUD /api/projects
│   │   ├── tasks.ts               ← CRUD /api/tasks + file upload
│   │   ├── comments.ts            ← CRUD /api/comments
│   │   ├── project-members.ts     ← CRUD /api/project-members
│   │   ├── graphql.ts             ← /api/graphql (auto-generated)
│   │   └── storage.ts             ← /api/storage/* (auto-generated)
│   ├── middleware/
│   │   ├── auth.ts                ← requireAuth(), optionalAuth()
│   │   └── validation.ts          ← parseBody() Zod validator
│   ├── functions/
│   │   └── task-notifier/
│   │       ├── index.ts           ← Edge function: email notifier
│   │       └── config.ts          ← Runtime: cloudflare-workers
│   └── lib/
│       ├── env.ts                 ← Environment variable parsing
│       └── realtime.ts            ← WebSocket server
├── .betterbase-context.json       ← AI manifest (auto-generated)
├── betterbase.config.ts           ← Provider: Neon, Storage: R2, Webhooks: tasks
├── drizzle.config.ts              ← Generated for Neon provider
├── package.json
└── .env                           ← All credentials
```

**Features active in this project:**
- ✅ REST API (all 5 tables, full CRUD)
- ✅ GraphQL API (/api/graphql)
- ✅ Realtime WebSockets (task updates broadcast to subscribers)
- ✅ Webhooks (task status change → external URL)
- ✅ S3 Storage (task file attachments)
- ✅ RLS (projects and tasks scoped to members)
- ✅ Auth (BetterAuth, user-owned tables)
- ✅ Edge Function (task-notifier deployed to Cloudflare Workers)
- ✅ AI Context (.betterbase-context.json with all tables, routes, policies, GraphQL schema)
