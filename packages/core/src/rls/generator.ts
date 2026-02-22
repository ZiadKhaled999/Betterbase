/**
 * RLS Policy SQL Generator
 *
 * Generates PostgreSQL statements for creating and dropping
 * Row Level Security policies.
 */

import type { PolicyDefinition } from './types'

/**
 * SQL operation types supported by RLS policies
 */
export type PolicyOperation = 'select' | 'insert' | 'update' | 'delete'

/**
 * Generates a policy name from table and operation
 * @param table - The table name
 * @param operation - The operation type
 * @returns The policy name
 */
function getPolicyName(table: string, operation: PolicyOperation): string {
  return `${table}_${operation}_policy`
}

/**
 * Enable Row Level Security on a table
 * @param table - The table name
 * @returns SQL statement to enable RLS
 */
function enableRLS(table: string): string {
  return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
}

/**
 * Generate SQL for a single policy operation
 * @param policy - The policy definition
 * @param operation - The operation type
 * @returns SQL statement for the policy, or null if not defined
 */
function generatePolicyStatement(
  policy: PolicyDefinition,
  operation: PolicyOperation,
): string | null {
  const policyName = getPolicyName(policy.table, operation)
  const tableName = policy.table

  // Determine the USING clause
  // Priority: explicit using > operation-specific > fallback
  let usingClause = ''
  if (operation === 'select' || operation === 'update' || operation === 'delete') {
    if (policy.using) {
      usingClause = ` USING (${policy.using})`
    } else if (policy[operation]) {
      usingClause = ` USING (${policy[operation]})`
    }
  }

  // Determine the WITH CHECK clause
  // Priority: explicit withCheck > operation-specific > fallback
  let withCheckClause = ''
  if (operation === 'insert' || operation === 'update') {
    if (policy.withCheck) {
      withCheckClause = ` WITH CHECK (${policy.withCheck})`
    } else if (policy[operation]) {
      withCheckClause = ` WITH CHECK (${policy[operation]})`
    }
  }

  // If no condition is defined, skip this operation
  const hasCondition =
    (operation === 'select' && (policy.select || policy.using)) ||
    (operation === 'insert' && (policy.insert || policy.withCheck)) ||
    (operation === 'update' && (policy.update || policy.using || policy.withCheck)) ||
    (operation === 'delete' && (policy.delete || policy.using))

  if (!hasCondition) {
    return null
  }

  // Build the CREATE POLICY statement
  const sql = `CREATE POLICY ${policyName} ON ${tableName} FOR ${operation.toUpperCase()}${usingClause}${withCheckClause};`

  return sql
}

/**
 * Convert a PolicyDefinition to an array of SQL statements
 * @param policy - The policy definition
 * @returns Array of SQL statements to apply the policy
 *
 * @example
 * ```typescript
 * const policy = definePolicy('users', {
 *   select: "auth.uid() = id",
 *   update: "auth.uid() = id",
 *   delete: "auth.uid() = id"
 * });
 *
 * const sql = policyToSQL(policy);
 * // Returns:
 * // [
 * //   "ALTER TABLE users ENABLE ROW LEVEL SECURITY;",
 * //   "CREATE POLICY users_select_policy ON users FOR SELECT USING (auth.uid() = id);",
 * //   "CREATE POLICY users_update_policy ON users FOR UPDATE USING (auth.uid() = id);",
 * //   "CREATE POLICY users_delete_policy ON users FOR DELETE USING (auth.uid() = id);"
 * // ]
 * ```
 */
export function policyToSQL(policy: PolicyDefinition): string[] {
  const statements: string[] = []

  // First, enable RLS on the table
  statements.push(enableRLS(policy.table))

  // Generate policy for each operation that has a condition
  const operations: PolicyOperation[] = ['select', 'insert', 'update', 'delete']

  for (const operation of operations) {
    const statement = generatePolicyStatement(policy, operation)
    if (statement) {
      statements.push(statement)
    }
  }

  return statements
}

/**
 * Generate DROP POLICY statements for a policy
 * @param policy - The policy definition
 * @returns Array of SQL statements to drop the policy
 *
 * @example
 * ```typescript
 * const policy = definePolicy('users', {
 *   select: "auth.uid() = id"
 * });
 *
 * const dropSQL = dropPolicySQL(policy);
 * // Returns:
 * // ["DROP POLICY IF EXISTS users_select_policy ON users;"]
 * ```
 */
export function dropPolicySQL(policy: PolicyDefinition): string[] {
  const statements: string[] = []
  const operations: PolicyOperation[] = ['select', 'insert', 'update', 'delete']

  for (const operation of operations) {
    const policyName = getPolicyName(policy.table, operation)
    statements.push(`DROP POLICY IF EXISTS ${policyName} ON ${policy.table};`)
  }

  // Also disable RLS on the table
  statements.push(`ALTER TABLE ${policy.table} DISABLE ROW LEVEL SECURITY;`)

  return statements
}

/**
 * Generate SQL to drop a specific policy by name
 * @param table - The table name
 * @param operation - The operation type
 * @returns DROP POLICY statement
 */
export function dropPolicyByName(table: string, operation: PolicyOperation): string {
  const policyName = getPolicyName(table, operation)
  return `DROP POLICY IF EXISTS ${policyName} ON ${table};`
}

/**
 * Generate SQL to disable RLS on a table
 * @param table - The table name
 * @returns ALTER TABLE statement
 */
export function disableRLS(table: string): string {
  return `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
}

/**
 * Check if a policy has any conditions defined
 * @param policy - The policy definition
 * @returns true if the policy has at least one condition
 */
export function hasPolicyConditions(policy: PolicyDefinition): boolean {
  return !!(
    policy.select ||
    policy.insert ||
    policy.update ||
    policy.delete ||
    policy.using ||
    policy.withCheck
  )
}

/**
 * Generate all SQL for multiple policies
 * @param policies - Array of policy definitions
 * @returns Combined array of SQL statements
 */
export function policiesToSQL(policies: PolicyDefinition[]): string[] {
  return policies.flatMap((policy) => policyToSQL(policy))
}

/**
 * Generate all DROP SQL for multiple policies
 * @param policies - Array of policy definitions
 * @returns Combined array of DROP statements
 */
export function dropPoliciesSQL(policies: PolicyDefinition[]): string[] {
  return policies.flatMap((policy) => dropPolicySQL(policy))
}
