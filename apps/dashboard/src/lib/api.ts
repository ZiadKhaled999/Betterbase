const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function getToken(): string | null {
	return localStorage.getItem("bb_token");
}

export function setToken(token: string): void {
	localStorage.setItem("bb_token", token);
}

export function clearToken(): void {
	localStorage.removeItem("bb_token");
	localStorage.removeItem("bb_admin");
}

export function getStoredAdmin(): { id: string; email: string } | null {
	const raw = localStorage.getItem("bb_admin");
	return raw ? JSON.parse(raw) : null;
}

export function setStoredAdmin(admin: { id: string; email: string }): void {
	localStorage.setItem("bb_admin", JSON.stringify(admin));
}

async function request<T>(path: string, options: RequestInit = {}, skipAuth = false): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...((options.headers as Record<string, string>) ?? {}),
	};
	if (token && !skipAuth) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

	if (res.status === 401) {
		clearToken();
		window.location.href = "/login";
		throw new ApiError(401, "Unauthorized");
	}

	if (!res.ok) {
		const body = (await res.json().catch(() => ({ error: "Request failed" }))) as {
			error?: string;
		};
		throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
	}

	if (res.status === 204) return undefined as T;
	return res.json();
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "POST",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		}),
	put: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
	patch: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

	// Public (no auth header)
	postPublic: <T>(path: string, body?: unknown) =>
		request<T>(
			path,
			{ method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined },
			true,
		),

	// File download (returns blob)
	download: async (path: string): Promise<Blob> => {
		const token = getToken();
		const res = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		});
		if (!res.ok) throw new ApiError(res.status, "Download failed");
		return res.blob();
	},
};
