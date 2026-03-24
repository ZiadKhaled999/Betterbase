# Todo App

Build a collaborative todo application with real-time updates.

## Features

- Create, update, delete todos
- Mark todos as complete
- Real-time sync across devices
- User authentication

## Project Setup

```bash
bb init todo-app
cd todo-app
bb auth setup
```

## Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, boolean, integer } from 'drizzle-orm/sqlite-core'

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  completed: boolean('completed').default(false),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})
```

## API Routes

```typescript
// src/routes/todos.ts
import { Hono } from 'hono'
import { db } from '../db'
import { todos } from '../db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '../auth'

const todosRouter = new Hono()

// Get all todos for user
todosRouter.get('/', auth, async (c) => {
  const user = c.get('user')
  const allTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
  
  return c.json(allTodos)
})

// Create todo
todosRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { title } = await c.req.json()
  
  const id = crypto.randomUUID()
  await db.insert(todos).values({
    id,
    title,
    userId: user.id,
    completed: false
  })
  
  return c.json({ id, title, completed: false }, 201)
})

// Toggle todo
todosRouter.patch('/:id/toggle', auth, async (c) => {
  const user = c.get('user')
  const todoId = c.req.param('id')
  
  const [existing] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, todoId))
  
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: 'Not found' }, 404)
  }
  
  await db
    .update(todos)
    .set({ completed: !existing.completed })
    .where(eq(todos.id, todoId))
  
  return c.json({ success: true })
})

// Delete todo
todosRouter.delete('/:id', auth, async (c) => {
  const user = c.get('user')
  const todoId = c.req.param('id')
  
  await db
    .delete(todos)
    .where(eq(todos.id, todoId))
    .where(eq(todos.userId, user.id))
  
  return c.json({ success: true })
})

export default todosRouter
```

## Real-time Updates

Enable realtime in `betterbase.config.ts`:

```typescript
export default defineConfig({
  realtime: {
    enabled: true,
    tables: ['todos']
  }
})
```

Client-side subscription:

```typescript
// client.ts
const client = createClient({ url: 'http://localhost:3000' })

const channel = client.channel('todos')

channel
  .on('postgres_changes', 
    { event: '*', table: 'todos' },
    () => fetchTodos()
  )
  .subscribe()

async function fetchTodos() {
  const { data } = await client.from('todos').select()
  renderTodos(data)
}
```

## Frontend Implementation

```typescript
// React component
function TodoList() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')

  useEffect(() => {
    fetchTodos()
    
    // Subscribe to changes
    const channel = client.channel('todos')
    channel.on('postgres_changes', { event: '*', table: 'todos' }, () => {
      fetchTodos()
    }).subscribe()
  }, [])

  const addTodo = async () => {
    await client.from('todos').insert({ title: newTodo })
    setNewTodo('')
  }

  const toggleTodo = async (id, completed) => {
    // Toggle via API or direct update
  }

  return (
    <div>
      <input 
        value={newTodo} 
        onChange={e => setNewTodo(e.target.value)} 
      />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input 
              type="checkbox" 
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            {todo.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## What's Included

This example demonstrates:
- Database CRUD operations
- User authentication
- Real-time subscriptions
- API route creation

## Related

- [Auth Feature](../features/authentication.md) - User authentication
- [Realtime Feature](../features/realtime.md) - Real-time updates
- [Client SDK](../api-reference/client-sdk.md) - Client usage
