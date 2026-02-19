import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SchemaScanner, type TableInfo } from '../utils/schema-scanner';
import * as logger from '../utils/logger';

function toSingular(name: string): string {
  const lower = name.toLowerCase();
  const invariants = new Set(['status', 'news', 'series']);
  if (invariants.has(lower)) {
    return name;
  }

  if (/men$/i.test(name)) {
    return name.replace(/men$/i, 'man');
  }

  if (/ies$/i.test(name)) {
    return name.replace(/ies$/i, 'y');
  }

  if (/(ses|xes|zes|ches|shes)$/i.test(name)) {
    return name.replace(/es$/i, '');
  }

  if (name.endsWith('s') && !name.endsWith('ss')) {
    return name.slice(0, -1);
  }

  return `${name}Item`;
}

function schemaTypeToZod(type: string): string {
  if (type === 'integer' || type === 'number') return 'z.coerce.number()';
  if (type === 'boolean') return 'z.coerce.boolean()';
  if (type === 'json') return 'z.unknown()';
  if (type === 'datetime') return 'z.coerce.date()';
  return 'z.string()';
}

function buildSchemaShape(table: TableInfo, mode: 'create' | 'update'): string {
  return Object.entries(table.columns)
    .filter(([columnName, column]) => !(column.primaryKey || columnName === 'id'))
    .map(([columnName, column]) => {
      const base = schemaTypeToZod(column.type);
      const optional = mode === 'update' || column.nullable || Boolean(column.defaultValue);
      return `  ${columnName}: ${optional ? `${base}.optional()` : base}`;
    })
    .join(',\n');
}

function generateRouteFile(tableName: string, table: TableInfo): string {
  const singular = toSingular(tableName);
  const createShape = buildSchemaShape(table, 'create');
  const updateShape = buildSchemaShape(table, 'update');

  return `import { and, asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { realtime } from '../lib/realtime';
import { ${tableName} } from '../db/schema';

export const ${tableName}Route = new Hono();

const createSchema = z.object({
${createShape}
});

const updateSchema = z.object({
${updateShape}
});

${tableName}Route.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const safeLimit = Number.isFinite(limit) && limit >= 0 ? Math.min(limit, 100) : 50;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const queryParams = c.req.query();
  const sort = queryParams.sort;

  const filters = Object.entries(queryParams).filter(([key, value]) => key !== 'limit' && key !== 'offset' && key !== 'sort' && value !== undefined);

  let query = db.select().from(${tableName}).$dynamic();

  if (filters.length > 0) {
    const conditions = filters
      .filter(([key]) => key in ${tableName})
      .map(([key, value]) => eq(${tableName}[key as keyof typeof ${tableName}] as never, value as never));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
  }

  if (sort) {
    const [field, order] = sort.split(':');
    if (field && field in ${tableName}) {
      const column = ${tableName}[field as keyof typeof ${tableName}] as never;
      query = query.orderBy(order === 'desc' ? desc(column) : asc(column));
    }
  }

  const items = await query.limit(safeLimit).offset(safeOffset);
  return c.json({ ${tableName}: items, count: items.length, pagination: { limit: safeLimit, offset: safeOffset } });
});

${tableName}Route.get('/:id', async (c) => {
  const id = c.req.param('id');
  const item = await db.select().from(${tableName}).where(eq(${tableName}.id, id as never)).limit(1);

  if (item.length === 0) {
    return c.json({ error: '${tableName} not found' }, 404);
  }

  return c.json({ ${singular}: item[0] });
});

${tableName}Route.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const created = await db.insert(${tableName}).values(body).returning();
  realtime.broadcast('${tableName}', 'INSERT', created[0]);
  return c.json({ ${singular}: created[0] }, 201);
});

${tableName}Route.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updated = await db.update(${tableName}).set(body).where(eq(${tableName}.id, id as never)).returning();
  if (updated.length === 0) {
    return c.json({ error: '${tableName} not found' }, 404);
  }

  realtime.broadcast('${tableName}', 'UPDATE', updated[0]);
  return c.json({ ${singular}: updated[0] });
});

${tableName}Route.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await db.delete(${tableName}).where(eq(${tableName}.id, id as never)).returning();

  if (deleted.length === 0) {
    return c.json({ error: '${tableName} not found' }, 404);
  }

  realtime.broadcast('${tableName}', 'DELETE', { id });
  return c.json({ message: '${singular} deleted', ${singular}: deleted[0] });
});
`;
}

