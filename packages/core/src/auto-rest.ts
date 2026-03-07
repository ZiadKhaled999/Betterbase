/**
 * Auto-REST: Automatic CRUD route generation from Drizzle schema
 * 
 * This module provides runtime route registration that automatically
 * exposes full CRUD operations for all tables in the Drizzle schema.
 */

import type { Hono } from "hono";
import type { BetterBaseResponse } from "@betterbase/shared";
import { getRLSUserId } from "./middleware/rls-session";

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
	} = options;

	if (!enabled) {
		console.log("[Auto-REST] Disabled - skipping route registration");
		return;
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

		// Register routes for this table
		registerTableRoutes(app, db, tableName, table, primaryKey, basePath, enableRLS);
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
 */
function registerTableRoutes(
	app: Hono,
	db: DrizzleDB,
	tableName: string,
	table: DrizzleTable,
	primaryKey: string,
	basePath: string,
	enableRLS: boolean,
): void {
	const routePath = `${basePath}/${tableName}`;

	// GET /api/:table - List all rows (paginated)
	app.get(routePath, async (c) => {
		// Check RLS if enabled
		if (enableRLS) {
			const userId = getRLSUserId(c);
			// TODO: Apply RLS policies for SELECT
		}

		const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
		const offset = parseInt(c.req.query("offset") || "0", 10);

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rows = await db.select().from(table).limit(limit).offset(offset);
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

		// Check RLS if enabled
		if (enableRLS) {
			const userId = getRLSUserId(c);
			// TODO: Apply RLS policies for SELECT
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rows = await db.select().from(table).where((table as any)[primaryKey].eq(id)).limit(1);
			
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
		const body = await c.req.json();

		// Check RLS if enabled
		if (enableRLS) {
			const userId = getRLSUserId(c);
			// TODO: Apply RLS policies for INSERT
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await db.insert(table).values(body).returning();
			
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
		const body = await c.req.json();

		// Check RLS if enabled
		if (enableRLS) {
			const userId = getRLSUserId(c);
			// TODO: Apply RLS policies for UPDATE
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await db.update(table).set(body).where((table as any)[primaryKey].eq(id)).returning();
			
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

		// Check RLS if enabled
		if (enableRLS) {
			const userId = getRLSUserId(c);
			// TODO: Apply RLS policies for DELETE
		}

		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await db.delete(table).where((table as any)[primaryKey].eq(id)).returning();
			
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
