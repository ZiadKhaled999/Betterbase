import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { SchemaScanner } from '../src/utils/scanner';

describe('SchemaScanner', () => {
  test('extracts tables, columns, relations, and indexes from drizzle schema', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bb-scanner-'));

    try {
      const schemaPath = path.join(dir, 'schema.ts');
      writeFileSync(
        schemaPath,
        `
          import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

          export const users = sqliteTable('users', {
            id: text('id').primaryKey(),
            email: text('email').notNull().unique(),
            age: integer('age').default(18),
          }, (table) => ({
            usersEmailIdx: index('users_email_idx').on(table.email),
          }));

          export const posts = sqliteTable('posts', {
            id: text('id').primaryKey(),
            userId: text('user_id').notNull().references(() => users.id),
            title: text('title').notNull(),
          });

          export const comments = sqliteTable('comments', {
            id: text('id').primaryKey(),
            postId: text('post_id').notNull().references(() => posts.id),
            body: text('body'),
          });
        `,
      );

      const scanner = new SchemaScanner(schemaPath);
      const tables = scanner.scan();

      expect(Object.keys(tables)).toEqual(['users', 'posts', 'comments']);

      expect(tables.users.name).toBe('users');
      expect(tables.users.columns.id.primaryKey).toBe(true);
      expect(tables.users.columns.id.nullable).toBe(false);
      expect(tables.users.columns.email.unique).toBe(true);
      expect(tables.users.columns.age.defaultValue).toBe('18');
      expect(tables.users.indexes).toContain('usersEmailIdx');

      expect(tables.posts.columns.userId.references).toBe('() => users.id');
      expect(tables.posts.relations).toContain('() => users.id');

      expect(tables.comments.columns.postId.references).toBe('() => posts.id');
      expect(tables.comments.relations).toContain('() => posts.id');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
