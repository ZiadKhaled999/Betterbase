import type { ProviderType } from "@betterbase/shared";
import { neon } from "@neondatabase/serverless";
import type {
	DatabaseConnection,
	DrizzleMigrationDriver,
	NeonDatabaseConnection,
	ProviderAdapter,
	ProviderConfig,
} from "./types";
import { parseProviderConfig } from "./types";

// Type for the Neon client - the neon() function returns a query function
// that can be used directly with drizzle-orm
type NeonClient = ReturnType<typeof neon>;

/**
 * Neon-specific database connection implementation
 */
class NeonConnection implements NeonDatabaseConnection {
	readonly provider = "neon" as const;
	readonly neon: NeonClient;
	// Store the drizzle-compatible client for use with drizzle-orm
	readonly drizzle: NeonClient;
	private _isConnected = false;

	constructor(connectionString: string) {
		this.neon = neon(connectionString);
		this.drizzle = this.neon;
		this._isConnected = true;
	}

	async close(): Promise<void> {
		// Neon serverless connections don't need explicit closing
		// but we mark as disconnected
		this._isConnected = false;
	}

	isConnected(): boolean {
		return this._isConnected;
	}
}

/**
 * Neon migration driver implementation
 */
class NeonMigrationDriver implements DrizzleMigrationDriver {
	private readonly connectionString: string;

	constructor(connectionString: string) {
		this.connectionString = connectionString;
	}

	async migrate(_migrations: string[], _direction: "up" | "down"): Promise<void> {
		// Migration implementation would go here
		// For now, this is a placeholder
		console.log("Running migrations with Neon driver...");
	}

	async createMigrationTable(): Promise<void> {
		// Create the __drizzle_migrations table if it doesn't exist
		console.log("Creating migration table with Neon driver...");
	}

	async getPendingMigrations(): Promise<string[]> {
		// Return list of pending migrations
		return [];
	}
}

/**
 * Neon database provider adapter
 * Implements the ProviderAdapter interface for Neon (serverless Postgres)
 */
export class NeonProviderAdapter implements ProviderAdapter {
	readonly type: ProviderType = "neon";
	readonly dialect = "postgres" as const;
	private _connectionString: string | null = null;

	/**
	 * Connect to a Neon database
	 * @param config - The provider configuration
	 * @returns A promise that resolves to a Neon database connection
	 */
	async connect(config: ProviderConfig): Promise<DatabaseConnection> {
		const validatedConfig = parseProviderConfig(config);

		if (validatedConfig.type !== "neon") {
			throw new Error("Invalid configuration: expected Neon provider config");
		}

		const connectionString = validatedConfig.connectionString;

		if (!connectionString) {
			throw new Error("Neon provider requires a connectionString");
		}

		// Store connection string for later use by getMigrationsDriver
		this._connectionString = connectionString;

		return new NeonConnection(connectionString);
	}

	/**
	 * Get the migrations driver for Neon
	 * @returns A Neon migration driver instance
	 */
	getMigrationsDriver(): DrizzleMigrationDriver {
		if (!this._connectionString) {
			throw new Error("Migration driver not initialized. Call connect() first.");
		}
		return new NeonMigrationDriver(this._connectionString);
	}

	/**
	 * Neon supports Row Level Security (RLS)
	 * @returns true as Neon is built on PostgreSQL
	 */
	supportsRLS(): boolean {
		return true;
	}

	/**
	 * Neon supports GraphQL (via PostgreSQL)
	 * @returns true
	 */
	supportsGraphQL(): boolean {
		return true;
	}
}

/**
 * Create a new Neon provider adapter instance
 * @returns A new NeonProviderAdapter instance
 */
export function createNeonProvider(): NeonProviderAdapter {
	return new NeonProviderAdapter();
}

// Export the adapter as default for convenience
export default NeonProviderAdapter;
