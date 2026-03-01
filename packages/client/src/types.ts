import type { BetterBaseResponse as SharedBetterBaseResponse } from "@betterbase/shared";
import type { BetterBaseError } from "./errors";

// Re-export BetterBaseResponse from @betterbase/shared for external use
export type BetterBaseResponse<T> = SharedBetterBaseResponse<T>;

export interface BetterBaseConfig {
	url: string;
	key?: string;
	schema?: string;
	fetch?: typeof fetch;
	storage?: {
		getItem(key: string): string | null;
		setItem(key: string, value: string): void;
		removeItem(key: string): void;
	};
}

export interface QueryOptions {
	limit?: number;
	offset?: number;
	orderBy?: { column: string; direction: "asc" | "desc" };
}

export interface RealtimeSubscription {
	unsubscribe: () => void;
}

export type RealtimeCallback<T = unknown> = (payload: {
	event: "INSERT" | "UPDATE" | "DELETE";
	data: T;
	timestamp: string;
}) => void;
