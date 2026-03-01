import type { ProviderType } from "@betterbase/shared";
import postgres from "postgres";
import type {
	DatabaseConnection,
	DrizzleMigrationDriver,
	PostgresDatabaseConnection,
	ProviderAdapter,
	ProviderConfig,
} from "./types";
import { parseProviderConfig } from "./types";

// Type for the Postgres client
type PostgresClient = ReturnType<typeof postgres>;

/**
 * Standard Postgres-specific database connection implementation
 */
class PostgresConnection implements PostgresDatabaseConnection {
	readonly provider = "postgres" as const;
	readonly postgres: PostgresClient;
	// Store the drizzle-compatible client for use with drizzle-orm
	readonly drizzle: PostgresClient;
	private _isConnected = false;

	constructor(connectionString: string) {
		this.postgres = postgres(connectionString);
		this.drizzle = this.postgres;
		this._isConnected = true;
	}

	async close(): Promise<void> {
		await this.postgres.end();
		this._isConnected = false;
	}

	isConnected(): boolean {
		return this._isConnected;
	}
}

/**
 * Standard Postgres migration driver implementation
 */
class PostgresMigrationDriver implements DrizzleMigrationDriver {
	private readonly connectionString: string;

	constructor(connectionString: string) {
		this.connectionString = connectionString;
	}

	async migrate(_migrations: string[], _direction: "up" | "down"): Promise<void> {
		// Migration implementation would go here
		// For now, this is a placeholder
		console.log("Running migrations with Postgres driver...");
	}

	async createMigrationTable(): Promise<void> {
		// Create the __drizzle_migrations table if it doesn't exist
		console.log("Creating migration table with Postgres driver...");
	}

	async getPendingMigrations(): Promise<string[]> {
		// Return list of pending migrations
		return [];
	}
}

/**
 * Standard Postgres database provider adapter
 * Implements the ProviderAdapter interface for standard Postgres connections
 */
export class PostgresProviderAdapter implements ProviderAdapter {
	readonly type: ProviderType = "postgres";
	readonly dialect = "postgres" as const;
	private _connectionString: string | null = null;

	/**
	 * Connect to a standard Postgres database
	 * @param config - The provider configuration
	 * @returns A promise that resolves to a Postgres database connection
	 */
	async connect(config: ProviderConfig): Promise<DatabaseConnection> {
		const validatedConfig = parseProviderConfig(config);

		if (validatedConfig.type !== "postgres") {
			throw new Error("Invalid configuration: expected Postgres provider config");
		}

		const connectionString = validatedConfig.connectionString;

		if (!connectionString) {
			throw new Error("Postgres provider requires a connectionString");
		}

		// Store connection string for later use by getMigrationsDriver
		this._connectionString = connectionString;

		return new PostgresConnection(connectionString);
	}

	/**
	 * Get the migrations driver for standard Postgres
	 * @returns A Postgres migration driver instance
	 */
	getMigrationsDriver(): DrizzleMigrationDriver {
		if (!this._connectionString) {
			throw new Error("Migration driver not initialized. Call connect() first.");
		}
		return new PostgresMigrationDriver(this._connectionString);
	}

	/**
	 * Standard Postgres supports Row Level Security (RLS)
	 * @returns true as Postgres has built-in RLS support
	 */
	supportsRLS(): boolean {
		return true;
	}

	/**
	 * Standard Postgres supports GraphQL
	 * @returns true
	 */
	supportsGraphQL(): boolean {
		return true;
	}
}

/**
 * Create a new standard Postgres provider adapter instance
 * @returns A new PostgresProviderAdapter instance
 */
export function createPostgresProvider(): PostgresProviderAdapter {
	return new PostgresProviderAdapter();
}

// Export the adapter as default for convenience
export default PostgresProviderAdapter;
