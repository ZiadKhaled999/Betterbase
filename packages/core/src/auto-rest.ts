/**
 * Auto-REST: Automatic CRUD route generation from Drizzle schema
 * 
 * This module provides runtime route registration that automatically
 * exposes full CRUD operations for all tables in the Drizzle schema.
 * 
 * SECURITY: When enableRLS is true, all routes require authentication and
 * apply RLS filtering. Unauthenticated access is rejected.
 */

import type { Context } from "hono";
import { Hono } from "hono";
import type { BetterBaseResponse } from "@betterbase/shared";
import { getRLSUserId, isRLSSessionSet } from "./middleware/rls-session";

// Type for Drizzle table
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleTable = any;

// Type for DrizzleDB (generic database client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleDB = any;

/**
 * Options for auto-rest mounting
 */
export interface AutoRestOptions {
	/** Enable/disable auto-rest (default: true) */
	enabled?: boolean;
	/** Tables to exclude from auto-rest */
	excludeTables?: string[];
	/** Base path for API routes (default: /api) */
	basePath?: string;
	/** Enable RLS enforcement (default: true) */
	enableRLS?: boolean;
	/** Columns that are allowed to be modified via API (default: all columns) */
	writableColumns?: string[];
	/** Column to use for RLS user ownership check (e.g., 'userId', 'owner_id') */
	ownerColumn?: string;
}

/**
 * Error response for unauthorized requests
 */
function unauthorizedResponse(c: Context, message = "Unauthorized: authentication required"): Response {
	return c.json({
		data: null,
		error: message,
	} as BetterBaseResponse<null>, 401);
}

/**
 * Error response for forbidden requests
 */
function forbiddenResponse(c: Context, message = "Forbidden: insufficient permissions"): Response {
	return c.json({
		data: null,
		error: message,
	} as BetterBaseResponse<null>, 403);
}

/**
 * Sanitize input body to only include allowed columns
 * @param body - Raw request body
 * @param allowedColumns - Array of allowed column names
 * @returns Sanitized body with only allowed columns
 */
function sanitizeInputBody(body: Record<string, unknown>, allowedColumns: string[]): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};
	const allowedSet = new Set(allowedColumns);
	
	for (const [key, value] of Object.entries(body)) {
		if (allowedSet.has(key)) {
			sanitized[key] = value;
		}
	}
	
	return sanitized;
}

/**
 * Get all column names from a Drizzle table
 * @param table - Drizzle table instance
 * @returns Array of column names
 */
function getTableColumns(table: DrizzleTable): string[] {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	table as any;
	const columns: string[] = [];
	
	// Try to get columns from table metadata
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const tableConfig = (table as any).config;
	if (tableConfig?.columns) {
		for (const col of tableConfig.columns) {
			columns.push(col.name);
		}
	}
	
	return columns;
}

/**
 * Check if RLS is enforced and user is authenticated
 * @param c - Hono context
 * @param enableRLS - Whether RLS is enabled
 * @returns User ID if authenticated and RLS is enforced, null otherwise
 */
function checkRLSAuth(c: Context, enableRLS: boolean): string | null {
	if (!enableRLS) {
		return null; // No RLS required
	}
	
	// Check if RLS session is set (user is authenticated)
	if (!isRLSSessionSet(c)) {
		return null;
	}
	
	const userId = getRLSUserId(c);
	return userId || null;
}

/**
 * Mount auto-generated REST routes for all tables in the schema
 * 
 * @param app - Hono application instance
 * @param db - Drizzle database instance
 * @param schema - Record of table name to Drizzle table
 * @param options - Optional configuration
 * 
 * Routes generated:
 * - GET /api/:table - List all rows (paginated)
 * - GET /api/:table/:id - Get single row by ID
 * - POST /api/:table - Insert new row
 * - PATCH /api/:table/:id - Update existing row
 * - DELETE /api/:table/:id - Delete row
 * 
 * SECURITY: When enableRLS is true, all routes require authentication.
 */
