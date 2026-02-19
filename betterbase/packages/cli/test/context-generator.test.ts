import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { ContextGenerator } from '../src/utils/context-generator';

describe('ContextGenerator', () => {
  test('creates .betterbase-context.json from schema and routes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bb-context-'));

    try {
      mkdirSync(path.join(root, 'src/db'), { recursive: true });
      mkdirSync(path.join(root, 'src/routes'), { recursive: true });

      writeFileSync(
        path.join(root, 'src/db/schema.ts'),
        `
          import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
          export const users = sqliteTable('users', {
            id: text('id').primaryKey(),
            email: text('email').notNull(),
          });
        `,
      );

      writeFileSync(
        path.join(root, 'src/routes/index.ts'),
        `
          import { Hono } from 'hono';
          const app = new Hono();
          app.get('/health', (c) => c.json({ ok: true }));
          export default app;
        `,
      );

      const generator = new ContextGenerator();
      const context = await generator.generate(root);

      expect(context.tables.users).toBeDefined();
      expect(context.tables.users.columns.id).toBeDefined();
      expect(context.tables.users.columns.email).toBeDefined();
      expect(context.routes['/health']).toBeDefined();

      const file = JSON.parse(readFileSync(path.join(root, '.betterbase-context.json'), 'utf-8'));
      expect(file.tables.users.name).toBe('users');
      expect(file.tables.users.columns.id.type).toBe('text');
      expect(file.tables.users.columns.email.type).toBe('text');
      expect(Array.isArray(file.routes['/health'])).toBe(true);
      expect(file.routes['/health'].length).toBeGreaterThan(0);
      expect(file.routes['/health'][0].method).toBe('GET');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('handles missing routes directory with empty routes', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bb-context-no-routes-'));

    try {
      mkdirSync(path.join(root, 'src/db'), { recursive: true });
      writeFileSync(
        path.join(root, 'src/db/schema.ts'),
        `
          import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
          export const users = sqliteTable('users', { id: text('id').primaryKey() });
        `,
      );

      const context = await new ContextGenerator().generate(root);
      expect(context.routes).toEqual({});

      const file = JSON.parse(readFileSync(path.join(root, '.betterbase-context.json'), 'utf-8'));
      expect(file.routes).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('handles empty schema file with empty tables', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bb-context-empty-schema-'));

    try {
      mkdirSync(path.join(root, 'src/db'), { recursive: true });
      mkdirSync(path.join(root, 'src/routes'), { recursive: true });
      writeFileSync(path.join(root, 'src/db/schema.ts'), 'export {};\n');

      const context = await new ContextGenerator().generate(root);
      expect(context.tables).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('handles missing schema file with empty tables', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bb-context-no-schema-'));

    try {
      mkdirSync(path.join(root, 'src/routes'), { recursive: true });
      writeFileSync(path.join(root, 'src/routes/index.ts'), 'export {};\n');

      const context = await new ContextGenerator().generate(root);
      expect(context.tables).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
