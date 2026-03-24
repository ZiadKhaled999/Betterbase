# Row Level Security (RLS)

BetterBase provides Row Level Security for fine-grained access control at the database level.

## Overview

RLS ensures users can only access data they're authorized to see. Policies are enforced at the database level, providing security even if application-level checks are bypassed.

## Quick Setup

Enable RLS on tables:

```bash
# Enable RLS for a table
bb rls enable --table users

# Disable RLS for a table
bb rls disable --table users
```

## Creating Policies

```bash
# Create a policy
bb rls create \
  --table posts \
  --name users-own-posts \
  --command SELECT \
  --check "user_id = auth.uid()"
```

## Policy Structure

```typescript
// PostgreSQL policy
CREATE POLICY "users-own-posts" ON posts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users-own-posts" ON posts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users-own-posts" ON posts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users-own-posts" ON posts
  FOR DELETE
  USING (user_id = auth.uid());
```

## Policy Commands

| Command | Description |
|---------|-------------|
| `SELECT` | Control read access |
| `INSERT` | Control new record creation |
| `UPDATE` | Control record updates |
| `DELETE` | Control record deletion |
| `ALL` | All operations |

## Expression Variables

Available in policy expressions:

| Variable | Description |
|----------|-------------|
| `auth.uid()` | Current user ID |
| `auth.role()` | User role (admin, user) |
| `auth.email()` | User email |
| `auth.jwt()` | Full JWT claims |

## Common Patterns

### Owner-Based Access

```sql
-- Users can only see their own posts
CREATE POLICY "users-own-posts" ON posts
  FOR SELECT
  USING (user_id = auth.uid());
```

### Public Read Access

```sql
-- Anyone can read published posts
CREATE POLICY "public-posts" ON posts
  FOR SELECT
  USING (published = true);
```

### Role-Based Access

```sql
-- Admins can see all users
CREATE POLICY "admins-see-all" ON users
  FOR SELECT
  USING (auth.role() = 'admin');
```

### Team-Based Access

```sql
-- Users can only see their team's data
CREATE POLICY "team-access" ON documents
  FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ));
```

## Using with BetterBase

### In REST API

```typescript
// With RLS, these queries are automatically filtered
const posts = await client
  .from('posts')
  .select()
  // RLS adds: WHERE user_id = auth.uid()
```

### In GraphQL

```graphql
# RLS automatically filters results
query {
  posts {
    id
    title
    # Only returns posts user owns
  }
}
```

### In Functions

```typescript
export default async function handler(event) {
  // RLS automatically applies
  const posts = await db.select().from(posts)
  // Returns only user's posts
}
```

## Testing Policies

```bash
# Test RLS policies
bb rls test --table posts

# Test with specific user
bb rls test --table posts --user-id user-123
```

## Configuration

```typescript
// betterbase.config.ts
export default defineConfig({
  rls: {
    enabled: true,
    auditLog: true
  }
})
```

With audit logging, all policy evaluations are logged.

## Best Practices

1. **Enable RLS on all tables** - Start with RLS enabled
2. **Use specific policies** - Don't use overly permissive policies
3. **Test policies** - Verify policies work as expected
4. **Audit logs** - Enable logging for production
5. **Separate read/write policies** - Fine-tune separately

## Migration

Add RLS during migrations:

```bash
# Add policy in migration
bb migrate generate add-rls-policies
```

## Troubleshooting

```bash
# List all policies
bb rls list

# Check policy status
bb rls status --table users
```

## Related

- [Database](./database.md) - Schema and tables
- [Authentication](./authentication.md) - User authentication
- [CLI Commands](../api-reference/cli-commands.md) - RLS CLI
