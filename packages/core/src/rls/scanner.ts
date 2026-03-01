/**
 * RLS Policy Scanner
 *
 * Scans a project for policy definition files and loads them.
 * Policy files should be named {tableName}.policy.ts and export
 * a default PolicyDefinition.
 */

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { PolicyDefinition } from "./types";
import { isPolicyDefinition } from "./types";

const POLICY_FILE_PATTERN = /\.policy\.ts$/;

/**
 * Error thrown when scanning or loading policies fails
 */
export class PolicyScanError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "PolicyScanError";
	}
}

/**
 * Result of scanning for policies
 */
export interface ScanResult {
	policies: PolicyDefinition[];
	errors: PolicyScanError[];
}

/**
 * Check if a file is a policy file based on naming convention
 * @param filename - The filename to check
 * @returns true if the file matches the policy pattern
 */
function isPolicyFile(filename: string): boolean {
	return POLICY_FILE_PATTERN.test(filename);
}

/**
 * Extract table name from policy filename
 * @param filename - The policy filename (e.g., "users.policy.ts")
 * @returns The table name (e.g., "users")
 */
function extractTableName(filename: string): string {
	return filename.replace(POLICY_FILE_PATTERN, "");
}

/**
 * Recursively walk a directory and find all policy files
 * @param dir - The directory to walk
 * @returns Array of policy file paths
 */
async function findPolicyFiles(dir: string): Promise<string[]> {
	const policyFiles: string[] = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				// Recursively search subdirectories
				const subFiles = await findPolicyFiles(fullPath);
				policyFiles.push(...subFiles);
			} else if (entry.isFile() && isPolicyFile(entry.name)) {
				policyFiles.push(fullPath);
			}
		}
	} catch (error) {
		// Directory doesn't exist or is not accessible
		// Return empty array in this case
		console.warn(`Could not read directory: ${dir}`, error);
	}

	return policyFiles;
}

/**
 * Load a policy from a file
 * @param filePath - Path to the policy file
 * @returns The loaded PolicyDefinition
 */
async function loadPolicyFromFile(filePath: string): Promise<PolicyDefinition> {
	try {
		const content = await readFile(filePath, "utf-8");

		// Check if file exports a default policy
		const hasDefaultExport =
			/export\s+default\s+/.test(content) ||
			/export\s+\{\s*default\s*\}/.test(content) ||
			/export\s+default\s+definePolicy/.test(content);

		if (!hasDefaultExport) {
			throw new PolicyScanError(`Policy file ${filePath} does not export a default policy`);
		}

		// Try dynamic import first (works in Bun or with compiled .js files)
		// Fall back to regex parsing for .ts files in Node.js without transpilation
		let policy: PolicyDefinition | undefined;
		try {
			const module = await import(filePath);
			if (module.default) {
				policy = module.default as PolicyDefinition;
			}
		} catch {
			// Dynamic import failed - try regex-based fallback parsing
			console.warn(`Dynamic import failed for ${filePath}, using regex fallback`);
			policy = parsePolicyFromContent(content, filePath);
		}

		if (!policy) {
			throw new PolicyScanError(`Policy file ${filePath} does not have a default export`);
		}

		if (!isPolicyDefinition(policy)) {
			throw new PolicyScanError(`Policy file ${filePath} does not export a valid PolicyDefinition`);
		}

		return policy;
	} catch (error) {
		if (error instanceof PolicyScanError) {
			throw error;
		}
		throw new PolicyScanError(`Failed to load policy from ${filePath}`, error);
	}
}

/**
 * Parse policy from file content using regex (fallback for environments
 * that don't support dynamic TypeScript imports)
 * @param content - File content
 * @param filePath - File path (for error messages)
 * @returns Parsed PolicyDefinition or undefined
 */
