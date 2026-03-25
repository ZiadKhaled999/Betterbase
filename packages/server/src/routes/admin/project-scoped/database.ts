import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectDatabaseRoutes = new Hono();

function schemaName(project: { slug: string }) {
	return `project_${project.slug}`;
}

// GET /admin/projects/:id/database/tables
projectDatabaseRoutes.get("/tables", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const { rows } = await pool.query(
		`SELECT
       t.table_name,
       pg_class.reltuples::bigint AS estimated_row_count,
       pg_size_pretty(pg_total_relation_size(quote_ident($1) || '.' || quote_ident(t.table_name))) AS total_size
     FROM information_schema.tables t
     JOIN pg_class ON pg_class.relname = t.table_name
     WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
     ORDER BY t.table_name`,
		[s],
	);

	return c.json({ tables: rows });
});

// GET /admin/projects/:id/database/tables/:tableName/columns
projectDatabaseRoutes.get("/tables/:tableName/columns", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);
	const tableName = c.req.param("tableName");

	const { rows } = await pool.query(
		`SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
		[s, tableName],
	);

	return c.json({ columns: rows });
});

// GET /admin/projects/:id/database/status
projectDatabaseRoutes.get("/status", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const [schemaSize, connInfo] = await Promise.all([
		pool.query(
			`SELECT pg_size_pretty(sum(pg_total_relation_size(quote_ident($1) || '.' || quote_ident(table_name)))::bigint) AS total_size
       FROM information_schema.tables WHERE table_schema = $1`,
			[s],
		),
		pool.query(`SELECT count FROM pg_stat_activity WHERE state = 'active'`),
	]);

	return c.json({
		schema_size: schemaSize.rows[0]?.total_size ?? "0 bytes",
		active_connections: connInfo.rows.length,
	});
});

// GET /admin/projects/:id/database/migrations
projectDatabaseRoutes.get("/migrations", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, filename, applied_at FROM betterbase_meta.migrations ORDER BY applied_at DESC",
	);
	return c.json({ migrations: rows });
});
