import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getClientIp, writeAuditLog } from "../../lib/audit";
import { getPool } from "../../lib/db";

export const roleRoutes = new Hono();

// GET /admin/roles  — list all roles with their permissions
roleRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows: roles } = await pool.query(
		"SELECT id, name, description, is_system, created_at FROM betterbase_meta.roles ORDER BY name",
	);

	const { rows: perms } = await pool.query(`
    SELECT rp.role_id, p.id, p.domain, p.action
    FROM betterbase_meta.role_permissions rp
    JOIN betterbase_meta.permissions p ON p.id = rp.permission_id
  `);

	const permsByRole: Record<string, { id: string; domain: string; action: string }[]> = {};
	for (const p of perms) {
		if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
		permsByRole[p.role_id].push({ id: p.id, domain: p.domain, action: p.action });
	}

	return c.json({
		roles: roles.map((r) => ({ ...r, permissions: permsByRole[r.id] ?? [] })),
	});
});

// GET /admin/roles/permissions  — all available permissions
roleRoutes.get("/permissions", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, domain, action FROM betterbase_meta.permissions ORDER BY domain, action",
	);
	return c.json({ permissions: rows });
});

// GET /admin/roles/assignments  — all admin role assignments
roleRoutes.get("/assignments", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(`
    SELECT ar.id, ar.admin_user_id, au.email AS admin_email,
           ar.role_id, r.name AS role_name,
           ar.project_id, p.name AS project_name,
           ar.created_at
    FROM betterbase_meta.admin_roles ar
    JOIN betterbase_meta.admin_users au ON au.id = ar.admin_user_id
    JOIN betterbase_meta.roles r ON r.id = ar.role_id
    LEFT JOIN betterbase_meta.projects p ON p.id = ar.project_id
    ORDER BY ar.created_at DESC
  `);
	return c.json({ assignments: rows });
});

// POST /admin/roles/assignments  — assign role to admin
roleRoutes.post(
	"/assignments",
	zValidator(
		"json",
		z.object({
			admin_user_id: z.string().min(1),
			role_id: z.string().min(1),
			project_id: z.string().optional(),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const admin = c.get("adminUser") as { id: string; email: string };

		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.admin_roles (admin_user_id, role_id, project_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (admin_user_id, role_id, project_id) DO NOTHING
       RETURNING id`,
			[data.admin_user_id, data.role_id, data.project_id ?? null],
		);

		await writeAuditLog({
			actorId: admin.id,
			actorEmail: admin.email,
			action: "role.assign",
			resourceType: "admin_user",
			resourceId: data.admin_user_id,
			afterData: data,
			ipAddress: getClientIp(c.req.raw.headers),
		});

		return c.json({ assignment: rows[0] }, 201);
	},
);

// DELETE /admin/roles/assignments/:id
roleRoutes.delete("/assignments/:id", async (c) => {
	const pool = getPool();
	const admin = c.get("adminUser") as { id: string; email: string };

	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.admin_roles WHERE id = $1 RETURNING id, admin_user_id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);

	await writeAuditLog({
		actorId: admin.id,
		actorEmail: admin.email,
		action: "role.revoke",
		resourceType: "admin_role",
		resourceId: c.req.param("id"),
		ipAddress: getClientIp(c.req.raw.headers),
	});

	return c.json({ success: true });
});
