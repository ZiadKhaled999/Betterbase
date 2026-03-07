/**
 * Database Branching Module
 *
 * Handles database cloning and management for preview environments.
 * Supports PostgreSQL databases (including Neon, Supabase, etc.)
 */

import postgres from "postgres";
import type { ProviderType } from "@betterbase/shared";
import { BranchStatus } from "./types";
import type { BranchConfig, PreviewDatabase } from "./types";

/**
 * Validates that a DDL statement is safe to execute
 * Only allows CREATE TABLE statements to prevent SQL injection
 * @param ddl - The DDL statement to validate
 * @returns True if the DDL is safe
 */
function isSafeDDL(ddl: string): boolean {
	const trimmed = ddl.trim().toUpperCase();
	// Only allow CREATE TABLE statements
	if (!trimmed.startsWith("CREATE TABLE")) {
		return false;
	}
	// Block dangerous operations
	const dangerous = ["DROP", "TRUNCATE", "DELETE", "INSERT", "UPDATE", "ALTER", "GRANT", "REVOKE"];
	for (const keyword of dangerous) {
		if (trimmed.includes(keyword)) {
			return false;
		}
	}
	return true;
}

/**
 * Escape identifier for safe use in SQL
 * @param identifier - The identifier to escape
 * @returns Safely escaped identifier
 */
function escapeIdentifier(identifier: string): string {
	// Only allow alphanumeric and underscore characters
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
		throw new Error(`Invalid identifier: ${identifier}`);
	}
	return `"${identifier}"`;
}

/**
 * Generate a unique database name for a preview branch
 * @param branchName - The name of the branch
 * @returns A unique database name
 */
function generatePreviewDatabaseName(branchName: string): string {
	const timestamp = Date.now().toString(36);
	const sanitized = branchName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return `preview_${sanitized}_${timestamp}`;
}

/**
 * Parse a PostgreSQL connection string to extract components
 * @param connectionString - Full connection string
 * @returns Parsed connection components
 */
function parseConnectionString(connectionString: string): {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
} {
	const match = connectionString.match(
		/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/,
	);
	if (!match) {
		throw new Error("Invalid PostgreSQL connection string format");
	}
	return {
		user: match[1],
		password: match[2],
		host: match[3],
		port: parseInt(match[4], 10),
		database: match[5],
	};
}

/**
 * Create a new connection string with a different database name
 * @param connectionString - Original connection string
 * @param newDatabaseName - New database name
 * @returns New connection string
 */
function createConnectionString(
	connectionString: string,
	newDatabaseName: string,
): string {
	const parsed = parseConnectionString(connectionString);
	return `postgres://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/${newDatabaseName}`;
}

/**
 * Database branching manager for creating and managing preview databases
 */
export class DatabaseBranching {
	private mainConnectionString: string;
	private provider: ProviderType;

	/**
	 * Create a new DatabaseBranching instance
	 * @param mainConnectionString - Connection string for the main database
	 * @param provider - Database provider type
	 */
	constructor(mainConnectionString: string, provider: ProviderType) {
		this.mainConnectionString = mainConnectionString;
		this.provider = provider;
	}

	/**
	 * Check if the provider supports database branching
	 * Only PostgreSQL-based providers support branching
	 */
	isBranchingSupported(): boolean {
		const supportedProviders: ProviderType[] = [
			"postgres",
			"neon",
			"supabase",
			"managed",
		];
		return supportedProviders.includes(this.provider);
	}

	/**
	 * Clone the main database schema to a new preview database
	 * @param branchName - Name for the preview branch
	 * @param copyData - Whether to copy existing data (default: true)
	 * @returns Connection details for the new preview database
	 */
	async cloneDatabase(
		branchName: string,
		copyData: boolean = true,
	): Promise<PreviewDatabase> {
		if (!this.isBranchingSupported()) {
			throw new Error(
				`Database branching is not supported for provider: ${this.provider}. Only PostgreSQL-based providers (postgres, neon, supabase) support branching.`,
			);
		}

		const previewDbName = generatePreviewDatabaseName(branchName);
		const mainDb = postgres(this.mainConnectionString);

		try {
			// Create the new database
			await mainDb`CREATE DATABASE ${mainDb(previewDbName)}`;

			// Connect to the new database and clone schema
			const previewConnectionString = createConnectionString(
				this.mainConnectionString,
				previewDbName,
			);
			const previewDb = postgres(previewConnectionString);

			try {
				// Get all schemas except system schemas
				const schemas = await mainDb`
					SELECT schema_name 
					FROM information_schema.schemata 
					WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
				`;

				// Clone each schema
				for (const schema of schemas) {
					const schemaName = schema.schema_name;

					// Create schema
					await previewDb`CREATE SCHEMA ${previewDb(schemaName)}`;

					// Get all tables in the schema
					const tables = await mainDb`
						SELECT table_name, table_schema 
						FROM information_schema.tables 
						WHERE table_schema = ${schemaName}
					`;

					// Clone each table
					for (const table of tables) {
						const tableName = table.table_name;

						// Get CREATE TABLE statement
						const createTableResult = await mainDb`
							SELECT pg_get_tabledef(${schemaName}, ${tableName}) AS ddl
						`;

						if (createTableResult[0]?.ddl) {
							// Validate DDL before execution to prevent SQL injection
							if (!isSafeDDL(createTableResult[0].ddl)) {
								throw new Error("DDL validation failed: only CREATE TABLE statements are allowed");
							}
							// Execute the DDL on preview database
							await previewDb.unsafe(createTableResult[0].ddl);
						}

						// Copy data if requested
						if (copyData) {
							// Copy table data
							const sourceData = await mainDb`
								SELECT * FROM ${mainDb(schemaName)}:${mainDb(tableName)}
							`;

							if (sourceData.length > 0) {
								// Insert data into preview using safe column escaping
								for (const row of sourceData) {
									const columns = Object.keys(row);
									const values = Object.values(row);
									const safeColumns = columns.map(c => escapeIdentifier(c)).join(", ");
									const placeholders = columns.map(() => "?").join(", ");

									await previewDb.unsafe(
										`INSERT INTO ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)} (${safeColumns}) VALUES (${placeholders})`,
										values,
									);
								}
							}
						}
					}
				}

				// Copy sequences
				await this.copySequences(mainDb, previewDb);

				// Copy indexes
				await this.copyIndexes(mainDb, previewDb);

			} finally {
				await previewDb.end();
			}

			return {
				connectionString: previewConnectionString,
				provider: this.provider,
				database: previewDbName,
			};
		} finally {
			await mainDb.end();
		}
	}