export function mountAutoRest(
	app: Hono,
	db: DrizzleDB,
	schema: Record<string, DrizzleTable>,
	options: AutoRestOptions = {},
): void {
	const {
		enabled = true,
		excludeTables = [],
		basePath = "/api",
		enableRLS = true,
		writableColumns,
		ownerColumn,
	} = options;

	if (!enabled) {
		console.log("[Auto-REST] Disabled - skipping route registration");
		return;
	}

	// Security check: if enableRLS is true, we should have a warning
	if (enableRLS) {
		console.log("[Auto-REST] RLS enforcement enabled - all routes require authentication");
	}

	console.log("[Auto-REST] Starting automatic CRUD route generation...");

	// Iterate over all tables in the schema
	for (const [tableName, table] of Object.entries(schema)) {
		// Skip excluded tables
		if (excludeTables.includes(tableName)) {
			console.log(`[Auto-REST] Skipping excluded table: ${tableName}`);
			continue;
		}

		// Get the primary key column name
		const primaryKey = getPrimaryKey(table);
		if (!primaryKey) {
			console.warn(`[Auto-REST] Skipping table ${tableName}: no primary key found`);
			continue;
		}

		// Get table columns for input sanitization
		const tableColumns = getTableColumns(table);
		const allowedWriteColumns = writableColumns || tableColumns;

		// Register routes for this table
		registerTableRoutes(
			app,
			db,
			tableName,
			table,
			primaryKey,
			basePath,
			enableRLS,
			allowedWriteColumns,
			ownerColumn,
		);
	}

	console.log("[Auto-REST] Automatic CRUD route generation complete");
}

/**
 * Get the primary key column name from a Drizzle table
 */
function getPrimaryKey(table: DrizzleTable): string | null {
	// Try to get primary key from table metadata
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const tableMeta = table as any;
	if (tableMeta?.primaryKey?.columns?.length > 0) {
		return tableMeta.primaryKey.columns[0].name;
	}
	
	// Fallback: look for common primary key names
	const commonPKs = ["id", "uuid", "pk"];
	for (const pk of commonPKs) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((table as any)[pk]) {
			return pk;
		}
	}

	return null;
}

/**
 * Register CRUD routes for a single table
 * 
 * SECURITY: When enableRLS is true, all routes require authentication and apply:
 * - Per-row filtering using ownerColumn (if specified)
 * - Column whitelisting for insert/update operations
 */
