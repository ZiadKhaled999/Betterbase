import { createAuthClient } from "better-auth/client";
import { AuthError, NetworkError } from "./errors";
import type { BetterBaseConfig, BetterBaseResponse } from "./types";

// Infer the auth client type from createAuthClient return type
type BetterAuthClient = ReturnType<typeof createAuthClient>;

export interface BetterBaseClientConfig extends BetterBaseConfig {}

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	id: string;
	expiresAt: Date;
	token: string;
	createdAt: Date;
	updatedAt: Date;
	ipAddress: string | null;
	userAgent: string | null;
	userId: string;
	requiresMFA?: boolean;
}

interface StorageAdapter {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

function getStorage(): Storage | null {
	try {
		if (typeof globalThis === "undefined") {
			return null;
		}
		const storage = globalThis.localStorage;
		return storage ?? null;
	} catch {
		return null;
	}
}

export class AuthClient {
	private authClient: BetterAuthClient;
	private storage: StorageAdapter | null;
	private onAuthStateChange?: (token: string | null) => void;
	private fetchImpl: typeof fetch;
	private _headers: Record<string, string>;

	constructor(
		private url: string,
		headers: Record<string, string>,
		onAuthStateChange?: (token: string | null) => void,
		fetchImpl: typeof fetch = fetch,
		storage?: StorageAdapter | null,
	) {
		this.fetchImpl = fetchImpl;
		this.storage = storage ?? getStorage();
		this._headers = { ...headers };

		// Store wrapped callback that updates headers when auth state changes
		this.onAuthStateChange = (token) => {
			if (token) {
				this._headers.Authorization = `Bearer ${token}`;
			} else {
				delete this._headers.Authorization;
			}
			onAuthStateChange?.(token);
		};

		this.authClient = createAuthClient({
			baseURL: this.url,
			fetch: fetchImpl,
		});
	}

	async signUp(
		email: string,
		password: string,
		name: string,
	): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			const result = await this.authClient.signUp.email({
				email,
				password,
				name,
			});

			if (result.error) {
				return {
					data: null,
					error: new AuthError(result.error.message ?? "Sign up failed", result.error),
				};
			}

			if (result.data) {
				// better-auth returns token directly on the data object
				const sessionToken = result.data.token;
				if (sessionToken) {
					this.storage?.setItem("betterbase_session", sessionToken);
					this.onAuthStateChange?.(sessionToken);
				}
			}

