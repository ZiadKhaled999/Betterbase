# Feature 9: RLS Policy Testing Tool

**Priority**: Medium (Week 16)  
**Complexity**: Medium  
**Dependencies**: Migrations, Structured Logging  
**Estimated Effort**: 1 week

---

## Problem Statement

RLS policies are critical for security but hard to test:
- No visibility if policies work correctly
- Manual testing is error-prone
- Production bugs are catastrophic (data leaks)

---

## Solution

CLI tool that:
- Creates temporary test schema (isolated)
- Generates test data
- Simulates queries as different users
- Outputs pass/fail results (JSON)
- Cleans up after test

---

## Implementation

### Step 1: Create Test Runner

**File**: `packages/cli/src/commands/rls-test.ts` (NEW)

```typescript
import { nanoid } from 'nanoid';

type RLSTestCase = {
  name: string;
  user_id: string;
  query: string;
  expected: 'allowed' | 'blocked';
  expectedRowCount?: number;
};

type RLSTestResult = {
  test: string;
  passed: boolean;
  actual: 'allowed' | 'blocked';
  expected: 'allowed' | 'blocked';
  rowCount?: number;
  error?: string;
};

export async function runRLSTestCommand(
  projectRoot: string,
  tableName: string
): Promise<void> {
  logger.info(`Testing RLS policies for: ${tableName}`);

  const db = await loadDatabaseConnection(projectRoot);

  // Create test schema
  const testSchema = `test_${nanoid(8)}`;
  await db.execute(`CREATE SCHEMA ${testSchema}`);

  try {
    // Copy table structure
    await db.execute(`
      CREATE TABLE ${testSchema}.${tableName} 
      (LIKE public.${tableName} INCLUDING ALL)
    `);

    // Enable RLS
    await db.execute(`
      ALTER TABLE ${testSchema}.${tableName} 
      ENABLE ROW LEVEL SECURITY
    `);

    // Apply policies (load from files)
    const policies = await loadTablePolicies(projectRoot, tableName);
    for (const policy of policies) {
      const sql = generatePolicySQL(testSchema, tableName, policy);
      await db.execute(sql);
    }

    // Create test data
    const user1 = 'test_user_1';
    const user2 = 'test_user_2';

    await db.execute({
      sql: `INSERT INTO ${testSchema}.${tableName} (id, user_id, title) VALUES (?, ?, ?)`,
      args: [nanoid(), user1, 'Post by user 1'],
    });

    await db.execute({
      sql: `INSERT INTO ${testSchema}.${tableName} (id, user_id, title) VALUES (?, ?, ?)`,
      args: [nanoid(), user2, 'Post by user 2'],
    });

    // Test cases
    const tests: RLSTestCase[] = [
      {
        name: 'User can read own records',
        user_id: user1,
        query: `SELECT * FROM ${testSchema}.${tableName} WHERE user_id = '${user1}'`,
        expected: 'allowed',
        expectedRowCount: 1,
      },
      {
        name: 'User cannot read others records',
        user_id: user1,
        query: `SELECT * FROM ${testSchema}.${tableName} WHERE user_id = '${user2}'`,
        expected: 'blocked',
        expectedRowCount: 0,
      },
    ];

    // Run tests
    const results: RLSTestResult[] = [];

    for (const test of tests) {
      // Set current user
      await db.execute(`SELECT set_config('request.jwt.claims.sub', '${test.user_id}', true)`);

      let actual: 'allowed' | 'blocked' = 'blocked';
      let rowCount: number | undefined;
      let error: string | undefined;

      try {
        const result = await db.execute(test.query);
        actual = 'allowed';
        rowCount = result.rows?.length;
      } catch (err) {
        actual = 'blocked';
        error = err instanceof Error ? err.message : 'Unknown';
      }

      const passed = actual === test.expected && 
        (test.expectedRowCount === undefined || rowCount === test.expectedRowCount);

      results.push({
        test: test.name,
        passed,
        actual,
        expected: test.expected,
        rowCount,
        error,
      });

      if (passed) {
        logger.success(`✅ ${test.name}`);
      } else {
        logger.error(`❌ ${test.name}`);
      }
    }

    // Output JSON
    console.log('\nResults:');
    console.log(JSON.stringify({
      table: tableName,
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
    }, null, 2));

  } finally {
    // Cleanup
    await db.execute(`DROP SCHEMA ${testSchema} CASCADE`);
    logger.info('Test schema cleaned up');
  }
}
```

---

### Step 2: Register CLI Command

**File**: `packages/cli/src/index.ts`

```typescript
import { runRLSTestCommand } from './commands/rls-test';

program
  .command('rls:test <table>')
  .description('Test RLS policies')
  .action(async (table: string) => {
    await runRLSTestCommand(process.cwd(), table);
  });
```

---

## Acceptance Criteria

- [ ] `bb rls:test <table>` command works
- [ ] Creates temporary test schema
- [ ] Generates test data (multiple users)
- [ ] Tests SELECT, INSERT, UPDATE, DELETE
- [ ] Outputs JSON with pass/fail
- [ ] Cleans up test schema after
- [ ] Test: Run on table with policies, verify results