function registerTableRoutes(
	app: Hono,
	db: DrizzleDB,
	tableName: string,
	table: DrizzleTable,
	primaryKey: string,
	basePath: string,
	enableRLS: boolean,
	writableColumns: string[],
	ownerColumn?: string,
): void {
	const routePath = `${basePath}/${tableName}`;

	// GET /api/:table - List all rows (paginated)
	app.get(routePath, async (c) => {
		// Security: Check RLS authentication
		const userId = checkRLSAuth(c, enableRLS);
		if (enableRLS && !userId) {
			return unauthorizedResponse(c);
		}

		const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
		const offset = parseInt(c.req.query("offset") || "0", 10);

		try {
			// Build query with RLS filtering if enabled and owner column specified
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let query = db.select().from(table).limit(limit).offset(offset);
			
			if (enableRLS && userId && ownerColumn) {
				// Apply per-row RLS filtering
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				query = query.where((table as any)[ownerColumn].eq(userId));
			}
			
			const rows = await query;
			
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const countResult = await db.select({ count: () => 0 }).from(table).limit(1);
			const total = countResult.length; // This is approximate

			const response: BetterBaseResponse<typeof rows> = {
				data: rows,
				error: null,
				count: rows.length,
				pagination: {
					page: Math.floor(offset / limit) + 1,
					pageSize: limit,
					total: total || rows.length,
				},
			};

			return c.json(response);
		} catch (error) {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			return c.json(response, 500);
		}
	});

	// GET /api/:table/:id - Get single row by ID
	app.get(`${routePath}/:id`, async (c) => {
		const id = c.req.param("id");

		// Security: Check RLS authentication
		const userId = checkRLSAuth(c, enableRLS);
		if (enableRLS && !userId) {
			return unauthorizedResponse(c);
		}

		try {
			// Build query with RLS filtering if enabled
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let query = db.select().from(table).where((table as any)[primaryKey].eq(id)).limit(1);
			
			if (enableRLS && userId && ownerColumn) {
				// Apply per-row RLS filtering
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				query = query.where((table as any)[ownerColumn].eq(userId));
			}
			
			const rows = await query;
			
			if (rows.length === 0) {
				const response: BetterBaseResponse<null> = {
					data: null,
					error: "Not found",
				};
				return c.json(response, 404);
			}

			const response: BetterBaseResponse<typeof rows[0]> = {
				data: rows[0],
				error: null,
			};

			return c.json(response);
		} catch (error) {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			return c.json(response, 500);
		}
	});

	// POST /api/:table - Insert new row
	app.post(routePath, async (c) => {
		// Security: Check RLS authentication
		const userId = checkRLSAuth(c, enableRLS);
		if (enableRLS && !userId) {
			return unauthorizedResponse(c);
		}

		const body = await c.req.json();

		if (!body || typeof body !== "object") {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: "Invalid request body",
			};
			return c.json(response, 400);
		}

		// Security: Sanitize input to only include allowed columns
		const sanitizedBody = sanitizeInputBody(body as Record<string, unknown>, writableColumns);

		// Security: If owner column is specified and we have a user, auto-set it
		if (ownerColumn && userId && !sanitizedBody[ownerColumn]) {
			sanitizedBody[ownerColumn] = userId;
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await db.insert(table).values(sanitizedBody).returning();
			
			const response: BetterBaseResponse<typeof result[0]> = {
				data: result[0] || null,
				error: null,
			};

			return c.json(response, 201);
		} catch (error) {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			return c.json(response, 500);
		}
	});

	// PATCH /api/:table/:id - Update existing row
	app.patch(`${routePath}/:id`, async (c) => {
		const id = c.req.param("id");

		// Security: Check RLS authentication
		const userId = checkRLSAuth(c, enableRLS);
		if (enableRLS && !userId) {
			return unauthorizedResponse(c);
		}

		const body = await c.req.json();

		if (!body || typeof body !== "object") {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: "Invalid request body",
			};
			return c.json(response, 400);
		}

		// Security: Sanitize input to only include allowed columns
		const sanitizedBody = sanitizeInputBody(body as Record<string, unknown>, writableColumns);

		// Security: Never allow updating owner column through API
		if (ownerColumn && sanitizedBody[ownerColumn]) {
			delete sanitizedBody[ownerColumn];
		}

		try {
			// Build update query with RLS filtering if enabled
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let query = db.update(table).set(sanitizedBody).where((table as any)[primaryKey].eq(id)).returning();
			
			if (enableRLS && userId && ownerColumn) {
				// Apply per-row RLS filtering - only update rows owned by user
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				query = db.update(table)
					.set(sanitizedBody)
					.where((table as any)[primaryKey].eq(id).and((table as any)[ownerColumn].eq(userId)))
					.returning();
			}
			
			const result = await query;
			
			if (result.length === 0) {
				const response: BetterBaseResponse<null> = {
					data: null,
					error: "Not found",
				};
				return c.json(response, 404);
			}

			const response: BetterBaseResponse<typeof result[0]> = {
				data: result[0],
				error: null,
			};

			return c.json(response);
		} catch (error) {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			return c.json(response, 500);
		}
	});

	// DELETE /api/:table/:id - Delete row
	app.delete(`${routePath}/:id`, async (c) => {
		const id = c.req.param("id");

		// Security: Check RLS authentication
		const userId = checkRLSAuth(c, enableRLS);
		if (enableRLS && !userId) {
			return unauthorizedResponse(c);
		}

		try {
			// Build delete query with RLS filtering if enabled
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let query = db.delete(table).where((table as any)[primaryKey].eq(id)).returning();
			
			if (enableRLS && userId && ownerColumn) {
				// Apply per-row RLS filtering - only delete rows owned by user
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				query = db.delete(table)
					.where((table as any)[primaryKey].eq(id).and((table as any)[ownerColumn].eq(userId)))
					.returning();
			}
			
			const result = await query;
			
			if (result.length === 0) {
				const response: BetterBaseResponse<null> = {
					data: null,
					error: "Not found",
				};
				return c.json(response, 404);
			}

			const response: BetterBaseResponse<typeof result[0]> = {
				data: result[0],
				error: null,
			};

			return c.json(response);
		} catch (error) {
			const response: BetterBaseResponse<null> = {
				data: null,
				error: error instanceof Error ? error.message : "Unknown error",
			};
			return c.json(response, 500);
		}
	});

	console.log(`[Auto-REST] Registered CRUD routes for table: ${tableName}`);
}
