/**
 * RLS (Row Level Security) Policy Definition Types
 *
 * This module provides types and helpers for defining RLS policies
 * that can be applied to database tables.
 */

/**
 * Defines an RLS policy for a database table
 */
export interface PolicyDefinition {
  /** The table name this policy applies to */
  table: string
  /** SELECT policy condition (SQL expression) */
  select?: string
  /** INSERT policy condition (SQL expression) */
  insert?: string
  /** UPDATE policy condition (SQL expression) */
  update?: string
  /** DELETE policy condition (SQL expression) */
  delete?: string
  /** USING clause - used for SELECT, UPDATE, DELETE operations */
  using?: string
  /** WITH CHECK clause - used for INSERT, UPDATE operations */
  withCheck?: string
}

/**
 * Configuration for definePolicy excluding the table name
 * (table is passed as the first argument)
 */
export type PolicyConfig = Omit<PolicyDefinition, 'table'>

/**
 * Helper function to create a PolicyDefinition
 * @param table - The table name this policy applies to
 * @param config - The policy configuration
 * @returns A PolicyDefinition object
 *
 * @example
 * ```typescript
 * const policy = definePolicy('users', {
 *   select: "auth.uid() = id",
 *   update: "auth.uid() = id",
 *   delete: "auth.uid() = id"
 * });
 * ```
 */
export function definePolicy(table: string, config: PolicyConfig): PolicyDefinition {
  return {
    table,
    ...config,
  }
}

/**
 * Type guard to check if a value is a valid PolicyDefinition
 * @param value - The value to check
 * @returns true if the value is a valid PolicyDefinition
 */
export function isPolicyDefinition(value: unknown): value is PolicyDefinition {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj.table === 'string' && obj.table.length > 0
}

/**
 * Merge multiple policy configs for the same table
 * @param policies - Array of policy definitions
 * @returns Merged policy for each table
 */
export function mergePolicies(policies: PolicyDefinition[]): PolicyDefinition[] {
  const merged = new Map<string, PolicyDefinition>()

  for (const policy of policies) {
    const existing = merged.get(policy.table)
    if (existing) {
      merged.set(policy.table, {
        table: policy.table,
        select: policy.select ?? existing.select,
        insert: policy.insert ?? existing.insert,
        update: policy.update ?? existing.update,
        delete: policy.delete ?? existing.delete,
        using: policy.using ?? existing.using,
        withCheck: policy.withCheck ?? existing.withCheck,
      })
    } else {
      merged.set(policy.table, { ...policy })
    }
  }

  return Array.from(merged.values())
}
