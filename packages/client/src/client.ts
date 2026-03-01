import { z } from "zod";
import { AuthClient } from "./auth";
import { QueryBuilder, type QueryBuilderOptions } from "./query-builder";
import { RealtimeClient } from "./realtime";
import { Storage } from "./storage";
import type { BetterBaseConfig } from "./types";

const BetterBaseConfigSchema = z.object({
	url: z.string().url(),
	key: z.string().min(1).optional(),
	schema: z.string().optional(),
	fetch: z.function().optional(),
	storage: z
		.object({
			getItem: z.function().args(z.string()).returns(z.string().nullable()),
			setItem: z.function().args(z.string(), z.string()),
			removeItem: z.function().args(z.string()),
		})
		.optional(),
});

export class BetterBaseClient {
	private headers: Record<string, string>;
	private fetchImpl: typeof fetch;
	private _url: string;
	public auth: AuthClient;
	public realtime: RealtimeClient;
	public storage: Storage;

	constructor(config: BetterBaseConfig) {
		const parsed = BetterBaseConfigSchema.parse(config);
		this._url = parsed.url.replace(/\/$/, "");
		this.headers = {
			"Content-Type": "application/json",
			...(parsed.key ? { "X-BetterBase-Key": parsed.key } : {}),
		};
		this.fetchImpl = (parsed.fetch ?? fetch) as typeof fetch;

		this.auth = new AuthClient(
			this._url,
			this.headers,
			(token) => {
				if (token) {
					this.headers.Authorization = `Bearer ${token}`;
				} else {
					delete this.headers.Authorization;
				}
				this.realtime.setToken(token);
			},
			this.fetchImpl,
			parsed.storage ?? undefined,
		);

		this.realtime = new RealtimeClient(this._url, this.auth.getToken());
		this.storage = new Storage(this);

		const token = this.auth.getToken();
		if (token) {
			this.headers.Authorization = `Bearer ${token}`;
		}
	}

	/**
	 * Get the base URL for API requests.
	 */
	getUrl(): string {
		return this._url;
	}

	/**
	 * Get the fetch implementation used by the client.
	 */
	getFetch(): typeof fetch {
		return this.fetchImpl;
	}

	/**
	 * Internal fetch method for making authenticated API requests.
	 */
	async fetch(url: string, options: RequestInit = {}): Promise<Response> {
		const response = await this.fetchImpl(url, {
			...options,
			headers: {
				...this.headers,
				...options.headers,
			},
		});
		return response;
	}

	from<T = unknown>(table: string, options?: QueryBuilderOptions): QueryBuilder<T> {
		return new QueryBuilder<T>(this._url, table, this.headers, this.fetchImpl, options);
	}
}

export function createClient(config: BetterBaseConfig): BetterBaseClient {
	return new BetterBaseClient(config);
}
