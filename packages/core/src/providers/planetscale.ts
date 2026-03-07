import type { ProviderType, DBEvent } from "@betterbase/shared";
import { connect } from "@planetscale/database";
import type {
	DatabaseConnection,
	DrizzleMigrationDriver,
	PlanetScaleDatabaseConnection,
	ProviderAdapter,
	ProviderConfig,
} from "./types";
import { parseProviderConfig } from "./types";

// Type for the PlanetScale connection
type PlanetScaleClient = ReturnType<typeof connect>;

/**
 * PlanetScale-specific database connection implementation
 * Note: PlanetScale (MySQL) does not have native CDC support
 */
class PlanetScaleConnectionImpl implements PlanetScaleDatabaseConnection {
	readonly provider = "planetscale" as const;
	readonly planetscale: PlanetScaleClient;
	// Store the drizzle-compatible client for use with drizzle-orm
	readonly drizzle: PlanetScaleClient;
	private _isConnected = false;
	private _changeCallbacks: ((event: DBEvent) => void)[] = [];

	constructor(connectionString: string) {
		this.planetscale = connect({
			url: connectionString,
		});
		this.drizzle = this.planetscale;
		this._isConnected = true;
	}

	async close(): Promise<void> {
		// PlanetScale connections are HTTP-based and don't need explicit closing
		this._isConnected = false;
		this._changeCallbacks = [];
	}

	isConnected(): boolean {
		return this._isConnected;
	}

	/**
	 * Register a callback for database change events (CDC)
	 * Note: PlanetScale does not support CDC natively - this is a no-op placeholder
	 */
	onchange(callback: (event: DBEvent) => void): void {
		this._changeCallbacks.push(callback);
		console.warn("[CDC] PlanetScale does not support native CDC. Events will not be emitted.");
	}
}

/**
 * PlanetScale migration driver implementation
 */
class PlanetScaleMigrationDriver implements DrizzleMigrationDriver {
	private readonly connectionString: string;

	constructor(connectionString: string) {
		this.connectionString = connectionString;
	}

	async migrate(_migrations: string[], _direction: "up" | "down"): Promise<void> {
		// Migration implementation would go here
		// For now, this is a placeholder
		console.log("Running migrations with PlanetScale driver...");
	}

	async createMigrationTable(): Promise<void> {
		// Create the __drizzle_migrations table if it doesn't exist
		console.log("Creating migration table with PlanetScale driver...");
	}

	async getPendingMigrations(): Promise<string[]> {
		// Return list of pending migrations
		return [];
	}
}

/**
 * PlanetScale database provider adapter
 * Implements the ProviderAdapter interface for PlanetScale (MySQL-compatible)
 */
export class PlanetScaleProviderAdapter implements ProviderAdapter {
	readonly type: ProviderType = "planetscale";
	readonly dialect = "mysql" as const;
	private _connectionString: string | null = null;

	/**
	 * Connect to a PlanetScale database
	 * @param config - The provider configuration
	 * @returns A promise that resolves to a PlanetScale database connection
	 */
	async connect(config: ProviderConfig): Promise<DatabaseConnection> {
		const validatedConfig = parseProviderConfig(config);

		if (validatedConfig.type !== "planetscale") {
			throw new Error("Invalid configuration: expected PlanetScale provider config");
		}

		const connectionString = validatedConfig.connectionString;

		if (!connectionString) {
			throw new Error("PlanetScale provider requires a connectionString");
		}

		// Store connection string for later use by getMigrationsDriver
		this._connectionString = connectionString;

		return new PlanetScaleConnectionImpl(connectionString);
	}

	/**
	 * Get the migrations driver for PlanetScale
	 * @returns A PlanetScale migration driver instance
	 */
	getMigrationsDriver(): DrizzleMigrationDriver {
		if (!this._connectionString) {
			throw new Error("Migration driver not initialized. Call connect() first.");
		}
		return new PlanetScaleMigrationDriver(this._connectionString);
	}

	/**
	 * PlanetScale does not support Row Level Security (RLS)
	 * @returns false as PlanetScale is MySQL-compatible and doesn't have RLS
	 */
	supportsRLS(): boolean {
		return false;
	}

	/**
	 * PlanetScale has limited GraphQL support (via MySQL)
	 * @returns false as native GraphQL requires PostgreSQL
	 */
	supportsGraphQL(): boolean {
		return false;
	}
}

/**
 * Create a new PlanetScale provider adapter instance
 * @returns A new PlanetScaleProviderAdapter instance
 */
export function createPlanetScaleProvider(): PlanetScaleProviderAdapter {
	return new PlanetScaleProviderAdapter();
}

// Export the adapter as default for convenience
export default PlanetScaleProviderAdapter;
