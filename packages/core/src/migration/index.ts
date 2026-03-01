/**
 * Migration Module
 *
 * Handles database migrations including schema changes and RLS policies.
 */

import type { DatabaseConnection, ProviderAdapter } from "../providers/types";
import { scanPolicies } from "../rls/scanner";
import { applyAuthFunction, applyPolicies, applyRLSMigration } from "./rls-migrator";

// Re-export RLS migrator functions
export {
	applyPolicies,
	applyAuthFunction,
	applyRLSMigration,
} from "./rls-migrator";

/**
 * Run migration for a project
 *
 * This includes:
 * 1. Schema migration (via drizzle-kit)
 * 2. RLS policy application
 *
 * @param projectRoot - Path to the project
 * @param db - Database connection
 * @param provider - Provider adapter
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * import { runMigration } from '@betterbase/core/migration'
 *
 * await runMigration('/path/to/project', db, provider)
 * ```
 */
export async function runMigration(
	projectRoot: string,
	db: DatabaseConnection,
	provider: ProviderAdapter,
): Promise<void> {
	// Check if provider supports RLS
	const supportsRLS = provider.supportsRLS();

	if (!supportsRLS) {
		console.warn("⚠️  Provider does not support Row Level Security. Skipping RLS migration.");
		return;
	}

	// Scan for policies in the project
	const { policies, errors } = await scanPolicies(projectRoot);

	if (errors.length > 0) {
		console.warn(
			"⚠️  Some policies failed to load:",
			errors.map((e) => e.message),
		);
	}

	if (policies.length === 0) {
		console.log("ℹ️  No RLS policies found to apply.");
		return;
	}

	// Log the tables being processed
	const tables = [...new Set(policies.map((p) => p.table))];
	console.log(`Applying RLS policies: ${tables.join(", ")} (${policies.length} policies)`);

	// Apply RLS migration
	await applyRLSMigration(policies, db);

	console.log("✅ RLS policies applied successfully.");
}

/**
 * Check if RLS is supported by the current provider
 * @param provider - Provider adapter
 * @returns true if RLS is supported
 */
export function isRLSSupported(provider: ProviderAdapter): boolean {
	return provider.supportsRLS();
}
