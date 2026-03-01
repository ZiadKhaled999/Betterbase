/**
 * RLS Session Middleware
 *
 * This middleware sets up the RLS context for authenticated users.
 * It reads the authenticated user from the BetterAuth session and
 * makes the user ID available for RLS policies.
 *
 * The actual database session variable is set when executing queries.
 */

import type { Context, Next } from "hono";

// Context key for storing the RLS user ID
export const RLS_USER_ID_KEY = "rls_user_id";
export const RLS_SESSION_SET_KEY = "rls_session_set";

/**
 * Extended context type with RLS support
 */
export interface RLSCContext {
	user?: {
		id: string;
		email?: string;
		name?: string;
		image?: string;
	};
	session?: unknown;
	// RLS-specific context
	rlsUserId?: string;
	rlsSessionSet?: boolean;
}

/**
 * Extract user ID from the context (set by auth middleware)
 * Falls back to checking for user.id directly
 */
function getUserIdFromContext(c: Context): string | undefined {
	// First check if auth middleware already set user
	const user = c.get("user") as { id: string } | undefined;

	if (user?.id) {
		return user.id;
	}

	// Check if RLS user ID was already set (idempotent)
	const existingRlsUserId = c.get(RLS_USER_ID_KEY) as string | undefined;
	if (existingRlsUserId) {
		return existingRlsUserId;
	}

	return undefined;
}

/**
 * RLS Session Middleware
 *
 * This middleware should be placed AFTER the auth middleware.
 * It reads the authenticated user and sets up RLS context.
 *
 * The middleware is idempotent - it's safe to call multiple times
 * as it checks if RLS session is already set.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono'
 * import { rlsSession } from '@betterbase/core/middleware'
 * import { requireAuth } from './auth'
 *
 * const app = new Hono()
 *
 * // Apply auth first, then RLS session
 * app.use('/*', requireAuth)
 * app.use('/*', rlsSession())
 *
 * app.get('/protected', (c) => {
 *   // User is authenticated and RLS is set up
 *   return c.json({ success: true })
 * })
 * ```
 */
export function rlsSession() {
	return async (c: Context, next: Next): Promise<void> => {
		// Check if RLS session is already set (idempotent)
		const alreadySet = c.get(RLS_SESSION_SET_KEY) as boolean | undefined;

		if (alreadySet) {
			// RLS already set up for this request, skip
			await next();
			return;
		}

		// Get user ID from context
		const userId = getUserIdFromContext(c);

		if (userId) {
			// Set RLS user ID in context
			c.set(RLS_USER_ID_KEY, userId);
			c.set(RLS_SESSION_SET_KEY, true);

			// Note: The RLS context is available via c.get(RLS_USER_ID_KEY) and c.get(RLS_SESSION_SET_KEY)
			// This approach avoids unsafe type assertions and works with Hono's context system
		}

		await next();
	};
}

/**
 * Get the current RLS user ID from context
 * @param c - Hono context
 * @returns The user ID if set, undefined otherwise
 */
export function getRLSUserId(c: Context): string | undefined {
	return c.get(RLS_USER_ID_KEY) as string | undefined;
}

/**
 * Check if RLS session is set for the current request
 * @param c - Hono context
 * @returns true if RLS session is active
 */
export function isRLSSessionSet(c: Context): boolean {
	return (c.get(RLS_SESSION_SET_KEY) as boolean) ?? false;
}

/**
 * Middleware that requires RLS to be set (fail if not authenticated)
 *
 * Use this for routes that MUST have RLS context.
 *
 * @example
 * ```typescript
 * app.get('/data', requireRLS(), async (c) => {
 *   // This will 401 if no authenticated user
 * })
 * ```
 */
export function requireRLS() {
	return async (c: Context, next: Next): Promise<void> => {
		const userId = getUserIdFromContext(c);

		if (!userId) {
			await c.json({ data: null, error: "RLS requires authentication" }, 401);
			return;
		}

		await next();
	};
}

/**
 * Middleware for clearing RLS context (e.g., on logout)
 *
 * @example
 * ```typescript
 * app.post('/logout', clearRLS(), async (c) => {
 *   // RLS context is cleared
 * })
 * ```
 */
export function clearRLS() {
	return async (c: Context, next: Next): Promise<void> => {
		c.set(RLS_USER_ID_KEY, undefined);
		c.set(RLS_SESSION_SET_KEY, false);

		await next();
	};
}