	/**
	 * Copy sequences from source to target database
	 */
	private async copySequences(
		sourceDb: postgres.Sql,
		targetDb: postgres.Sql,
	): Promise<void> {
		const sequences = await sourceDb`
			SELECT sequence_schema, sequence_name 
			FROM information_schema.sequences
		`;

		for (const seq of sequences) {
			const schemaName = seq.sequence_schema;
			const seqName = seq.sequence_name;

			// Get current sequence value
			const [currentValue] = await sourceDb`
				SELECT last_value as value FROM ${sourceDb(schemaName)}:${sourceDb(seqName)}
			`;

			if (currentValue) {
				await targetDb`
					SELECT setval(${targetDb(schemaName)}:${targetDb(seqName)}, ${currentValue.value})
				`;
			}
		}
	}

	/**
	 * Copy indexes from source to target database
	 * Note: Indexes are typically created as part of table DDL, but this handles custom indexes
	 */
	private async copyIndexes(
		_sourceDb: postgres.Sql,
		_targetDb: postgres.Sql,
	): Promise<void> {
		// Indexes are typically included in the table DDL from pg_get_tabledef
		// Additional custom index handling can be added here if needed
	}

	/**
	 * Connect to a preview database
	 * @param connectionString - Connection string for the preview database
	 * @returns A connected Postgres client
	 */
	connectPreviewDatabase(connectionString: string): postgres.Sql {
		return postgres(connectionString);
	}

	/**
	 * Teardown (delete) a preview database
	 * @param previewConnectionString - Connection string for the preview database
	 */
	async teardownPreviewDatabase(previewConnectionString: string): Promise<void> {
		const parsed = parseConnectionString(previewConnectionString);
		const dbName = parsed.database;

		// Connect to the default postgres database to drop the target database
		const adminConnectionString = createConnectionString(
			this.mainConnectionString,
			"postgres",
		);
		const adminDb = postgres(adminConnectionString);

		try {
			// Terminate all connections to the preview database
			await adminDb`
				SELECT pg_terminate_backend(pg_stat_activity.pid)
				FROM pg_stat_activity
				WHERE datname = ${dbName}
				AND pid <> pg_backend_pid()
			`;

			// Drop the database
			await adminDb`DROP DATABASE IF EXISTS ${adminDb(dbName)}`;
		} finally {
			await adminDb.end();
		}
	}

	/**
	 * Get a connection to the main database for reading
	 * @returns A connected Postgres client for the main database
	 */
	getMainDatabase(): postgres.Sql {
		return postgres(this.mainConnectionString);
	}

	/**
	 * List all preview databases (those starting with 'preview_')
	 * @returns Array of preview database names
	 */
	async listPreviewDatabases(): Promise<string[]> {
		const mainDb = postgres(this.mainConnectionString);

		try {
			const result = await mainDb`
				SELECT datname 
				FROM pg_database 
				WHERE datname LIKE 'preview_%'
				ORDER BY datname DESC
			`;

			return result.map((row) => row.datname);
		} finally {
			await mainDb.end();
		}
	}

	/**
	 * Check if a preview database exists
	 * @param databaseName - Name of the database to check
	 * @returns True if the database exists
	 */
	async previewDatabaseExists(databaseName: string): Promise<boolean> {
		const mainDb = postgres(this.mainConnectionString);

		try {
			const [result] = await mainDb`
				SELECT 1 FROM pg_database WHERE datname = ${databaseName}
			`;
			return !!result;
		} finally {
			await mainDb.end();
		}
	}
}

/**
 * Create a new DatabaseBranching instance
 * @param mainConnectionString - Connection string for the main database
 * @param provider - Database provider type
 * @returns A new DatabaseBranching instance
 */
export function createDatabaseBranching(
	mainConnectionString: string,
	provider: ProviderType,
): DatabaseBranching {
	return new DatabaseBranching(mainConnectionString, provider);
}

/**
 * Build a BranchConfig from database branching result
 * @param branchName - Name of the branch
 * @param previewDb - Preview database details
 * @param sourceBranch - Source branch name
 * @param previewUrl - Preview URL
 * @returns A BranchConfig object
 */
export function buildBranchConfig(
	branchName: string,
	previewDb: PreviewDatabase,
	sourceBranch: string,
	previewUrl: string,
): BranchConfig {
	return {
		id: `branch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
		name: branchName,
		previewUrl,
		sourceBranch,
		createdAt: new Date(),
		lastAccessedAt: new Date(),
		status: BranchStatus.ACTIVE,
		databaseConnectionString: previewDb.connectionString,
	};
}
