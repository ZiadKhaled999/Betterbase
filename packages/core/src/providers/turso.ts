import type { ProviderType } from "@betterbase/shared";
import { createClient } from "@libsql/client";
import type {
	DatabaseConnection,
	DrizzleMigrationDriver,
	ProviderAdapter,
	ProviderConfig,
	TursoDatabaseConnection,
} from "./types";
import { parseProviderConfig } from "./types";

// Type for the Turso client
type TursoClient = ReturnType<typeof createClient>;

/**
 * Turso-specific database connection implementation
 */
class TursoConnection implements TursoDatabaseConnection {
	readonly provider = "turso" as const;
	readonly libsql: TursoClient;
	// Store the drizzle-compatible client for use with drizzle-orm
	readonly drizzle: TursoClient;
	private _isConnected = false;

	constructor(url: string, authToken: string) {
		this.libsql = createClient({
			url,
			authToken,
		});
		this.drizzle = this.libsql;
		this._isConnected = true;
	}

	async close(): Promise<void> {
		await this.libsql.close();
		this._isConnected = false;
	}

	isConnected(): boolean {
		return this._isConnected;
	}
}

/**
 * Turso migration driver implementation
 */
class TursoMigrationDriver implements DrizzleMigrationDriver {
	private readonly url: string;
	private readonly authToken: string;

	constructor(url: string, authToken: string) {
		this.url = url;
		this.authToken = authToken;
	}

	async migrate(_migrations: string[], _direction: "up" | "down"): Promise<void> {
		// Migration implementation would go here
		// For now, this is a placeholder
		console.log("Running migrations with Turso driver...");
	}

	async createMigrationTable(): Promise<void> {
		// Create the __drizzle_migrations table if it doesn't exist
		console.log("Creating migration table with Turso driver...");
	}

	async getPendingMigrations(): Promise<string[]> {
		// Return list of pending migrations
		return [];
	}
}

/**
 * Turso database provider adapter
 * Implements the ProviderAdapter interface for Turso (libSQL/SQLite)
 */
export class TursoProviderAdapter implements ProviderAdapter {
	readonly type: ProviderType = "turso";
	readonly dialect = "sqlite" as const;
	private _connectionConfig: { url: string; authToken: string } | null = null;

	/**
	 * Connect to a Turso database
	 * @param config - The provider configuration
	 * @returns A promise that resolves to a Turso database connection
	 */
	async connect(config: ProviderConfig): Promise<DatabaseConnection> {
		const validatedConfig = parseProviderConfig(config);

		if (validatedConfig.type !== "turso") {
			throw new Error("Invalid configuration: expected Turso provider config");
		}

		const { url, authToken } = validatedConfig;

		if (!url) {
			throw new Error("Turso provider requires a url");
		}

		if (!authToken) {
			throw new Error("Turso provider requires an authToken");
		}

		// Store config for later use by getMigrationsDriver
		this._connectionConfig = { url, authToken };

		return new TursoConnection(url, authToken);
	}

	/**
	 * Get the migrations driver for Turso
	 * @returns A Turso migration driver instance
	 */
	getMigrationsDriver(): DrizzleMigrationDriver {
		if (!this._connectionConfig) {
			throw new Error("Migration driver not initialized. Call connect() first.");
		}
		return new TursoMigrationDriver(this._connectionConfig.url, this._connectionConfig.authToken);
	}

	/**
	 * Turso (libSQL) does not support Row Level Security (RLS)
	 * @returns false as Turso uses SQLite which doesn't have RLS
	 */
	supportsRLS(): boolean {
		return false;
	}

	/**
	 * Turso has limited GraphQL support (via SQLite)
	 * @returns false as native GraphQL requires PostgreSQL
	 */
	supportsGraphQL(): boolean {
		return false;
	}
}

/**
 * Create a new Turso provider adapter instance
 * @returns A new TursoProviderAdapter instance
 */
export function createTursoProvider(): TursoProviderAdapter {
	return new TursoProviderAdapter();
}

// Export the adapter as default for convenience
export default TursoProviderAdapter;
