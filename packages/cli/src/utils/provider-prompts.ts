import type { ProviderType } from "@betterbase/shared";
import inquirer from "inquirer";
import { z } from "zod";

/**
 * Schema for validating provider type selection
 */
const providerSelectSchema = z.object({
	value: z.string().min(1),
	label: z.string().min(1),
});

/**
 * Schema for provider selection prompt options
 */
const providerOptionsSchema = z.object({
	message: z.string().min(1),
	options: z.array(providerSelectSchema).min(1),
	default: z.string().optional(),
});

/**
 * Interface for provider prompt result
 */
export interface ProviderPromptResult {
	/** The selected provider type */
	providerType: ProviderType;
	/** Map of environment variable names to their values */
	envVars: Record<string, string>;
}

/**
 * Interface for database credentials
 */
interface DatabaseCredentials {
	DATABASE_URL?: string;
	TURSO_URL?: string;
	TURSO_AUTH_TOKEN?: string;
}

/**
 * Gets the environment variable names required for a given provider type
 * @param providerType - The database provider type
 * @returns Array of required environment variable names
 */
function getRequiredEnvVars(providerType: ProviderType): string[] {
	switch (providerType) {
		case "neon":
		case "planetscale":
		case "supabase":
		case "postgres":
			return ["DATABASE_URL"];
		case "turso":
			return ["TURSO_URL", "TURSO_AUTH_TOKEN"];
		case "managed":
			return ["DATABASE_URL"];
		default:
			return [];
	}
}

/**
 * Gets the prompt message for the database URL based on provider type
 * @param providerType - The database provider type
 * @returns The prompt message string
 */
function getDbUrlPromptMessage(providerType: ProviderType): string {
	switch (providerType) {
		case "supabase":
			return "DATABASE_URL (direct connection string from Supabase project settings)";
		case "neon":
			return "DATABASE_URL (get from https://console.neon.tech)";
		case "planetscale":
			return "DATABASE_URL (get from https://planetscale.com)";
		case "postgres":
			return "DATABASE_URL (PostgreSQL connection string)";
		default:
			return "DATABASE_URL";
	}
}

/**
 * Prompts the user to select a database provider and collect credentials
 * @returns Promise resolving to the provider type and environment variables
 *
 * @example
 * const result = await promptForProvider();
 * // result: { providerType: 'neon', envVars: { DATABASE_URL: '...' } }
 */
export async function promptForProvider(): Promise<ProviderPromptResult> {
	// Define available provider options
	const providerOptions = [
		{ value: "neon", label: "Neon (serverless Postgres)" },
		{ value: "turso", label: "Turso (edge SQLite)" },
		{ value: "planetscale", label: "PlanetScale (MySQL-compatible)" },
		{ value: "supabase", label: "Supabase (Postgres DB only)" },
		{ value: "postgres", label: "Raw Postgres" },
		{ value: "managed", label: "Managed by BetterBase (coming soon)" },
	];

	// Prompt for provider selection with re-prompt loop for "managed" option
	let selectedProvider = "";

	while (!selectedProvider) {
		const parsed = providerOptionsSchema.parse({
			message: "Which database provider would you like to use?",
			options: providerOptions,
			default: "neon",
		});

		const response = await inquirer.prompt<{ value: string }>([
			{
				type: "list",
				name: "value",
				message: parsed.message,
				choices: parsed.options.map((opt) => ({
					name: opt.label,
					value: opt.value,
				})),
				default: parsed.default,
			},
		]);

		if (response.value === "managed") {
			// Show "coming soon" message and re-prompt
			console.log("");
			console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			console.log("Coming soon — managed database launching in a future release.");
			console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			console.log("");
			// Loop continues to re-prompt
		} else {
			selectedProvider = response.value;
		}
	}

	const providerType = selectedProvider as ProviderType;
	const envVars: Record<string, string> = {};

	// Collect environment variables based on provider
	const requiredVars = getRequiredEnvVars(providerType);

	if (requiredVars.includes("DATABASE_URL") || requiredVars.includes("TURSO_URL")) {
		if (providerType === "turso") {
			// Turso requires two env vars
			const tursoUrlResponse = await inquirer.prompt<{ value: string }>([
				{
					type: "input",
					name: "value",
					message: "TURSO_URL (libsql connection string)",
					default: "libsql://your-database.turso.io",
				},
			]);
			envVars.TURSO_URL = tursoUrlResponse.value;

			const tursoTokenResponse = await inquirer.prompt<{ value: string }>([
				{
					type: "input",
					name: "value",
					message: "TURSO_AUTH_TOKEN",
					default: "",
				},
			]);
			envVars.TURSO_AUTH_TOKEN = tursoTokenResponse.value;
		} else {
			// Other providers use DATABASE_URL
			const dbUrlResponse = await inquirer.prompt<{ value: string }>([
				{
					type: "input",
					name: "value",
					message: getDbUrlPromptMessage(providerType),
					default: "",
				},
			]);
			envVars.DATABASE_URL = dbUrlResponse.value;
		}
	}

	return {
		providerType,
		envVars,
	};
}