			// Map better-auth response to our expected format
			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: result.data?.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: result.data?.user?.id ?? "",
			};
			const user: User = {
				id: result.data?.user?.id ?? "",
				name: result.data?.user?.name ?? "",
				email: result.data?.user?.email ?? "",
				emailVerified: result.data?.user?.emailVerified ?? false,
				image: result.data?.user?.image ?? null,
				createdAt: result.data?.user?.createdAt ?? new Date(),
				updatedAt: result.data?.user?.updatedAt ?? new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async signIn(
		email: string,
		password: string,
	): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			const result = await this.authClient.signIn.email({
				email,
				password,
			});

			if (result.error) {
				return {
					data: null,
					error: new AuthError(result.error.message ?? "Sign in failed", result.error),
				};
			}

			if (result.data) {
				// better-auth returns token directly on the data object
				const sessionToken = result.data.token;
				if (sessionToken) {
					this.storage?.setItem("betterbase_session", sessionToken);
					this.onAuthStateChange?.(sessionToken);
				}
			}

			// Map better-auth response to our expected format
			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: result.data?.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: result.data?.user?.id ?? "",
			};
			const user: User = {
				id: result.data?.user?.id ?? "",
				name: result.data?.user?.name ?? "",
				email: result.data?.user?.email ?? "",
				emailVerified: result.data?.user?.emailVerified ?? false,
				image: result.data?.user?.image ?? null,
				createdAt: result.data?.user?.createdAt ?? new Date(),
				updatedAt: result.data?.user?.updatedAt ?? new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async signOut(): Promise<BetterBaseResponse<null>> {
		try {
			const result = await this.authClient.signOut();

			this.storage?.removeItem("betterbase_session");
			this.onAuthStateChange?.(null);

			if (result.error) {
				return {
					data: null,
					error: new AuthError(result.error.message ?? "Sign out failed", result.error),
				};
			}

			return { data: null, error: null };
		} catch (error) {
			this.storage?.removeItem("betterbase_session");
			this.onAuthStateChange?.(null);
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async getSession(): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			const result = await this.authClient.getSession();

			if (result.error) {
				return {
					data: null,
					error: new AuthError(result.error.message ?? "Failed to get session", result.error),
				};
			}

			if (!result.data) {
				return { data: null, error: null };
			}

			// Map better-auth response to our expected format
			const session: Session = {
				id: result.data.session?.id ?? "",
				expiresAt: result.data.session?.expiresAt ?? new Date(),
				token: result.data.session?.token ?? "",
				createdAt: result.data.session?.createdAt ?? new Date(),
				updatedAt: result.data.session?.updatedAt ?? new Date(),
				ipAddress: result.data.session?.ipAddress ?? null,
				userAgent: result.data.session?.userAgent ?? null,
				userId: result.data.session?.userId ?? "",
			};
			const user: User = {
				id: result.data.user?.id ?? "",
				name: result.data.user?.name ?? "",
				email: result.data.user?.email ?? "",
				emailVerified: result.data.user?.emailVerified ?? false,
				image: result.data.user?.image ?? null,
				createdAt: result.data.user?.createdAt ?? new Date(),
				updatedAt: result.data.user?.updatedAt ?? new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	getToken(): string | null {
		return this.storage?.getItem("betterbase_session") ?? null;
	}

	setToken(token: string | null): void {
		if (token) {
			this.storage?.setItem("betterbase_session", token);
		} else {
			this.storage?.removeItem("betterbase_session");
		}
		this.onAuthStateChange?.(token);
	}

	async sendMagicLink(email: string): Promise<BetterBaseResponse<{ message: string }>> {
		try {
			// Make direct API call since better-auth client may not have the plugin typed
			const response = await this.fetchImpl(`${this.url}/api/auth/magic-link/send`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Failed to send magic link", data),
				};
			}

			return {
				data: { message: "Magic link sent successfully" },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async verifyMagicLink(token: string): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			// Make direct API call to verify magic link
			const response = await this.fetchImpl(`${this.url}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, {
				method: "GET",
				headers: this._headers,
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Invalid or expired token", data),
				};
			}

			if (data.token) {
				this.storage?.setItem("betterbase_session", data.token);
				this.onAuthStateChange?.(data.token);
			}

			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: data.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: data.user?.id ?? "",
			};
			const user: User = {
				id: data.user?.id ?? "",
				name: data.user?.name ?? "",
				email: data.user?.email ?? "",
				emailVerified: data.user?.emailVerified ?? false,
				image: data.user?.image ?? null,
				createdAt: data.user?.createdAt ? new Date(data.user.createdAt) : new Date(),
				updatedAt: data.user?.updatedAt ? new Date(data.user.updatedAt) : new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async sendOtp(email: string): Promise<BetterBaseResponse<{ message: string }>> {
		try {
			// Make direct API call
			const response = await this.fetchImpl(`${this.url}/api/auth/otp/send`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Failed to send OTP", data),
				};
			}

			return {
				data: { message: "OTP sent successfully" },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async verifyOtp(email: string, code: string): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			// Make direct API call to verify OTP
			const response = await this.fetchImpl(`${this.url}/api/auth/otp/verify`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ email, code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Invalid or expired OTP", data),
				};
			}

			if (data.token) {
				this.storage?.setItem("betterbase_session", data.token);
				this.onAuthStateChange?.(data.token);
			}

			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: data.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: data.user?.id ?? "",
			};
			const user: User = {
				id: data.user?.id ?? "",
				name: data.user?.name ?? "",
				email: data.user?.email ?? "",
				emailVerified: data.user?.emailVerified ?? false,
				image: data.user?.image ?? null,
				createdAt: data.user?.createdAt ? new Date(data.user.createdAt) : new Date(),
				updatedAt: data.user?.updatedAt ? new Date(data.user.updatedAt) : new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	// Two-Factor Authentication methods
	async mfaEnable(code: string): Promise<BetterBaseResponse<{ qrUri: string; backupCodes: string[] }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/mfa/enable`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Failed to enable MFA", data),
				};
			}

			return {
				data: { qrUri: data.qrUri, backupCodes: data.backupCodes },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async mfaVerify(code: string): Promise<BetterBaseResponse<{ message: string }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/mfa/verify`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Invalid TOTP code", data),
				};
			}

			return {
				data: { message: data.message },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async mfaDisable(code: string): Promise<BetterBaseResponse<{ message: string }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/mfa/disable`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Failed to disable MFA", data),
				};
			}

			return {
				data: { message: data.message },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async mfaChallenge(code: string): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/mfa/challenge`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Invalid TOTP code", data),
				};
			}

			if (data.token) {
				this.storage?.setItem("betterbase_session", data.token);
				this.onAuthStateChange?.(data.token);
			}

			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: data.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: data.user?.id ?? "",
			};
			const user: User = {
				id: data.user?.id ?? "",
				name: data.user?.name ?? "",
				email: data.user?.email ?? "",
				emailVerified: data.user?.emailVerified ?? false,
				image: data.user?.image ?? null,
				createdAt: data.user?.createdAt ? new Date(data.user.createdAt) : new Date(),
				updatedAt: data.user?.updatedAt ? new Date(data.user.updatedAt) : new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	// Phone / SMS Authentication methods
	async sendPhoneOtp(phone: string): Promise<BetterBaseResponse<{ message: string }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/phone/send`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ phone }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Failed to send SMS", data),
				};
			}

			return {
				data: { message: "SMS code sent successfully" },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}

	async verifyPhoneOtp(phone: string, code: string): Promise<BetterBaseResponse<{ user: User; session: Session }>> {
		try {
			const response = await this.fetchImpl(`${this.url}/api/auth/phone/verify`, {
				method: "POST",
				headers: this._headers,
				body: JSON.stringify({ phone, code }),
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				return {
					data: null,
					error: new AuthError(data.error?.message ?? "Invalid or expired code", data),
				};
			}

			if (data.token) {
				this.storage?.setItem("betterbase_session", data.token);
				this.onAuthStateChange?.(data.token);
			}

			const session: Session = {
				id: "",
				expiresAt: new Date(),
				token: data.token ?? "",
				createdAt: new Date(),
				updatedAt: new Date(),
				ipAddress: null,
				userAgent: null,
				userId: data.user?.id ?? "",
			};
			const user: User = {
				id: data.user?.id ?? "",
				name: data.user?.name ?? "",
				email: data.user?.email ?? "",
				emailVerified: data.user?.emailVerified ?? false,
				image: data.user?.image ?? null,
				createdAt: data.user?.createdAt ? new Date(data.user.createdAt) : new Date(),
				updatedAt: data.user?.updatedAt ? new Date(data.user.updatedAt) : new Date(),
			};

			return {
				data: { user, session },
				error: null,
			};
		} catch (error) {
			return {
				data: null,
				error: new NetworkError(
					error instanceof Error ? error.message : "Network request failed",
					error,
				),
			};
		}
	}
}

export function createAuthClientInstance(config: BetterBaseClientConfig): BetterAuthClient {
	return createAuthClient({
		baseURL: config.url,
		fetch: config.fetch,
	});
}

export const authClient = {
	signUp: async (
		url: string,
		email: string,
		password: string,
		name: string,
	): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
		const client = createAuthClient({ baseURL: url });
		const result = await client.signUp.email({ email, password, name });

		if (result.error) {
			return {
				data: null,
				error: new AuthError(result.error.message ?? "Sign up failed", result.error),
			};
		}

		const session: Session = {
			id: "",
			expiresAt: new Date(),
			token: result.data?.token ?? "",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: null,
			userAgent: null,
			userId: result.data?.user?.id ?? "",
		};
		const user: User = {
			id: result.data?.user?.id ?? "",
			name: result.data?.user?.name ?? "",
			email: result.data?.user?.email ?? "",
			emailVerified: result.data?.user?.emailVerified ?? false,
			image: result.data?.user?.image ?? null,
			createdAt: result.data?.user?.createdAt ?? new Date(),
			updatedAt: result.data?.user?.updatedAt ?? new Date(),
		};

		return { data: { user, session }, error: null };
	},

	signIn: async (
		url: string,
		email: string,
		password: string,
	): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
		const client = createAuthClient({ baseURL: url });
		const result = await client.signIn.email({ email, password });

		if (result.error) {
			return {
				data: null,
				error: new AuthError(result.error.message ?? "Sign in failed", result.error),
			};
		}

		const session: Session = {
			id: "",
			expiresAt: new Date(),
			token: result.data?.token ?? "",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: null,
			userAgent: null,
			userId: result.data?.user?.id ?? "",
		};
		const user: User = {
			id: result.data?.user?.id ?? "",
			name: result.data?.user?.name ?? "",
			email: result.data?.user?.email ?? "",
			emailVerified: result.data?.user?.emailVerified ?? false,
			image: result.data?.user?.image ?? null,
			createdAt: result.data?.user?.createdAt ?? new Date(),
			updatedAt: result.data?.user?.updatedAt ?? new Date(),
		};

		return { data: { user, session }, error: null };
	},

	signOut: async (url: string): Promise<BetterBaseResponse<null>> => {
		const client = createAuthClient({ baseURL: url });
		const result = await client.signOut();

		if (result.error) {
			return {
				data: null,
				error: new AuthError(result.error.message ?? "Sign out failed", result.error),
			};
		}

		return { data: null, error: null };
	},

	getSession: async (
		url: string,
	): Promise<BetterBaseResponse<{ user: User; session: Session }>> => {
		const client = createAuthClient({ baseURL: url });
		const result = await client.getSession();

		if (result.error) {
			return {
				data: null,
				error: new AuthError(result.error.message ?? "Failed to get session", result.error),
			};
		}

		if (!result.data) {
			return { data: null, error: null };
		}

		const session: Session = {
			id: result.data.session?.id ?? "",
			expiresAt: result.data.session?.expiresAt ?? new Date(),
			token: result.data.session?.token ?? "",
			createdAt: result.data.session?.createdAt ?? new Date(),
			updatedAt: result.data.session?.updatedAt ?? new Date(),
			ipAddress: result.data.session?.ipAddress ?? null,
			userAgent: result.data.session?.userAgent ?? null,
			userId: result.data.session?.userId ?? "",
		};
		const user: User = {
			id: result.data.user?.id ?? "",
			name: result.data.user?.name ?? "",
			email: result.data.user?.email ?? "",
			emailVerified: result.data.user?.emailVerified ?? false,
			image: result.data.user?.image ?? null,
			createdAt: result.data.user?.createdAt ?? new Date(),
			updatedAt: result.data.user?.updatedAt ?? new Date(),
		};

		return { data: { user, session }, error: null };
	},
};
