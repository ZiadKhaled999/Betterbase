import { exec, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FunctionConfig } from "./bundler";

export interface DeployResult {
	url: string;
	success: boolean;
	logs: string[];
}

/**
 * Check if a CLI tool is installed
 */
function isCliInstalled(cliName: string): boolean {
	try {
		execSync(`which ${cliName}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Install a CLI tool globally using bun
 */
function installCli(cliName: string): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log(`Installing ${cliName}...`);
		const child = exec(`bun add -g ${cliName}`, (error, stdout, stderr) => {
			if (error) {
				console.error(`Failed to install ${cliName}: ${stderr}`);
				reject(error);
				return;
			}
			console.log(`${cliName} installed successfully`);
			resolve();
		});
		child.stdout?.on("data", (data) => console.log(data.toString()));
		child.stderr?.on("data", (data) => console.error(data.toString()));
	});
}

/**
 * Deploy a function to Cloudflare Workers using wrangler
 */
export async function deployToCloudflare(
	name: string,
	bundlePath: string,
	config: FunctionConfig,
	projectRoot: string,
): Promise<DeployResult> {
	const logs: string[] = [];

	// Check if wrangler is installed
	if (!isCliInstalled("wrangler")) {
		console.log("wrangler not found.");
		console.log("Install wrangler: bun add -g wrangler");
		return {
			url: "",
			success: false,
			logs: ["wrangler CLI not installed. Run: bun add -g wrangler"],
		};
	}

	// Generate wrangler.toml
	const wranglerTomlPath = join(projectRoot, ".betterbase", `${name}.wrangler.toml`);
	const wranglerTomlContent = generateWranglerToml(name, bundlePath, config);
	const wranglerDir = join(projectRoot, ".betterbase");

	if (!existsSync(wranglerDir)) {
		mkdirSync(wranglerDir, { recursive: true });
	}

	writeFileSync(wranglerTomlPath, wranglerTomlContent);
	logs.push(`Generated wrangler.toml at ${wranglerTomlPath}`);

	try {
		console.log(`Deploying ${name} to Cloudflare Workers...`);
		const output = execSync(`wrangler deploy --config "${wranglerTomlPath}"`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		logs.push(output);

		// Extract URL from output
		const urlMatch = output.match(/https:\/\/[^\s]+\.workers\.dev/);
		const url = urlMatch ? urlMatch[0] : "";

		return {
			url,
			success: true,
			logs,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logs.push(`Deployment failed: ${message}`);
		return {
			url: "",
			success: false,
			logs,
		};
	}
}

/**
 * Generate wrangler.toml content for a function
 */
function generateWranglerToml(name: string, bundlePath: string, config: FunctionConfig): string {
	const lines = [
		`name = "${name}"`,
		`main = "${bundlePath}"`,
		`compatibility_date = "2024-01-01"`,
		"",
		"[vars]",
	];

	for (const envVar of config.env) {
		lines.push(`${envVar} = ""`);
	}

	return `${lines.join("\n")}\n`;
}

/**
 * Deploy a function to Vercel Edge
 */
export async function deployToVercel(
	name: string,
	bundlePath: string,
	config: FunctionConfig,
	projectRoot: string,
): Promise<DeployResult> {
	const logs: string[] = [];

	// Check if vercel CLI is installed
	if (!isCliInstalled("vercel")) {
		console.log("vercel not found.");
		console.log("Install vercel: bun add -g vercel");
		return {
			url: "",
			success: false,
			logs: ["vercel CLI not installed. Run: bun add -g vercel"],
		};
	}

	try {
		console.log(`Deploying ${name} to Vercel Edge...`);
		const output = execSync(`vercel deploy --yes --name ${name} ${bundlePath}`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		logs.push(output);

		// Extract URL from output
		const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
		const url = urlMatch ? urlMatch[0] : "";

		return {
			url,
			success: true,
			logs,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logs.push(`Deployment failed: ${message}`);
		return {
			url: "",
			success: false,
			logs,
		};
	}
}

/**
 * Sync environment variables to Cloudflare Workers
 */
export async function syncEnvToCloudflare(
	name: string,
	config: FunctionConfig,
	projectRoot: string,
	envValues: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
	if (!isCliInstalled("wrangler")) {
		return {
			success: false,
			message: "wrangler CLI not installed",
		};
	}

	const wranglerTomlPath = join(projectRoot, ".betterbase", `${name}.wrangler.toml`);

	if (!existsSync(wranglerTomlPath)) {
		return {
			success: false,
			message: `wrangler.toml not found for function ${name}`,
		};
	}

	try {
		for (const envVar of config.env) {
			const value = envValues[envVar];
			if (value) {
				console.log(`Setting ${envVar} for ${name}...`);
				execSync(`wrangler secret put ${envVar} --config "${wranglerTomlPath}"`, {
					input: `${value}\n`,
					stdio: "pipe",
				});
			}
		}

		return {
			success: true,
			message: `Synced ${config.env.length} environment variables`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			message: `Failed to sync env vars: ${message}`,
		};
	}
}

/**
 * Sync environment variables to Vercel
 */
export async function syncEnvToVercel(
	name: string,
	config: FunctionConfig,
	envValues: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
	if (!isCliInstalled("vercel")) {
		return {
			success: false,
			message: "vercel CLI not installed",
		};
	}

	try {
		// For Vercel, we use env add command
		for (const envVar of config.env) {
			const value = envValues[envVar];
			if (value) {
				console.log(`Setting ${envVar} for ${name}...`);
				execSync(`vercel env add ${envVar} production`, {
					input: `${value}\n`,
					stdio: "pipe",
				});
			}
		}

		return {
			success: true,
			message: `Synced ${config.env.length} environment variables`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			message: `Failed to sync env vars: ${message}`,
		};
	}
}

/**
 * Get logs from Cloudflare Workers
 */
export async function getCloudflareLogs(
	name: string,
	projectRoot: string,
): Promise<{ success: boolean; logs: string[]; message?: string }> {
	if (!isCliInstalled("wrangler")) {
		return {
			success: false,
			logs: [],
			message: "wrangler not found. Install it: bun add -g wrangler",
		};
	}

	try {
		const output = execSync(`wrangler tail ${name}`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		return {
			success: true,
			logs: output.split("\n"),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			logs: [],
			message: `Failed to get logs: ${message}`,
		};
	}
}

/**
 * Get logs from Vercel
 */
export async function getVercelLogs(
	name: string,
): Promise<{ success: boolean; logs: string[]; message?: string }> {
	if (!isCliInstalled("vercel")) {
		return {
			success: false,
			logs: [],
			message: "vercel not found. Install it: bun add -g vercel",
		};
	}

	try {
		const output = execSync(`vercel logs ${name}`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		return {
			success: true,
			logs: output.split("\n"),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			logs: [],
			message: `Failed to get logs: ${message}`,
		};
	}
}
