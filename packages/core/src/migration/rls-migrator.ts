/**
 * RLS Migrator
 *
 * Applies RLS policies to the database. This module handles:
 * - Applying auth.uid() function
 * - Creating RLS policies from policy definitions
 * - Idempotent operations (safe to run multiple times)
 */

import type { DatabaseConnection } from "../providers/types";
import { dropAuthFunction, generateAuthFunction } from "../rls/auth-bridge";
import { dropPolicySQL, policyToSQL } from "../rls/generator";
import type { PolicyDefinition } from "../rls/types";

/**
 * Execute SQL statements against the database
 * @param db - Database connection
 * @param statements - SQL statements to execute
 */
async function executeStatements(db: DatabaseConnection, statements: string[]): Promise<void> {
	// Cast to any to access execute - the actual implementation depends on the provider
	const dbAny = db.drizzle as {
		execute?: (sql: { sql: string }) => Promise<unknown>;
		query?: unknown;
		$connection?: {
			execute: (sql: string) => Promise<unknown>;
		};
	};

	// Try different ways to execute raw SQL depending on the DB driver
	if (dbAny.execute) {
		for (const stmt of statements) {
			await dbAny.execute({ sql: stmt });
		}
	} else if (dbAny.$connection?.execute) {
		for (const stmt of statements) {
			await dbAny.$connection.execute(stmt);
		}
	} else {
		// Fallback: try using raw if available
		throw new Error("Cannot execute raw SQL: database driver does not support raw queries");
	}
}

/**
 * Check if a policy already exists in the database
 * @param db - Database connection
 * @param policyName - Name of the policy to check
 * @returns true if the policy exists
 */
async function policyExists(db: DatabaseConnection, policyName: string): Promise<boolean> {
	const dbAny = db.drizzle as {
		query?: {
			pg_policy?: {
				findFirst?: (args: {
					where: (sql: string) => unknown;
				}) => Promise<unknown>;
			};
		};
		execute?: (sql: { sql: string }) => Promise<unknown>;
	};

	// Try to query pg_policies system catalog
	if (dbAny.execute) {
		try {
			// Validate policy name to prevent SQL injection
			// Only allow alphanumeric characters and underscores
			if (!/^[a-zA-Z0-9_]+$/.test(policyName)) {
				console.warn(`Invalid policy name: '${policyName}'. Skipping check.`);
				return false;
			}
			const result = (await dbAny.execute({
				sql: `SELECT 1 FROM pg_policies WHERE policyname = '${policyName}' LIMIT 1`,
			})) as { rowCount?: number; rows?: unknown[] };

			return (result.rowCount ?? 0) > 0;
		} catch {
			// If query fails, assume policy doesn't exist
			return false;
		}
	}

	return false;
}

/**
 * Apply the auth.uid() function to the database
 * This function is required for RLS policies to work
 *
 * @param db - Database connection
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * import { applyAuthFunction } from '@betterbase/core/migration'
 *
 * await applyAuthFunction(db)
 * ```
 */
export async function applyAuthFunction(db: DatabaseConnection): Promise<void> {
	const sql = generateAuthFunction();
	await executeStatements(db, [sql]);
}

/**
 * Drop the auth.uid() function from the database
 * @param db - Database connection
 * @returns Promise<void>
 */
export async function dropAuthFunctionSQL(db: DatabaseConnection): Promise<void> {
	const sql = dropAuthFunction();
	await executeStatements(db, [sql]);
}

/**
 * Apply RLS policies to the database
 *
 * This function:
 * 1. Enables RLS on each table
 * 2. Creates policies for each operation
 * 3. Is idempotent - safe to run multiple times
 *
 * @param policies - Array of PolicyDefinition to apply
 * @param db - Database connection
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * import { applyPolicies } from '@betterbase/core/migration'
 * import { scanPolicies } from '@betterbase/core/rls'
 *
 * const { policies } = await scanPolicies('/path/to/project')
 * await applyPolicies(policies, db)
 * ```
 */
export async function applyPolicies(
	policies: PolicyDefinition[],
	db: DatabaseConnection,
): Promise<void> {
	if (policies.length === 0) {
		return;
	}

	// Generate all SQL statements
	const allStatements: string[] = [];

	for (const policy of policies) {
		const statements = policyToSQL(policy);
		allStatements.push(...statements);
	}

	if (allStatements.length === 0) {
		return;
	}

	// Execute all statements
	await executeStatements(db, allStatements);
}

/**
 * Drop RLS policies from the database
 *
 * @param policies - Array of PolicyDefinition to drop
 * @param db - Database connection
 * @returns Promise<void>
 */
export async function dropPolicies(
	policies: PolicyDefinition[],
	db: DatabaseConnection,
): Promise<void> {
	if (policies.length === 0) {
		return;
	}

	// Generate all DROP statements
	const allStatements: string[] = [];

	for (const policy of policies) {
		const statements = dropPolicySQL(policy);
		allStatements.push(...statements);
	}

	if (allStatements.length === 0) {
		return;
	}

	// Execute all statements
	await executeStatements(db, allStatements);
}

/**
 * Drop a specific table's RLS policies
 *
 * @param table - Table name to drop policies for
 * @param db - Database connection
 * @returns Promise<void>
 */
export async function dropTableRLS(table: string, db: DatabaseConnection): Promise<void> {
	// Import the drop functions
	const { dropPolicyByName, disableRLS } = await import("../rls/generator");

	const statements = [
		dropPolicyByName(table, "select"),
		dropPolicyByName(table, "insert"),
		dropPolicyByName(table, "update"),
		dropPolicyByName(table, "delete"),
		disableRLS(table),
	];

	await executeStatements(db, statements);
}

/**
 * Apply RLS migration including auth function and policies
 *
 * @param policies - Array of PolicyDefinition
 * @param db - Database connection
 * @returns Promise<void>
 */
export async function applyRLSMigration(
	policies: PolicyDefinition[],
	db: DatabaseConnection,
): Promise<void> {
	// First apply the auth function
	await applyAuthFunction(db);

	// Then apply policies
	await applyPolicies(policies, db);
}

/**
 * Get information about applied RLS policies
 *
 * @param db - Database connection
 * @returns Array of policy information
 */
export async function getAppliedPolicies(db: DatabaseConnection): Promise<
	Array<{
		schemaname: string;
		tablename: string;
		policyname: string;
		permissive: string;
		roles: string;
		cmd: string;
	}>
> {
	const dbAny = db.drizzle as {
		execute?: (sql: { sql: string }) => Promise<unknown>;
	};

	if (!dbAny.execute) {
		throw new Error("Cannot query policies: database driver does not support raw queries");
	}

	const result = (await dbAny.execute({
		sql: `SELECT schemaname, tablename, policyname, permissive, roles, cmd
          FROM pg_policies
          ORDER BY tablename, policyname`,
	})) as {
		rows: Array<{
			schemaname: string;
			tablename: string;
			policyname: string;
			permissive: string;
			roles: string;
			cmd: string;
		}>;
	};

	return result.rows ?? [];
}
