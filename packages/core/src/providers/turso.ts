import type { ProviderType, DBEvent, DBEventType } from "@betterbase/shared";
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

// SQL operation types for CDC detection
type SqlOperation = "insert" | "update" | "delete" | "select";

/**
 * Parse SQL statement to determine operation type
 * This is a simple heuristic-based parser for CDC detection
 */
function detectOperation(sql: string): SqlOperation {
	const normalizedSql = sql.trim().toLowerCase();
	
	if (normalizedSql.startsWith("insert")) return "insert";
	if (normalizedSql.startsWith("update")) return "update";
	if (normalizedSql.startsWith("delete")) return "delete";
	if (normalizedSql.startsWith("select")) return "select";
	
	return "select"; // default to select for safety
}

/**
 * Extract table name from SQL statement
 */
function extractTableName(sql: string): string | null {
	const normalizedSql = sql.trim().toLowerCase();
	
	// Match INSERT INTO table_name
	const insertMatch = normalizedSql.match(/^insert\s+into\s+(\w+)/);
	if (insertMatch) return insertMatch[1];
	
	// Match UPDATE table_name
	const updateMatch = normalizedSql.match(/^update\s+(\w+)/);
	if (updateMatch) return updateMatch[1];
	
	// Match DELETE FROM table_name
	const deleteMatch = normalizedSql.match(/^delete\s+from\s+(\w+)/);
	if (deleteMatch) return deleteMatch[1];
	
	return null;
}

/**
 * Turso-specific database connection implementation
 * Includes CDC (Change Data Capture) for automatic event emission
 */
class TursoConnection implements TursoDatabaseConnection {
	readonly provider = "turso" as const;
	readonly libsql: TursoClient;
	// Store the drizzle-compatible client for use with drizzle-orm
	readonly drizzle: TursoClient;
	private _isConnected = false;
	private _changeCallbacks: ((event: DBEvent) => void)[] = [];
	private _originalExecute: TursoClient["execute"];

	constructor(url: string, authToken: string) {
		this.libsql = createClient({
			url,
			authToken,
		});
		this.drizzle = this.libsql;
		this._isConnected = true;
		
		// Store original execute method
		this._originalExecute = this.libsql.execute.bind(this.libsql);
		
		// Wrap execute to emit CDC events
		this.libsql.execute = this._wrapExecute(this._originalExecute);
	}

	/**
	 * Wrap the execute method to emit CDC events
	 */
	private _wrapExecute(
		originalExecute: TursoClient["execute"],
	): TursoClient["execute"] {
		const self = this;
		
		return async (
			query: Parameters<TursoClient["execute"]>[0],
		): ReturnType<TursoClient["execute"]> => {
			const sql = typeof query === "string" ? query : (query as { sql: string }).sql;
			const operation = detectOperation(sql);
			const tableName = extractTableName(sql);
			
			// Execute the query
			const result = await originalExecute(query);
			
			// Emit CDC event for write operations
			if (tableName && operation !== "select" && self._changeCallbacks.length > 0) {
				const eventType: DBEventType = 
					operation === "insert" ? "INSERT" :
					operation === "update" ? "UPDATE" : "DELETE";
				
				// Get the affected rows
				const records = result.rows || [];
				
				for (const record of records) {
					const event: DBEvent = {
						table: tableName,
						type: eventType,
						record: record as Record<string, unknown>,
						old_record: undefined,
						timestamp: new Date().toISOString(),
					};
					
					// Notify all registered callbacks
					for (const callback of self._changeCallbacks) {
						callback(event);
					}
				}
			}
			
			return result;
		};
	}

	async close(): Promise<void> {
		await this.libsql.close();
		this._isConnected = false;
		this._changeCallbacks = [];
	}

	isConnected(): boolean {
		return this._isConnected;
	}

	/**
	 * Register a callback for database change events (CDC)
	 * This enables automatic event emission for INSERT, UPDATE, DELETE operations
	 */
	onchange(callback: (event: DBEvent) => void): void {
		this._changeCallbacks.push(callback);
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
