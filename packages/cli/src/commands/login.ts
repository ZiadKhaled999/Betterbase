import chalk from "chalk";
import type { Command } from "commander";
import { clearCredentials, loadCredentials, saveCredentials } from "../utils/credentials";
import { error, info, success } from "../utils/logger";

const DEFAULT_SERVER_URL = "https://api.betterbase.io";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function registerLoginCommand(program: Command) {
	program
		.command("login")
		.description("Authenticate with a Betterbase instance")
		.option("--url <url>", "Self-hosted Betterbase server URL", DEFAULT_SERVER_URL)
		.action(async (opts) => {
			await runLoginCommand({ serverUrl: opts.url });
		});

	program
		.command("logout")
		.description("Clear stored credentials")
		.action(() => {
			clearCredentials();
			success("Logged out.");
		});
}

export async function runLoginCommand(opts: { serverUrl?: string } = {}) {
	const serverUrl = (opts.serverUrl ?? DEFAULT_SERVER_URL).replace(/\/$/, "");

	info(`Logging in to ${chalk.cyan(serverUrl)} ...`);

	// Step 1: Request device code
	let deviceCode: string;
	let userCode: string;
	let verificationUri: string;

	try {
		const res = await fetch(`${serverUrl}/device/code`, { method: "POST" });
		if (!res.ok) throw new Error(`Server returned ${res.status}`);
		const data = (await res.json()) as {
			device_code: string;
			user_code: string;
			verification_uri: string;
		};
		deviceCode = data.device_code;
		userCode = data.user_code;
		verificationUri = data.verification_uri;
	} catch (err: any) {
		error(`Could not reach server: ${err.message}`);
		process.exit(1);
	}

	console.log("");
	console.log(chalk.bold("Open this URL in your browser to authorize:"));
	console.log(chalk.cyan(`${verificationUri}?code=${userCode}`));
	console.log("");
	console.log(`Your code: ${chalk.yellow.bold(userCode)}`);
	console.log("Waiting for authorization...");

	// Step 2: Poll for token
	const deadline = Date.now() + POLL_TIMEOUT_MS;

	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

		const res = await fetch(`${serverUrl}/device/token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ device_code: deviceCode }),
		});

		if (res.status === 202) continue; // authorization_pending

		if (!res.ok) {
			const body = (await res.json()) as { error?: string };
			if (body.error === "authorization_pending") continue;
			error(`Login failed: ${body.error ?? "unknown error"}`);
			process.exit(1);
		}

		const { access_token } = (await res.json()) as { access_token: string };

		// Get admin info
		const meRes = await fetch(`${serverUrl}/admin/auth/me`, {
			headers: { Authorization: `Bearer ${access_token}` },
		});
		const { admin } = (await meRes.json()) as { admin: { email: string } };

		saveCredentials({
			token: access_token,
			admin_email: admin.email,
			server_url: serverUrl,
			created_at: new Date().toISOString(),
		});

		success(`Logged in as ${chalk.cyan(admin.email)}`);
		return;
	}

	error("Login timed out. Please try again.");
	process.exit(1);
}

// Legacy exports for compatibility
export async function runLoginCommandLegacy(): Promise<void> {
	await runLoginCommand({});
}

export async function runLogoutCommand(): Promise<void> {
	clearCredentials();
	success("Logged out.");
}

export async function getCredentials() {
	return loadCredentials();
}

export async function isAuthenticated(): Promise<boolean> {
	const creds = await getCredentials();
	return creds !== null;
}
