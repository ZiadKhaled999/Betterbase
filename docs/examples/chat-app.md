# Chat App

Build a real-time chat application with presence indicators.

## Features

- Real-time messaging
- User presence (online/offline)
- Typing indicators
- Message history
- Direct messages

## Project Setup

```bash
bb init chat-app
cd chat-app
bb auth setup
```

## Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  image: text('image')
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  senderId: text('sender_id').notNull(),
  roomId: text('room_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isDirect: integer('is_direct', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})
```

## API Routes

```typescript
// src/routes/messages.ts
import { Hono } from 'hono'
import { db } from '../db'
import { messages, rooms } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '../auth'

const messagesRouter = new Hono()

// Get messages for a room
messagesRouter.get('/:roomId', auth, async (c) => {
  const roomId = c.req.param('roomId')
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, roomId))
    .order(desc(messages.createdAt))
    .limit(100)
  
  return c.json(msgs)
})

// Send message
messagesRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { content, roomId } = await c.req.json()
  
  const id = crypto.randomUUID()
  await db.insert(messages).values({
    id,
    content,
    senderId: user.id,
    roomId
  })
  
  return c.json({ id, content, senderId: user.id, roomId }, 201)
})

// Get rooms
messagesRouter.get('/rooms', auth, async (c) => {
  const allRooms = await db.select().from(rooms)
  return c.json(allRooms)
})

// Create room
messagesRouter.post('/rooms', auth, async (c) => {
  const { name, isDirect } = await c.req.json()
  
  const id = crypto.randomUUID()
  await db.insert(rooms).values({ id, name, isDirect })
  
  return c.json({ id, name, isDirect }, 201)
})

export default messagesRouter
```

## Real-time Chat

### Presence Tracking

```typescript
// Track user presence
const channel = client.channel('chat-general')

// Announce presence
channel.track({
  user_id: user.id,
  user_name: user.name,
  online_at: new Date().toISOString()
})

// Listen for joins/leaves
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  updateUserList(state)
})

channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
  console.log('User joined:', newPresences)
})

channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
  console.log('User left:', leftPresences)
})

channel.subscribe()
```

### Typing Indicators

```typescript
// Broadcast typing
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { userId: user.id, roomId: 'general' }
})

// Listen for typing
channel.on('broadcast', { event: 'typing' }, (payload) => {
  showTypingIndicator(payload.userId)
})
```

### Message Updates

```typescript
// Subscribe to new messages
const channel = client.channel('chat-general')

channel
  .on('postgres_changes', 
    { event: 'INSERT', table: 'messages' },
    (payload) => {
      addMessage(payload.new)
    }
  )
  .subscribe()
```

## Frontend Example

```typescript
// ChatRoom.tsx
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [typing, setTyping] = useState([])

  useEffect(() => {
    // Load initial messages
    loadMessages(roomId)
    
    // Subscribe to realtime
    const channel = client.channel(`chat-${roomId}`)
    
    channel
      .on('postgres_changes', { event: 'INSERT', table: 'messages' }, (payload) => {
        if (payload.new.roomId === roomId) {
          setMessages(prev => [...prev, payload.new])
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        setTyping(prev => [...new Set([...prev, payload.userId])])
        setTimeout(() => setTyping(prev => prev.filter(u => u !== payload.userId)), 3000)
      })
      .subscribe()
      
    return () => channel.unsubscribe()
  }, [roomId])

  const sendMessage = async () => {
    await client.from('messages').insert({
      content: message,
      roomId
    })
    setMessage('')
  }

  const handleTyping = () => {
    // Send typing indicator
  }

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <Message key={msg.id} content={msg.content} />
        ))}
      </div>
      <div className="typing">
        {typing.map(userId => <span key={userId}>{userId} is typing...</span>)}
      </div>
      <input 
        value={message}
        onChange={e => { setMessage(e.target.value); handleTyping() }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}
```

## Direct Messages

For direct messages between users:

```typescript
// Create or get direct message room
async function getOrCreateDirectRoom(otherUserId) {
  const userId = currentUser.id
  
  // Check if room exists
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.isDirect, true))
    .where(sql`...`) // Check both users
  
  if (room) return room
  
  // Create new room
  const id = crypto.randomUUID()
  await db.insert(rooms).values({ id, isDirect: true })
  return { id }
}
```

## What's Included

This example demonstrates:
- Real-time messaging
- Presence tracking
- Typing indicators
- Direct messages
- Room management

## Related

- [Realtime Feature](../features/realtime.md) - Real-time subscriptions
- [Auth Feature](../features/authentication.md) - User authentication
- [Client SDK](../api-reference/client-sdk.md) - Client usage
