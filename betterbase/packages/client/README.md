# @betterbase/client

TypeScript client for BetterBase backends.

## Installation

```bash
bun add @betterbase/client
```

## Usage

```typescript
import { createClient } from '@betterbase/client';

const betterbase = createClient({
  url: 'http://localhost:3000',
  key: 'optional-api-key',
});

const { data, error } = await betterbase
  .from('users')
  .select('*')
  .eq('status', 'active')
  .limit(10)
  .execute();

await betterbase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe',
});

betterbase
  .realtime
  .from('posts')
  .on('INSERT', (payload) => {
    console.log('New post:', payload.data);
  })
  .subscribe();
```

## API Reference

See [documentation](https://betterbase.dev/docs/client) for full API reference.
