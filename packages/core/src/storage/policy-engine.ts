/**
 * Storage Policy Engine
 *
 * Evaluates storage policies for bucket operations.
 * Supports expressions like:
 * - 'true' - allow all (public access)
 * - 'auth.uid() = path.split("/")[1]' - owner-only access based on path
 * - 'path.startsWith("public/")' - folder-scoped access
 */

import type { StoragePolicy } from "./types";

/**
 * Extract filename from a path
 * @param path - The file path
 * @returns The filename (last segment of path)
 */
function getFilename(path: string): string {
	const segments = path.split("/");
	return segments[segments.length - 1] || "";
}

/**
 * Evaluate a storage policy expression
 *
 * @param policy - The storage policy to evaluate
 * @param userId - The current user's ID (null for anonymous)
 * @param path - The file path being accessed
 * @returns true if policy allows the operation, false otherwise
 */
export function evaluateStoragePolicy(
	policy: StoragePolicy,
	userId: string | null,
	path: string,
): boolean {
	// If policy is for a different operation, skip it
	// Note: This should be filtered before calling this function

	const expression = policy.expression;

	// Handle simple boolean expressions
	if (expression === "true") {
		return true; // Public access
	}

	if (expression === "false") {
		return false; // Deny all
	}

	// Handle auth.uid() = path.split("/")[1]
	// Example: auth.uid() = path.split("/")[1]
	const uidPathMatch = expression.match(/auth\.uid\(\)\s*=\s*path\.split\(["'](.+)["']\)\[(\d+)\]/);
	if (uidPathMatch) {
		const delimiter = uidPathMatch[1];
		const index = parseInt(uidPathMatch[2], 10);
		
		if (userId === null) {
			return false; // Deny anonymous users
		}

		const pathSegment = path.split(delimiter)[index];
		return userId === pathSegment;
	}

	// Handle path.startsWith("prefix")
	const pathStartsWithMatch = expression.match(/path\.startsWith\(["'](.+)["']\)/);
	if (pathStartsWithMatch) {
		const prefix = pathStartsWithMatch[1];
		return path.startsWith(prefix);
	}

	// Handle auth.uid() = path segment directly
	const uidDirectMatch = expression.match(/auth\.uid\(\)\s*=\s*path\.split\(["'\/]+["']\)\[(\d+)\]/);
	if (uidDirectMatch) {
		const index = parseInt(uidDirectMatch[1], 10);
		
		if (userId === null) {
			return false;
		}

		const pathSegment = path.split("/")[index];
		return userId === pathSegment;
	}

	// Unknown expression - deny by default (fail-closed)
	console.warn(`[Storage Policy] Unknown expression: ${expression}`);
	return false;
}

/**
 * Check if a storage operation is allowed by policies
 *
 * @param policies - Array of storage policies
 * @param userId - The current user's ID (null for anonymous)
 * @param bucket - The bucket being accessed
 * @param operation - The operation type
 * @param path - The file path being accessed
 * @returns true if allowed, false if denied
 */
export function checkStorageAccess(
	policies: StoragePolicy[],
	userId: string | null,
	bucket: string,
	operation: "upload" | "download" | "list" | "delete",
	path: string,
): boolean {
	// Find applicable policies for this bucket and operation
	const applicablePolicies = policies.filter(
		(p) => p.bucket === bucket && (p.operation === "*" || p.operation === operation),
	);

	// Fail-closed: if no policies match, deny access
	if (applicablePolicies.length === 0) {
		console.log(`[Storage Policy] No policy found for ${bucket}/${operation}, denying by default`);
		return false;
	}

	// Check each policy - if any allows, grant access
	for (const policy of applicablePolicies) {
		if (evaluateStoragePolicy(policy, userId, path)) {
			return true;
		}
	}

	// All policies denied
	return false;
}

/**
 * Get the appropriate error message for policy denial
 */
export function getPolicyDenialMessage(
	operation: "upload" | "download" | "list" | "delete",
	path: string,
): string {
	return `Access denied: ${operation} operation on "${path}" is not permitted by any storage policy`;
}
