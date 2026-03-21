# Feature 7: GraphQL Subscriptions

**Priority**: Medium (Week 14)  
**Complexity**: Low  
**Dependencies**: Realtime Presence (uses same events)  
**Estimated Effort**: 1-2 weeks

---

## Problem Statement

GraphQL server has queries and mutations but no subscriptions. Realtime apps need live data updates.

---

## Solution

Enable graphql-yoga subscriptions and wire to realtime event emitter:
- Subscribe: `subscription { postsInserted { id title } }`
- Fires when: Database insert occurs
- Uses: Existing realtime event system

---

## Implementation

### Step 1: Add PubSub

**File**: `packages/core/src/graphql/server.ts`

**MODIFY**:

```typescript
import { createYoga, createPubSub } from 'graphql-yoga';

const pubsub = createPubSub();

export function createGraphQLServer(config: GraphQLConfig) {
  const yoga = createYoga({
    schema: config.schema,
    context: config.context,
    graphqlEndpoint: '/graphql',
  });

  return yoga;
}

export function publishGraphQLEvent(topic: string, payload: any): void {
  pubsub.publish(topic, payload);
}

export { pubsub };
```

---

### Step 2: Generate Subscription Resolvers

**File**: `packages/core/src/graphql/resolvers.ts`

**ADD**:

```typescript
import { pubsub } from './server';

export function generateSubscriptionResolvers(
  schema: Record<string, any>
): Record<string, any> {
  const subscriptions: Record<string, any> = {};

  for (const [tableName] of Object.entries(schema)) {
    subscriptions[`${tableName}Changes`] = {
      subscribe: () => pubsub.subscribe(`${tableName}:change`),
      resolve: (payload: any) => payload,
    };

    subscriptions[`${tableName}Inserted`] = {
      subscribe: () => pubsub.subscribe(`${tableName}:insert`),
      resolve: (payload: any) => payload,
    };

    subscriptions[`${tableName}Updated`] = {
      subscribe: () => pubsub.subscribe(`${tableName}:update`),
      resolve: (payload: any) => payload,
    };

    subscriptions[`${tableName}Deleted`] = {
      subscribe: () => pubsub.subscribe(`${tableName}:delete`),
      resolve: (payload: any) => payload,
    };
  }

  return subscriptions;
}
```

---

### Step 3: Bridge Realtime to GraphQL

**File**: `packages/core/src/graphql/realtime-bridge.ts` (NEW)

```typescript
import { pubsub } from './server';
import type { EventEmitter } from 'events';

export function bridgeRealtimeToGraphQL(eventEmitter: EventEmitter): void {
  eventEmitter.on('db:insert', (event: { table: string; record: any }) => {
    pubsub.publish(`${event.table}:insert`, event.record);
    pubsub.publish(`${event.table}:change`, { 
      type: 'INSERT', 
      record: event.record 
    });
  });

  eventEmitter.on('db:update', (event: { table: string; record: any }) => {
    pubsub.publish(`${event.table}:update`, event.record);
    pubsub.publish(`${event.table}:change`, { 
      type: 'UPDATE', 
      record: event.record 
    });
  });

  eventEmitter.on('db:delete', (event: { table: string; record: any }) => {
    pubsub.publish(`${event.table}:delete`, event.record);
    pubsub.publish(`${event.table}:change`, { 
      type: 'DELETE', 
      record: event.record 
    });
  });

  console.log('[GraphQL] Subscriptions wired to realtime');
}
```

---

### Step 4: Update Schema

**File**: `packages/core/src/graphql/schema-generator.ts`

**ADD** subscription types:

```typescript
export function generateGraphQLSchema(schema: Record<string, any>): string {
  let sdl = '';

  // ... existing type generation ...

  // Add Subscription type
  sdl += '\ntype Subscription {\n';
  
  for (const tableName of Object.keys(schema)) {
    const typeName = capitalize(tableName);
    
    sdl += `  ${tableName}Changes: ${typeName}Change!\n`;
    sdl += `  ${tableName}Inserted: ${typeName}!\n`;
    sdl += `  ${tableName}Updated: ${typeName}!\n`;
    sdl += `  ${tableName}Deleted: ${typeName}!\n`;
  }
  
  sdl += '}\n';

  return sdl;
}
```

---

## Acceptance Criteria

- [ ] PubSub instance created
- [ ] Subscription resolvers generated
- [ ] Realtime bridge connects events
- [ ] Schema includes Subscription type
- [ ] Test: Subscribe to `postsInserted`, insert post, fires
- [ ] Test: GraphQL Playground shows subscriptions
- [ ] Test: Multiple clients can subscribe
