/**
 * BetterBase Configuration File
 *
 * This file defines the configuration for your BetterBase project.
 * Update the values below to match your project requirements.
 *
 * Required environment variables:
 * - DATABASE_URL: Connection string for your database (for neon, postgres, supabase, planetscale)
 * - TURSO_URL: libSQL connection URL (for turso)
 * - TURSO_AUTH_TOKEN: Auth token for Turso database (for turso)
 */

import type { BetterBaseConfig } from "@betterbase/core";

/**
 * Validate DATABASE_URL is present and non-empty
 */
function getDatabaseUrl(): string {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl || typeof dbUrl !== "string" || dbUrl.trim() === "") {
		console.error(
			"[BetterBase Config Error] DATABASE_URL is required but not set or is empty. " +
				"Please set the DATABASE_URL environment variable.\n" +
				'Example: DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"',
		);
		process.exit(1);
	}
	return dbUrl;
}

/**
 * BetterBase Project Configuration
 *
 * @example
 * ```typescript
 * export default {
 *   project: {
 *     name: 'my-betterbase-app',
 *   },
 *   provider: {
 *     type: 'postgres',
 *     connectionString: process.env.DATABASE_URL,
 *   },
 * } satisfies BetterBaseConfig
 * ```
 */
export default {
	/** Project name - used for identification and metadata */
	project: {
		name: "my-betterbase-app",
	},

	/**
	 * Database provider configuration
	 *
	 * Supported providers:
	 * - 'postgres': Standard PostgreSQL (uses DATABASE_URL)
	 * - 'neon': Neon serverless PostgreSQL (uses DATABASE_URL)
	 * - 'supabase': Supabase PostgreSQL (uses DATABASE_URL)
	 * - 'planetscale': PlanetScale MySQL (uses DATABASE_URL)
	 * - 'turso': Turso libSQL (uses TURSO_URL and TURSO_AUTH_TOKEN)
	 * - 'managed': BetterBase managed database (uses DATABASE_URL or defaults to local.db)
	 */
	provider: {
		/** The database provider type */
		type: "postgres" as const,

		/**
		 * Database connection string (for postgres, neon, supabase, planetscale)
		 * Format: postgresql://user:pass@host:port/db for PostgreSQL
		 * Format: mysql://user:pass@host:port/db for MySQL/PlanetScale
		 */
		connectionString: getDatabaseUrl(),

		// Turso-specific (uncomment if using Turso):
		// url: process.env.TURSO_URL,
		// authToken: process.env.TURSO_AUTH_TOKEN,
	},

	/**
	 * Storage configuration (Phase 14)
	 * Uncomment and configure when implementing file storage
	 */
	// storage: {
	//   provider: 's3', // 's3' | 'r2' | 'backblaze' | 'minio' | 'managed'
	//   bucket: 'my-bucket',
	//   region: 'us-east-1',
	//   // For S3-compatible providers:
	//   // endpoint: 'https://s3.amazonaws.com',
	// },

	/**
	 * Webhook configuration (Phase 13)
	 * Uncomment and configure when implementing webhooks
	 */
	// webhooks: [
	//   {
	//     id: 'webhook-1',
	//     table: 'users',
	//     events: ['INSERT', 'UPDATE', 'DELETE'],
	//     url: 'https://example.com/webhook',
	//     secret: process.env.WEBHOOK_SECRET!,
	//     enabled: true,
	//   },
	// ],

	/**
	 * GraphQL API configuration
	 * Set enabled: false to disable the GraphQL API
	 */
	graphql: {
		enabled: true,
	},
} satisfies BetterBaseConfig;
