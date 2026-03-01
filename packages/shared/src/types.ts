// JSON-serializable error representation
export interface SerializedError {
	message: string;
	name?: string;
	stack?: string;
}

// Generic API response wrapper — used by both client and server
export interface BetterBaseResponse<T> {
	data: T | null;
	error: string | SerializedError | null;
	count?: number;
	pagination?: {
		page: number;
		pageSize: number;
		total: number;
	};
}

// Database event type — used by realtime and webhooks
export type DBEventType = "INSERT" | "UPDATE" | "DELETE";

export interface DBEvent {
	table: string;
	type: DBEventType;
	record: Record<string, unknown>;
	old_record?: Record<string, unknown>;
	timestamp: string;
}

// Provider types — used by core and cli
export type ProviderType = "neon" | "turso" | "planetscale" | "supabase" | "postgres" | "managed";

// Generic pagination params
export interface PaginationParams {
	limit?: number;
	offset?: number;
}
