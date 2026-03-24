import { loadCredentials } from "./credentials";
import { error } from "./logger";

export function requireAuth(): { token: string; serverUrl: string } {
	const creds = loadCredentials();
	if (!creds?.token) {
		error("Not logged in. Run `bb login` first.");
		process.exit(1);
	}
	return { token: creds.token, serverUrl: creds.server_url };
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
	const { token, serverUrl } = requireAuth();

	const url = `${serverUrl}${path}`;
	const res = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			...(options.headers ?? {}),
		},
	});

	if (!res.ok) {
		const body = (await res.json().catch(() => ({ error: "Request failed" }))) as {
			error?: string;
		};
		throw new Error(body.error ?? `HTTP ${res.status}`);
	}

	return res.json() as Promise<T>;
}
