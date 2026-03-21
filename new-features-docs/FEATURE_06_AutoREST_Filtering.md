# Feature 6: Auto-REST Advanced Filtering

**Priority**: Medium (Week 13)  
**Complexity**: Medium  
**Dependencies**: Structured Logging  
**Estimated Effort**: 2-3 weeks

---

## Problem Statement

Current Auto-REST only supports basic queries:
- `GET /api/users?id=123` (equality only)

Developers need:
- Range: `?age_gte=18&age_lte=65`
- Pattern: `?name_like=john`
- IN: `?status_in=active,pending`
- Null checks: `?deleted_at_is_null=true`

---

## Solution

Parse advanced operators from query params and map to Drizzle filters.

**Format**: `column_operator=value`

**Examples**:
- `?age_gte=18` → `age >= 18`
- `?name_like=john` → `name LIKE '%john%'`
- `?status_in=active,pending` → `status IN ('active', 'pending')`

---

## Implementation

### Step 1: Define Operators

**File**: `packages/core/src/auto-rest.ts`

**ADD** at top:

```typescript
import { eq, ne, gt, gte, lt, lte, like, ilike, inArray, isNull, isNotNull, and } from 'drizzle-orm';

export const QUERY_OPERATORS = {
  eq: (col: any, val: any) => eq(col, val),
  neq: (col: any, val: any) => ne(col, val),
  gt: (col: any, val: any) => gt(col, val),
  gte: (col: any, val: any) => gte(col, val),
  lt: (col: any, val: any) => lt(col, val),
  lte: (col: any, val: any) => lte(col, val),
  like: (col: any, val: any) => like(col, `%${val}%`),
  ilike: (col: any, val: any) => ilike(col, `%${val}%`),
  in: (col: any, val: any) => {
    const values = typeof val === 'string' ? val.split(',') : val;
    return inArray(col, values);
  },
  is_null: (col: any, val: any) => {
    const check = val === 'true' || val === true;
    return check ? isNull(col) : isNotNull(col);
  },
} as const;

function parseFilter(key: string, value: string, schema: any): any | null {
  const parts = key.split('_');
  
  let operator: string | null = null;
  let columnName: string | null = null;
  
  // Try two-word operators (is_null)
  if (parts.length >= 3) {
    const twoWord = `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
    if (twoWord in QUERY_OPERATORS) {
      operator = twoWord;
      columnName = parts.slice(0, -2).join('_');
    }
  }
  
  // Try one-word operators
  if (!operator && parts.length >= 2) {
    const oneWord = parts[parts.length - 1];
    if (oneWord in QUERY_OPERATORS) {
      operator = oneWord;
      columnName = parts.slice(0, -1).join('_');
    }
  }
  
  // No operator = equality
  if (!operator) {
    operator = 'eq';
    columnName = key;
  }
  
  const column = schema[columnName];
  if (!column) return null;
  
  const opFn = QUERY_OPERATORS[operator as keyof typeof QUERY_OPERATORS];
  if (!opFn) return null;
  
  return opFn(column, value);
}
```

---

### Step 2: Update GET Handler

**FIND** the existing GET route:

```typescript
app.get('/api/:table', async (c) => {
  // ... existing code
});
```

**REPLACE** with:

```typescript
app.get('/api/:table', async (c) => {
  const tableName = c.req.param('table');
  const queryParams = c.req.query();
  
  const table = schema[tableName];
  if (!table) {
    return c.json({ error: 'Table not found' }, 404);
  }
  
  let query = db.select().from(table);
  
  // Apply filters
  const filters: any[] = [];
  const specialParams = ['limit', 'offset', 'order_by', 'order'];
  
  for (const [key, value] of Object.entries(queryParams)) {
    if (specialParams.includes(key)) continue;
    
    const filter = parseFilter(key, value as string, table);
    if (filter) filters.push(filter);
  }
  
  if (filters.length > 0) {
    query = query.where(and(...filters));
  }
  
  // Ordering
  if (queryParams.order_by) {
    const column = table[queryParams.order_by];
    if (column) {
      const direction = queryParams.order === 'desc' ? desc : asc;
      query = query.orderBy(direction(column));
    }
  }
  
  // Pagination
  const limit = parseInt(queryParams.limit || '100', 10);
  const offset = parseInt(queryParams.offset || '0', 10);
  
  query = query.limit(Math.min(limit, 1000)).offset(offset);
  
  const results = await query;
  
  return c.json({
    data: results,
    count: results.length,
    limit,
    offset,
  });
});
```

---

### Step 3: Add Security Config

**File**: `packages/core/src/config/schema.ts`

**ADD**:

```typescript
autoRest: z.object({
  enabled: z.boolean().default(true),
  basePath: z.string().default('/api'),
  tables: z.record(z.object({
    advancedFilters: z.boolean().default(false),
    maxLimit: z.number().default(1000),
  })).optional(),
}).optional(),
```

**Then check config in route handler**:

```typescript
const tableConfig = config.autoRest?.tables?.[tableName];
if (!tableConfig?.advancedFilters) {
  // Only allow eq operator
  // Skip advanced operators
}
```

---

## Acceptance Criteria

- [ ] Operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is_null
- [ ] Parse format: `column_operator=value`
- [ ] Multiple filters: `?age_gte=18&status=active`
- [ ] IN splits commas: `?status_in=active,pending`
- [ ] LIKE adds wildcards: `?name_like=john` → `%john%`
- [ ] Ordering: `?order_by=created_at&order=desc`
- [ ] Pagination: `?limit=50&offset=100`
- [ ] Config controls advanced filters per table
- [ ] Test: `?age_gte=18&age_lte=65` returns users 18-65