function parsePolicyFromContent(content: string, filePath: string): PolicyDefinition | undefined {
	// Extract table name from definePolicy call
	const tableMatch = content.match(/definePolicy\s*\(\s*['"]([^'"]+)['"]/);
	if (!tableMatch) {
		return undefined;
	}
	const table = tableMatch[1];

	// Extract policy conditions using regex
	const policy: PolicyDefinition = { table };

	// Match select condition
	const selectMatch = content.match(/select:\s*["']([^"']+)["']/);
	if (selectMatch) policy.select = selectMatch[1];

	// Match insert condition
	const insertMatch = content.match(/insert:\s*["']([^"']+)["']/);
	if (insertMatch) policy.insert = insertMatch[1];

	// Match update condition
	const updateMatch = content.match(/update:\s*["']([^"']+)["']/);
	if (updateMatch) policy.update = updateMatch[1];

	// Match delete condition
	const deleteMatch = content.match(/delete:\s*["']([^"']+)["']/);
	if (deleteMatch) policy.delete = deleteMatch[1];

	// Match using clause
	const usingMatch = content.match(/using:\s*["']([^"']+)["']/);
	if (usingMatch) policy.using = usingMatch[1];

	// Match withCheck clause
	const withCheckMatch = content.match(/withCheck:\s*["']([^"']+)["']/);
	if (withCheckMatch) policy.withCheck = withCheckMatch[1];

	return policy;
}

/**
 * Scan a project directory for RLS policy files
 *
 * Looks for files matching *.policy.ts in src/db/policies/ directory
 *
 * @param projectRoot - The root directory of the project
 * @returns Promise<ScanResult> - Contains loaded policies and any errors
 *
 * @example
 * ```typescript
 * const { policies, errors } = await scanPolicies('/path/to/project');
 *
 * if (errors.length > 0) {
 *   console.error('Failed to load some policies:', errors);
 * }
 *
 * // Use policies for SQL generation
 * for (const policy of policies) {
 *   const sql = policyToSQL(policy);
 *   console.log(sql);
 * }
 * ```
 */
export async function scanPolicies(projectRoot: string): Promise<ScanResult> {
	const policies: PolicyDefinition[] = [];
	const errors: PolicyScanError[] = [];

	// Check for common policy directory locations
	const possiblePaths = [
		path.join(projectRoot, "src/db/policies"),
		path.join(projectRoot, "db/policies"),
		path.join(projectRoot, "policies"),
	];

	for (const policiesPath of possiblePaths) {
		try {
			await access(policiesPath);
		} catch {
			// Directory doesn't exist, try next path
			continue;
		}

		const policyFiles = await findPolicyFiles(policiesPath);

		for (const filePath of policyFiles) {
			try {
				const policy = await loadPolicyFromFile(filePath);
				policies.push(policy);
			} catch (error) {
				if (error instanceof PolicyScanError) {
					errors.push(error);
				} else {
					errors.push(new PolicyScanError(`Unexpected error loading ${filePath}`, error));
				}
			}
		}

		// If we found policies in one location, don't check others
		if (policies.length > 0 || errors.length > 0) {
			break;
		}
	}

	return { policies, errors };
}

/**
 * Scan for policies and throw if there are any errors
 * @param projectRoot - The root directory of the project
 * @returns Array of PolicyDefinition
 * @throws PolicyScanError if any policies fail to load
 */
export async function scanPoliciesStrict(projectRoot: string): Promise<PolicyDefinition[]> {
	const result = await scanPolicies(projectRoot);

	if (result.errors.length > 0) {
		const errorMessages = result.errors.map((e) => e.message).join("\n");
		throw new PolicyScanError(
			`Failed to load ${result.errors.length} policy(s):\n${errorMessages}`,
		);
	}

	return result.policies;
}

/**
 * Get a list of policy file paths without loading them
 * @param projectRoot - The root directory of the project
 * @returns Array of policy file paths
 */
export async function listPolicyFiles(projectRoot: string): Promise<string[]> {
	const possiblePaths = [
		path.join(projectRoot, "src/db/policies"),
		path.join(projectRoot, "db/policies"),
		path.join(projectRoot, "policies"),
	];

	for (const policiesPath of possiblePaths) {
		try {
			await access(policiesPath);
		} catch {
			continue;
		}

		return await findPolicyFiles(policiesPath);
	}

	return [];
}

/**
 * Get metadata about policy files without loading them
 * @param projectRoot - The root directory of the project
 * @returns Array of policy file info
 */
export interface PolicyFileInfo {
	path: string;
	filename: string;
	table: string;
}

/**
 * Get list of policy files with metadata
 * @param projectRoot - The root directory of the project
 * @returns Array of PolicyFileInfo
 */
export async function getPolicyFileInfo(projectRoot: string): Promise<PolicyFileInfo[]> {
	const files = await listPolicyFiles(projectRoot);

	return files.map((filePath) => {
		const filename = path.basename(filePath);
		const table = extractTableName(filename);

		return {
			path: filePath,
			filename,
			table,
		};
	});
}