/**
 * Prompts for S3-compatible storage setup
 * @returns Promise resolving to true if storage should be configured, false to skip
 */
export async function promptForStorage(): Promise<boolean> {
	const response = await inquirer.prompt<{ value: boolean }>([
		{
			type: "confirm",
			name: "value",
			message: "Set up S3-compatible storage now?",
			default: false,
		},
	]);

	if (response.value) {
		console.log("Storage setup coming in Phase 14");
	}

	return response.value;
}

/**
 * Generates the .env file content with provider-specific environment variables
 * @param providerType - The selected database provider type
 * @param envVars - Map of environment variable names to their values
 * @returns The formatted .env file content
 */
export function generateEnvContent(
	providerType: ProviderType,
	envVars: Record<string, string>,
): string {
	let content = `NODE_ENV=development
PORT=3000
`;

	// Add provider-specific env vars with comments
	switch (providerType) {
		case "neon":
			content += `
# Database Provider: Neon
# Get your connection string from https://console.neon.tech
DATABASE_URL=${envVars.DATABASE_URL || ""}
`;
			break;
		case "turso":
			content += `
# Database Provider: Turso
# Get your database URL from https://turso.tech
TURSO_URL=${envVars.TURSO_URL || ""}
TURSO_AUTH_TOKEN=${envVars.TURSO_AUTH_TOKEN || ""}
`;
			break;
		case "planetscale":
			content += `
# Database Provider: PlanetScale
# Get your connection string from https://planetscale.com
DATABASE_URL=${envVars.DATABASE_URL || ""}
`;
			break;
		case "supabase":
			content += `
# Database Provider: Supabase
# Get your direct connection string from Supabase project settings
DATABASE_URL=${envVars.DATABASE_URL || ""}
`;
			break;
		case "postgres":
			content += `
# Database Provider: PostgreSQL
# Enter your PostgreSQL connection string
DATABASE_URL=${envVars.DATABASE_URL || ""}
`;
			break;
		case "managed":
			content += `
# Database Provider: Managed by BetterBase
# Managed database launching in a future release
DATABASE_URL=${envVars.DATABASE_URL || ""}
`;
			break;
	}

	return content;
}

/**
 * Generates the .env.example file content (without values)
 * @param providerType - The selected database provider type
 * @returns The formatted .env.example file content
 */
export function generateEnvExampleContent(providerType: ProviderType): string {
	let content = `NODE_ENV=development
PORT=3000
`;

	switch (providerType) {
		case "neon":
		case "planetscale":
		case "supabase":
		case "postgres":
		case "managed":
			content += `
# Database Provider: ${providerType}
DATABASE_URL=
`;
			break;
		case "turso":
			content += `
# Database Provider: Turso
TURSO_URL=
TURSO_AUTH_TOKEN=
`;
			break;
	}

	return content;
}
