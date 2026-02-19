import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { RouteScanner } from '../src/utils/route-scanner';

describe('RouteScanner', () => {
  test('extracts hono routes with auth and schemas', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'bb-routes-'));

    try {
      const routesDir = path.join(root, 'src/routes');
      mkdirSync(routesDir, { recursive: true });

      writeFileSync(
        path.join(routesDir, 'users.ts'),
        `
          import { Hono } from 'hono';
          import { z } from 'zod';
          import { authMiddleware } from '../middleware/auth';

          const createUserSchema = z.object({ email: z.string().email() });
          export const users = new Hono();

          users.get('/users', authMiddleware, (c) => c.json({ users: [] }));
          users.post('/users', async (c) => {
            const body = await c.req.json();
            createUserSchema.parse(body);
            return c.json({ ok: true });
          });
        `,
      );

      const scanner = new RouteScanner();
      const routes = await scanner.scan(routesDir);

      expect(routes['/users']).toBeDefined();
      expect(routes['/users'].length).toBe(2);
      expect(routes['/users'][0].requiresAuth).toBe(true);
      expect(routes['/users'][1].inputSchema).toBe('createUserSchema');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
