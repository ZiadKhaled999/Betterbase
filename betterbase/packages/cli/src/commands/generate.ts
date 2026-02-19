import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SchemaScanner, type TableInfo } from '../utils/schema-scanner';
import * as logger from '../utils/logger';

function toSingular(name: string): string {
  return name.endsWith('s') ? name.slice(0, -1) : `${name}Item`;
}

function schemaTypeToZod(type: string): string {
  if (type === 'integer' || type === 'number') {
    return 'z.coerce.number()';
  }

  if (type === 'boolean') {
    return 'z.coerce.boolean()';
  }

  if (type === 'json') {
    return 'z.unknown()';
  }

  if (type === 'datetime') {
    return 'z.coerce.date()';
  }

  return 'z.string()';
}

function buildSchemaShape(table: TableInfo, mode: 'create' | 'update'): string {
  const entries = Object.entries(table.columns)
    .filter(([columnName, column]) => !(column.primaryKey || columnName === 'id'))
    .map(([columnName, column]) => {
      const base = schemaTypeToZod(column.type);
      const optional = mode === 'update' || column.nullable || Boolean(column.defaultValue);
      return `  ${columnName}: ${optional ? `${base}.optional()` : base}`;
    });

  return entries.join(',\n');
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

  const filters = Object.entries(queryParams).filter(([key, value]) => {
    return key !== 'limit' && key !== 'offset' && key !== 'sort' && value !== undefined;
  });

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
  return c.json({ ${singular}: created[0] }, 201);
});

${tableName}Route.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updated = await db.update(${tableName}).set(body).where(eq(${tableName}.id, id as never)).returning();
  if (updated.length === 0) {
    return c.json({ error: '${tableName} not found' }, 404);
  }

  return c.json({ ${singular}: updated[0] });
});

${tableName}Route.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await db.delete(${tableName}).where(eq(${tableName}.id, id as never)).returning();

  if (deleted.length === 0) {
    return c.json({ error: '${tableName} not found' }, 404);
  }

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
    if (firstRouteImport.test(router)) {
      router = router.replace(firstRouteImport, (m) => `${m}\n${importLine}`);
    } else {
      router = `${importLine}\n${router}`;
    }
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

export async function runGenerateCrudCommand(projectRoot: string, tableName: string): Promise<void> {
  const resolvedRoot = path.resolve(projectRoot);
  const schemaPath = path.join(resolvedRoot, 'src/db/schema.ts');

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  logger.info(`🔨 Generating CRUD for ${tableName}...`);

  const scanner = new SchemaScanner(schemaPath);
  const tables = scanner.scan();

  const table = tables[tableName];
  if (!table) {
    throw new Error(`Table "${tableName}" not found in schema.`);
  }

  logger.info('📦 Installing @hono/zod-validator...');
  execSync('bun add @hono/zod-validator', { cwd: resolvedRoot, stdio: 'inherit' });

  const routesDir = path.join(resolvedRoot, 'src/routes');
  mkdirSync(routesDir, { recursive: true });

  const routePath = path.join(routesDir, `${tableName}.ts`);
  writeFileSync(routePath, generateRouteFile(tableName, table));

  updateMainRouter(resolvedRoot, tableName);

  logger.success(`Generated ${routePath}`);
  console.log('\nEndpoints created:');
  console.log(`  GET    /api/${tableName}`);
  console.log(`  GET    /api/${tableName}/:id`);
  console.log(`  POST   /api/${tableName}`);
  console.log(`  PATCH  /api/${tableName}/:id`);
  console.log(`  DELETE /api/${tableName}/:id`);
}
