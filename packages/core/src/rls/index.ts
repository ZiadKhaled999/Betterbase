/**
 * RLS (Row Level Security) Module
 *
 * This module provides utilities for defining, generating, scanning,
 * and applying Row Level Security policies to PostgreSQL databases.
 *
 * @example
 * ```typescript
 * import { definePolicy, policyToSQL, scanPolicies } from '@betterbase/core/rls'
 *
 * // Define a policy
 * const policy = definePolicy('users', {
 *   select: "auth.uid() = id",
 *   update: "auth.uid() = id",
 *   delete: "auth.uid() = id"
 * })
 *
 * // Generate SQL
 * const sql = policyToSQL(policy)
 *
 * // Scan project for policies
 * const { policies, errors } = await scanPolicies('/path/to/project')
 * ```
 */

// Types
export type {
	PolicyDefinition,
	PolicyConfig,
} from "./types";

export {
	definePolicy,
	isPolicyDefinition,
	mergePolicies,
} from "./types";

// Generator
export type { PolicyOperation } from "./generator";

export {
	policyToSQL,
	dropPolicySQL,
	dropPolicyByName,
	disableRLS,
	hasPolicyConditions,
	policiesToSQL,
	dropPoliciesSQL,
} from "./generator";

// Scanner
export type {
	ScanResult,
	PolicyFileInfo,
} from "./scanner";

export {
	scanPolicies,
	scanPoliciesStrict,
	listPolicyFiles,
	getPolicyFileInfo,
	PolicyScanError,
} from "./scanner";

// Auth Bridge
export {
	generateAuthFunction,
	generateAuthFunctionWithSetting,
	dropAuthFunction,
	setCurrentUserId,
	clearCurrentUserId,
	generateIsAuthenticatedCheck,
	dropIsAuthenticatedCheck,
	generateAllAuthFunctions,
	dropAllAuthFunctions,
} from "./auth-bridge";

// Evaluator (Application-layer RLS for SQLite)
export {
	evaluatePolicy,
	applyRLSSelect,
	applyRLSInsert,
	applyRLSUpdate,
	applyRLSDelete,
	createRLSMiddleware,
} from "./evaluator";