function updateMainRouter(projectRoot: string, tableName: string): void {
  const routerPath = path.join(projectRoot, 'src/routes/index.ts');
  if (!existsSync(routerPath)) {
    logger.warn(`Routes index not found at ${routerPath}. Please wire the route manually.`);
    return;
  }

  let router = readFileSync(routerPath, 'utf-8');
  const importLine = `import { ${tableName}Route } from './${tableName}';`;
  const routeLine = `  app.route('/api/${tableName}', ${tableName}Route);`;

  if (!router.includes(importLine)) {
    const firstRouteImport = /import\s+\{\s*healthRoute\s*\}\s+from\s+'\.\/health';/;
    router = firstRouteImport.test(router) ? router.replace(firstRouteImport, (m) => `${m}\n${importLine}`) : `${importLine}\n${router}`;
  }

  if (!router.includes(routeLine)) {
    const routeStatements = [...router.matchAll(/\s*app\.route\([^\n]+\);/g)];
    if (routeStatements.length > 0) {
      const last = routeStatements[routeStatements.length - 1];
      const insertAt = (last.index ?? 0) + last[0].length;
      router = `${router.slice(0, insertAt)}\n${routeLine}${router.slice(insertAt)}`;
    } else {
      router = router.replace(/\n}\s*$/, `\n${routeLine}\n}`);
    }
  }

  writeFileSync(routerPath, router);
}

function ensureRealtimeUtility(projectRoot: string): void {
  const realtimePath = path.join(projectRoot, 'src/lib/realtime.ts');
  if (existsSync(realtimePath)) return;

  const canonicalRealtimePath = path.resolve(import.meta.dir, '../../../templates/base/src/lib/realtime.ts');
  if (!existsSync(canonicalRealtimePath)) {
    throw new Error(`Canonical realtime template not found at ${canonicalRealtimePath}`);
  }

  mkdirSync(path.dirname(realtimePath), { recursive: true });
  writeFileSync(realtimePath, readFileSync(canonicalRealtimePath, 'utf-8'));
}

async function ensureZodValidatorInstalled(projectRoot: string): Promise<void> {
  logger.info('Installing @hono/zod-validator...');
  const process = Bun.spawn(['bun', 'add', '@hono/zod-validator'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) {
    if (stdout.trim()) logger.warn(stdout.trim());
    if (stderr.trim()) logger.error(stderr.trim());
    throw new Error('Failed to install @hono/zod-validator.');
  }
}

export async function runGenerateCrudCommand(projectRoot: string, tableName: string): Promise<void> {
  const resolvedRoot = path.resolve(projectRoot);
  const schemaPath = path.join(resolvedRoot, 'src/db/schema.ts');

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  logger.info(`Generating CRUD for ${tableName}...`);

  const scanner = new SchemaScanner(schemaPath);
  const tables = scanner.scan();
  const table = tables[tableName];
  if (!table) {
    throw new Error(`Table "${tableName}" not found in schema.`);
  }

  await ensureZodValidatorInstalled(resolvedRoot);
  ensureRealtimeUtility(resolvedRoot);

  const routesDir = path.join(resolvedRoot, 'src/routes');
  mkdirSync(routesDir, { recursive: true });

  const routePath = path.join(routesDir, `${tableName}.ts`);
  writeFileSync(routePath, generateRouteFile(tableName, table));

  updateMainRouter(resolvedRoot, tableName);

  logger.success(`Generated ${routePath}`);
  logger.info(`GET    /api/${tableName}`);
  logger.info(`GET    /api/${tableName}/:id`);
  logger.info(`POST   /api/${tableName}`);
  logger.info(`PATCH  /api/${tableName}/:id`);
  logger.info(`DELETE /api/${tableName}/:id`);
}
