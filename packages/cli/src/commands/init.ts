import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateDrizzleConfig } from "@betterbase/core/config";
import { z } from "zod";
import * as logger from "../utils/logger";
import * as prompts from "../utils/prompts";
import { generateEnvContent, promptForProvider } from "../utils/provider-prompts";

const projectNameSchema = z
	.string()
	.trim()
	.min(1)
	.regex(
		/^[a-zA-Z0-9-_]+$/,
		"Project name can only contain letters, numbers, hyphens, and underscores.",
	);

const initOptionsSchema = z.object({
	projectName: projectNameSchema.optional(),
});

import type { ProviderType } from "@betterbase/shared";

const providerTypeSchema = z.enum([
	"neon",
	"turso",
	"planetscale",
	"supabase",
	"postgres",
	"managed",
]);

export type InitCommandOptions = z.infer<typeof initOptionsSchema>;

type StorageProvider = "s3" | "r2" | "backblaze" | "minio";

interface DatabaseCredentials {
	DATABASE_URL?: string;
	TURSO_URL?: string;
	TURSO_AUTH_TOKEN?: string;
}

interface StorageCredentials {
	STORAGE_ACCESS_KEY?: string;
	STORAGE_SECRET_KEY?: string;
	STORAGE_BUCKET?: string;
	STORAGE_REGION?: string;
	STORAGE_ENDPOINT?: string;
}

function getDatabaseLabel(provider: ProviderType): string {
	const labels: Record<ProviderType, string> = {
		neon: "Neon (serverless Postgres)",
		turso: "Turso (edge SQLite)",
		planetscale: "PlanetScale (MySQL-compatible)",
		supabase: "Supabase (Postgres)",
		postgres: "Raw Postgres",
		managed: "Managed by BetterBase (coming soon)",
	};
	return labels[provider];
}

function getAuthDialect(provider: ProviderType): "sqlite" | "pg" | "mysql" {
	if (provider === "turso") {
		return "sqlite";
	}
	if (provider === "planetscale") {
		return "mysql";
	}
	return "pg";
}

async function installDependencies(projectPath: string): Promise<void> {
	const installProcess = Bun.spawn(["bun", "install"], {
		cwd: projectPath,
		stdout: "inherit",
		stderr: "inherit",
	});

	const exitCode = await installProcess.exited;

	if (exitCode !== 0) {
		throw new Error("Dependency installation failed. Please run `bun install` manually.");
	}
}

async function initializeGitRepository(projectPath: string): Promise<void> {
	const gitProcess = Bun.spawn(["git", "init"], {
		cwd: projectPath,
		stdout: "ignore",
		stderr: "ignore",
	});

	const exitCode = await gitProcess.exited;

	if (exitCode !== 0) {
		logger.warn("Git initialization failed. You can run `git init` manually.");
	}
}

function buildPackageJson(projectName: string, provider: ProviderType, useAuth: boolean, storageProvider: StorageProvider | null): string {
	const dependencies: Record<string, string> = {
		hono: "^4.11.9",
		"drizzle-orm": "^0.45.1",
		zod: "^4.3.6",
	};

	if (provider === "neon") {
		dependencies["@neondatabase/serverless"] = "^1.0.0";
	}

	if (provider === "turso") {
		dependencies["@libsql/client"] = "^0.14.0";
	}

	if (provider === "postgres" || provider === "supabase") {
		dependencies.pg = "^8.13.1";
	}

	if (provider === "planetscale") {
		dependencies["@planetscale/database"] = "^1.22.0";
	}

	if (useAuth) {
		dependencies["better-auth"] = "^1.1.15";
	}

	if (storageProvider) {
		dependencies["@aws-sdk/client-s3"] = "^3.700.0";
		dependencies["@aws-sdk/s3-request-presigner"] = "^3.700.0";
	}

	const json = {
		name: projectName,
		private: true,
		type: "module",
		scripts: {
			dev: "bun run src/index.ts",
			build: "bun build src/index.ts --outfile dist/index.js --target bun",
			start: "bun run dist/index.js",
			"db:generate": "drizzle-kit generate",
			"db:push": "bun run src/db/migrate.ts",
		},
		dependencies,
		devDependencies: {
			"@types/bun": "^1.3.9",
			"drizzle-kit": "^0.31.4",
			typescript: "^5.9.3",
		},
	};

	return `${JSON.stringify(json, null, 2)}\n`;
}

function buildDrizzleConfig(provider: ProviderType): string {
	// Use the generateDrizzleConfig from @betterbase/core
	return generateDrizzleConfig(provider);
}

function buildBetterbaseConfig(projectName: string, provider: ProviderType): string {
	let providerBlock = `type: "${provider}",`;

	if (provider === "turso") {
		providerBlock += `
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,`;
	} else if (provider === "managed") {
		// Managed provider - no connection string needed for now
		providerBlock += `
    connectionString: process.env.DATABASE_URL,`;
	} else {
		providerBlock += `
    connectionString: process.env.DATABASE_URL,`;
	}

	return `import { defineConfig } from "@betterbase/core";

export default defineConfig({
  project: {
    name: "${projectName}",
  },
  provider: {
    ${providerBlock}
  },
});
`;
}

async function buildSchema(provider: ProviderType): Promise<string> {
	if (provider === "neon" || provider === "postgres" || provider === "supabase") {
		return `import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
`;
	}

	if (provider === "planetscale") {
		return `import { bigint, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).generatedAlwaysAsIdentity().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
`;
	}

	return `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Adds created_at and updated_at timestamp columns.
 * Note: .$onUpdate(() => new Date()) runs when updates go through Drizzle.
 * For raw SQL writes, add a DB trigger if you need automatic updated_at changes.
 */
export const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

/**
 * UUID primary-key helper.
 */
export const uuid = (name = 'id') =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * Soft-delete helper.
 */
export const softDelete = {
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
};

/**
 * Shared status enum helper.
 */
export const statusEnum = (name = 'status') =>
  text(name, { enum: ['active', 'inactive', 'pending'] }).default('active');

/**
 * Currency helper stored as integer cents.
 */
export const moneyColumn = (name: string) => integer(name).notNull().default(0);

/**
 * JSON text helper with type support.
 */
export const jsonColumn = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

export const users = sqliteTable('users', {
  id: uuid(),
  email: text('email').notNull().unique(),
  name: text('name'),
  status: statusEnum(),
  ...timestamps,
  ...softDelete,
});

export const posts = sqliteTable('posts', {
  id: uuid(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').references(() => users.id),
  ...timestamps,
});
`;
}

function buildMigrateScript(provider: ProviderType): string {
	if (provider === "neon" || provider === "postgres" || provider === "supabase") {
		return `import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to apply migrations:', message);
  process.exit(1);
} finally {
  await pool.end();
}
`;
	}

	if (provider === "turso") {
		return `import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const client = createClient({
  url: process.env.TURSO_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to apply migrations:', message);
  process.exit(1);
}
`;
	}

	if (provider === "planetscale") {
		return `import { connect } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';
import { migrate } from 'drizzle-orm/planetscale-serverless/migrator';

const client = connect({
  url: process.env.DATABASE_URL,
});

const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to apply migrations:', message);
  process.exit(1);
}
`;
	}

	return `import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { env } from '../lib/env';

try {
  const sqlite = new Database(env.DB_PATH, { create: true });
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to apply migrations:', message);
  process.exit(1);
}
`;
}

function buildDbIndex(provider: ProviderType): string {
	if (provider === "neon" || provider === "postgres" || provider === "supabase") {
		return `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
`;
	}

	if (provider === "turso") {
		return `import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
  url: process.env.TURSO_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
`;
	}

	if (provider === "planetscale") {
		return `import { connect } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';
import * as schema from './schema';

const client = connect({
  url: process.env.DATABASE_URL,
});

export const db = drizzle(client, { schema });
`;
	}

	return `import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../lib/env';
import * as schema from './schema';

const client = new Database(env.DB_PATH, { create: true });

export const db = drizzle(client, { schema });
`;
}

function buildAuthMiddleware(): string {
	return `import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (_c, next) => {
  // TODO: wire BetterAuth session validation.
  await next();
});
`;
}

function buildAuthInstanceFile(dialect: "sqlite" | "pg" | "mysql"): string {
	const provider = dialect === "sqlite" ? "sqlite" : dialect === "mysql" ? "mysql" : "pg";
	return `import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "../db"
import * as schema from "../db/auth-schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "${provider}",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.AUTH_URL ?? "http://localhost:3000"],
  plugins: [],
})

export type Auth = typeof auth
`;
}

function buildAuthTypesFile(): string {
	return `import type { auth } from "./index"

export type Session = typeof auth.$Infer.Session.session
export type User = typeof auth.$Infer.Session.user

export type AuthVariables = {
  user: User
  session: Session
}
`;
}

function buildAuthMiddlewareFile(): string {
	return `import { auth } from "../auth"
import type { Context, Next } from "hono"

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (!session) {
    return c.json({ data: null, error: "Unauthorized" }, 401)
  }
  c.set("user", session.user)
  c.set("session", session.session)
  await next()
}

export async function optionalAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (session) {
    c.set("user", session.user)
    c.set("session", session.session)
  }
  await next()
}

export function getAuthUser(c: Context) {
  return c.get("user")
}
`;
}

function buildAuthSchemaSqlite(): string {
	return `import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})
`;
}

function buildAuthSchemaPg(): string {
	return `import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }),
})
`;
}

function buildAuthSchemaMysql(): string {
	return `import { bigint, boolean, datetime, mysqlTable, text } from 'drizzle-orm/mysql-core'

export const user = mysqlTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
})

export const session = mysqlTable("session", {
  id: text("id").primaryKey(),
  expiresAt: datetime("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = mysqlTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: datetime("access_token_expires_at"),
  refreshTokenExpiresAt: datetime("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
})

export const verification = mysqlTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: datetime("expires_at").notNull(),
  createdAt: datetime("created_at"),
  updatedAt: datetime("updated_at"),
})
`;
}

function buildReadme(
	projectName: string,
	provider: ProviderType,
	authEnabled: boolean,
	storageEnabled: boolean,
): string {
	return `# ${projectName}

Generated with BetterBase CLI.

## Configuration

- **Database**: ${getDatabaseLabel(provider)}
- **Auth**: ${authEnabled ? "BetterAuth enabled" : "Not configured"}
- **Storage**: ${storageEnabled ? "S3-compatible storage enabled" : "Not configured"}

## Scripts

- \`bun run dev\`
- \`bun run db:generate\`
- \`bun run db:push\`
`;
}

function buildRoutesIndex(): string {
	return `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { healthRoute } from './health';
import { usersRoute } from './users';
import { env } from '../lib/env';

export function registerRoutes(app: Hono): void {
  app.use('*', cors());
  app.use('*', logger());

  app.onError((err, c) => {
    const isHttpError = err instanceof HTTPException;
    const showDetailedError = env.NODE_ENV === 'development' || isHttpError;

    return c.json(
      {
        error: showDetailedError ? err.message : 'Internal Server Error',
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        details: isHttpError ? (err as { cause?: unknown }).cause ?? null : null,
      },
      isHttpError ? err.status : 500,
    );
  });

  app.route('/health', healthRoute);
  app.route('/api/users', usersRoute);
}
`;
}

function buildStorageRoute(provider: StorageProvider): string {
	const regionLine = `  region: process.env.STORAGE_REGION ?? "us-east-1",`;
	const endpointLine =
		provider === "s3"
			? regionLine
			: `  endpoint: process.env.STORAGE_ENDPOINT,\n${regionLine}`;

	return `import { Hono } from 'hono';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '',
  },
${endpointLine}
});

const BUCKET = process.env.STORAGE_BUCKET ?? '';
`;

// Helper to check if user is authenticated and get user ID
async function getAuthenticatedUserId(c: any): Promise<{ id: string } | null> {
  // Try to get user from session/cookie (BetterAuth pattern)
  const sessionCookie = c.req.cookie('better-auth.session_token');
  if (!sessionCookie) {
    return null;
  }
  
  // In production, validate the session token with BetterAuth
  // For now, check for user ID in header (set by auth middleware after validation)
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return null;
  }
  
  return { id: userId };
}

// Helper to validate user owns the key (key must start with user ID)
function validateKeyOwnership(key: string, userId: string, isAdmin: boolean = false): boolean {
  // Key must be prefixed with user ID to ensure ownership
  // Format: users/{userId}/... or {userId}/...
  const prefix = `users/${userId}/`;
  const directPrefix = `${userId}/`;
  
  if (key.startsWith(prefix) || key.startsWith(directPrefix)) {
    return true;
  }
  
  // Also allow admin users to access any key
  return isAdmin;
}

export const storageRoute = new Hono();

// Auth middleware for all storage routes
storageRoute.use('*', async (c, next) => {
  const user = await getAuthenticatedUserId(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('userId', user.id);
  await next();
});

// Upload — returns a presigned PUT URL
storageRoute.post('/presign', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { key, contentType } = await c.req.json<{ key: string; contentType: string }>();
  
  // Validate ownership: key must be owned by the user
  if (!validateKeyOwnership(key, userId)) {
    return c.json({ error: 'Forbidden: You can only upload files to your own directory' }, 403);
  }
  
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
  return c.json({ url, key });
});

// Download — returns a presigned GET URL
storageRoute.get('/presign/:key{.+}', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const key = c.req.param('key');
  
  // Validate ownership: key must be owned by the user
  if (!validateKeyOwnership(key, userId)) {
    return c.json({ error: 'Forbidden: You can only download files from your own directory' }, 403);
  }
  
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 300 },
  );
  return c.json({ url, key });
});

// Delete
storageRoute.delete('/:key{.+}', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const key = c.req.param('key');
  
  // Validate ownership: key must be owned by the user
  if (!validateKeyOwnership(key, userId)) {
    return c.json({ error: 'Forbidden: You can only delete files from your own directory' }, 403);
  }
  
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  return c.json({ deleted: true, key });
});
`;
}

async function writeProjectFiles(
	projectPath: string,
	projectName: string,
	provider: ProviderType,
	useAuth: boolean,
	storageProvider: StorageProvider | null,
	dbCredentials: DatabaseCredentials,
	storageCredentials: StorageCredentials,
): Promise<void> {
	await mkdir(path.join(projectPath, "src/db"), { recursive: true });
	await mkdir(path.join(projectPath, "src/routes"), { recursive: true });
	await mkdir(path.join(projectPath, "src/middleware"), { recursive: true });
	await mkdir(path.join(projectPath, "src/lib"), { recursive: true });

	// Build .env content based on provider and credentials
	// Use the generateEnvContent from provider-prompts for better comments
	let envContent = generateEnvContent(provider, dbCredentials as Record<string, string>);

	// Add NODE_ENV and PORT to all configs
	envContent = `NODE_ENV=development\nPORT=3000\n${envContent}`;

	if (useAuth) {
		const authSecret = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
		envContent += `\nAUTH_SECRET=${authSecret}
AUTH_URL=http://localhost:3000
`;
	}

	if (storageProvider) {
		envContent += `\n# Storage (${storageProvider})
STORAGE_PROVIDER=${storageProvider}
STORAGE_ACCESS_KEY=${storageCredentials.STORAGE_ACCESS_KEY || ""}
STORAGE_SECRET_KEY=${storageCredentials.STORAGE_SECRET_KEY || ""}
STORAGE_BUCKET=${storageCredentials.STORAGE_BUCKET || ""}
`;
		if (storageProvider === "s3") {
			envContent += `STORAGE_REGION=${storageCredentials.STORAGE_REGION || "us-east-1"}\n`;
		} else {
			envContent += `STORAGE_ENDPOINT=${storageCredentials.STORAGE_ENDPOINT || ""}\n`;
		}
	}

	await writeFile(path.join(projectPath, ".env"), envContent);

	// .env.example without secrets
	let envExampleContent = `NODE_ENV=development
PORT=3000
`;
	if (provider === "turso") {
		envExampleContent += `TURSO_URL=
TURSO_AUTH_TOKEN=
`;
	} else {
		envExampleContent += `DATABASE_URL=
`;
	}

	if (useAuth) {
		envExampleContent += `\nAUTH_SECRET=your-secret-key-change-in-production
AUTH_URL=http://localhost:3000
`;
	}

	if (storageProvider) {
		envExampleContent += `\n# Storage (${storageProvider})
STORAGE_PROVIDER=${storageProvider}
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=
`;
		if (storageProvider === "s3") {
			envExampleContent += "STORAGE_REGION=us-east-1\n";
		} else {
			envExampleContent += "STORAGE_ENDPOINT=\n";
		}
	}

	await writeFile(path.join(projectPath, ".env.example"), envExampleContent);

	// env.ts with appropriate schema
	const dbEnvFields =
		provider === "turso"
			? `  TURSO_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),`
		: provider !== "managed"
			? `  DATABASE_URL: z.string().min(1),`
			: "";

	const authEnvFields = useAuth
		? `  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().default('http://localhost:3000'),`
		: "";

	const storageEnvFields = storageProvider
		? `  STORAGE_PROVIDER: z.enum(['s3', 'r2', 'backblaze', 'minio']),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),`
		: "";

	const envSchemaContent = `import { z } from 'zod'

export const DEFAULT_DB_PATH = 'local.db'

export const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().min(1).default(DEFAULT_DB_PATH),
${dbEnvFields}
${authEnvFields}
${storageEnvFields}
}).parse(process.env)
`;

	await writeFile(path.join(projectPath, "src/lib/env.ts"), envSchemaContent);

	await writeFile(
		path.join(projectPath, "betterbase.config.ts"),
		buildBetterbaseConfig(projectName, provider),
	);
	await writeFile(path.join(projectPath, "drizzle.config.ts"), buildDrizzleConfig(provider));
	await writeFile(
		path.join(projectPath, "package.json"),
		buildPackageJson(projectName, provider, useAuth, storageProvider),
	);

	await writeFile(
		path.join(projectPath, "tsconfig.json"),
		`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "types": ["bun"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "drizzle.config.ts", "betterbase.config.ts"]
}
`,
	);

	let gitignoreContent = `node_modules
bun.lockb
.env
.env.*
!.env.example
local.db
drizzle
`;

	if (storageProvider) {
		gitignoreContent += `\n# Storage uploads
uploads/
`;
	}

	await writeFile(path.join(projectPath, ".gitignore"), gitignoreContent);

	await writeFile(
		path.join(projectPath, "README.md"),
		buildReadme(projectName, provider, useAuth, !!storageProvider),
	);
	await writeFile(path.join(projectPath, "src/db/schema.ts"), await buildSchema(provider));
	await writeFile(path.join(projectPath, "src/db/index.ts"), buildDbIndex(provider));
	await writeFile(path.join(projectPath, "src/db/migrate.ts"), buildMigrateScript(provider));

	await writeFile(
		path.join(projectPath, "src/routes/health.ts"),
		`import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  try {
    await db.execute(sql\`select 1\`);

    return c.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return c.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});
`,
	);

	await writeFile(
		path.join(projectPath, "src/middleware/validation.ts"),
		`import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HTTPException(400, {
      message: 'Validation failed',
      cause: {
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
  }

  return result.data;
}
`,
	);

	await writeFile(
		path.join(projectPath, "src/routes/users.ts"),
		`import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { parseBody } from '../middleware/validation';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const usersRoute = new Hono();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

usersRoute.get('/', async (c) => {
  const requestedLimit = parseNonNegativeInt(c.req.query('limit'), DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const offset = parseNonNegativeInt(c.req.query('offset'), DEFAULT_OFFSET);

  if (limit === 0) {
    return c.json({
      users: [],
      pagination: {
        limit,
        offset,
        hasMore: false,
      },
    });
  }

  try {
    const rows = await db.select().from(users).limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    const paginatedUsers = rows.slice(0, limit);

    return c.json({
      users: paginatedUsers,
      pagination: {
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error('Failed to fetch users:', error);
    throw error;
  }
});

usersRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseBody(createUserSchema, body);

    const created = await db.insert(users).values(parsed).returning();
    if (created.length === 0) {
      throw new HTTPException(500, { message: 'Failed to persist user' });
    }

    return c.json({
      user: created[0],
    }, 201);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new HTTPException(400, { message: 'Malformed JSON body' });
    }

    throw error;
  }
});
`,
	);

	await writeFile(path.join(projectPath, "src/routes/index.ts"), buildRoutesIndex());

	// Build index.ts with optional auth mounting
	let indexContent = `import { Hono } from 'hono';
import { env } from './lib/env';
import { registerRoutes } from './routes';

const app = new Hono();
registerRoutes(app);
`;

	if (useAuth) {
		indexContent += `
import { auth } from './auth';

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
`;
	}

	indexContent += `
const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  development: env.NODE_ENV === 'development',
});

console.log(\`🚀 Server running at http://localhost:\${server.port}\`);
for (const route of app.routes) {
  console.log(\`  \${route.method} \${route.path}\`);
}

process.on('SIGTERM', () => {
  server.stop();
});

process.on('SIGINT', () => {
  server.stop();
});

export default server;
`;

	await writeFile(path.join(projectPath, "src/index.ts"), indexContent);

	await writeFile(
		path.join(projectPath, "src/lib/utils.ts"),
		`export function notImplemented(feature: string): never {
  throw new Error(\`\${feature} is not implemented yet.\`);
}
`,
	);

	// Write auth files if enabled
	if (useAuth) {
		const dialect = getAuthDialect(provider);

		// Warn about PlanetScale RLS
		if (provider === "planetscale") {
			logger.warn("Note: PlanetScale does not support Row Level Security (RLS).");
		}

		await mkdir(path.join(projectPath, "src/auth"), { recursive: true });

		await writeFile(path.join(projectPath, "src/auth/index.ts"), buildAuthInstanceFile(dialect));
		await writeFile(path.join(projectPath, "src/auth/types.ts"), buildAuthTypesFile());
		await writeFile(path.join(projectPath, "src/middleware/auth.ts"), buildAuthMiddlewareFile());

		// Write auth schema based on dialect
		if (dialect === "sqlite") {
			await writeFile(path.join(projectPath, "src/db/auth-schema.ts"), buildAuthSchemaSqlite());
		} else if (dialect === "mysql") {
			await writeFile(path.join(projectPath, "src/db/auth-schema.ts"), buildAuthSchemaMysql());
		} else {
			await writeFile(path.join(projectPath, "src/db/auth-schema.ts"), buildAuthSchemaPg());
		}

		// Update db/index.ts to export auth-schema
		const dbIndexContent = buildDbIndex(provider);
		await writeFile(
			path.join(projectPath, "src/db/index.ts"),
			`${dbIndexContent}\nexport * from "./auth-schema";\n`,
		);
	}

	// Write storage route if enabled
	if (storageProvider) {
		await writeFile(
			path.join(projectPath, "src/routes/storage.ts"),
			buildStorageRoute(storageProvider),
		);

		// Register in routes/index.ts
		const routesIndexPath = path.join(projectPath, "src/routes/index.ts");
		const routesIndex = await Bun.file(routesIndexPath).text();
		const updated = routesIndex
			.replace(
				`import { usersRoute } from './users';`,
				`import { usersRoute } from './users';\nimport { storageRoute } from './storage';`,
			)
			.replace(
				`app.route('/api/users', usersRoute);`,
				`app.route('/api/users', usersRoute);\n  app.route('/api/storage', storageRoute);`,
			);
		await writeFile(routesIndexPath, updated);
	}
}

/**
 * Run the `bb init` command.
 */
export async function runInitCommand(rawOptions: InitCommandOptions): Promise<void> {
	const options = initOptionsSchema.parse(rawOptions);

	const projectNameInput =
		options.projectName ??
		(await prompts.text({
			message: "What is your project name?",
			initial: "my-betterbase-app",
		}));

	const projectName = projectNameSchema.parse(projectNameInput);
	const projectPath = path.resolve(process.cwd(), projectName);

	// PROMPT 1 — Database Provider Selection using the new provider-prompts module
	const { providerType, envVars } = await promptForProvider();
	const provider: ProviderType = providerType;
	const dbCredentials: DatabaseCredentials = envVars as DatabaseCredentials;

	// PROMPT 4 — BetterAuth Setup Option
	const authEnabled = await prompts.confirm({
		message: "Set up authentication now?",
		default: true,
	});

	let storageEnabled = false;
	let storageProvider: StorageProvider | null = null;
	const storageCredentials: StorageCredentials = {};

	// PROMPT 5 — Storage
	storageEnabled = await prompts.confirm({
		message: "Set up S3-compatible storage now?",
		default: false,
	});

	if (storageEnabled) {
		const storageChoice = await prompts.select({
			message: "Storage provider:",
			options: [
				{ label: "AWS S3", value: "s3" },
				{ label: "Cloudflare R2", value: "r2" },
				{ label: "Backblaze B2", value: "backblaze" },
				{ label: "MinIO (self-hosted)", value: "minio" },
			],
		});
		storageProvider = storageChoice as StorageProvider;

		storageCredentials.STORAGE_ACCESS_KEY = await prompts.text({
			message: "Access Key ID:",
			initial: "",
		});
		storageCredentials.STORAGE_SECRET_KEY = await prompts.text({
			message: "Secret Access Key:",
			initial: "",
		});
		storageCredentials.STORAGE_BUCKET = await prompts.text({
			message: "Bucket name:",
			initial: "",
		});

		if (storageProvider === "s3") {
			storageCredentials.STORAGE_REGION = await prompts.text({
				message: "Region:",
				initial: "us-east-1",
			});
		} else {
			storageCredentials.STORAGE_ENDPOINT = await prompts.text({
				message: "Endpoint URL:",
				initial: "",
			});
		}
	}

	// PROMPT 6 — FINAL SUMMARY AND CONFIRMATION
	logger.info(`Creating project: ${projectName}`);
	logger.info(`Provider: ${provider}`);
	logger.info(`Auth: ${authEnabled ? "BetterAuth" : "skipped"}`);
	logger.info(`Storage: ${storageProvider ?? "skipped"}`);

	const proceed = await prompts.confirm({
		message: "Proceed?",
		default: true,
	});

	if (!proceed) {
		process.exit(0);
	}

	let createdProjectDir = false;

	try {
		await mkdir(projectPath);
		createdProjectDir = true;
	} catch (error) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (code === "EEXIST") {
			throw new Error(`Directory \`${projectName}\` already exists. Choose another project name.`);
		}

		const message = error instanceof Error ? error.message : "Unknown directory creation error";
		throw new Error(`Failed to create project directory: ${message}`);
	}

	try {
		logger.info("Creating project files...");
		await writeProjectFiles(
			projectPath,
			projectName,
			provider,
			authEnabled,
			storageProvider,
			dbCredentials,
			storageCredentials,
		);

		logger.info("Installing dependencies with bun...");
		await installDependencies(projectPath);

		const useGit = await prompts.confirm({
			message: "Initialize git repository?",
			default: true,
		});

		if (useGit) {
			logger.info("Initializing git repository...");
			await initializeGitRepository(projectPath);
		}

		logger.success("BetterBase project created successfully!");
		console.log("");
		console.log(`📁 Project: ${projectName}`);
		console.log(`🗄️  Database: ${getDatabaseLabel(provider)}`);
		console.log(`🔐 Auth: ${authEnabled ? "Enabled" : "Disabled"}`);
		console.log("");
		console.log("Next steps:");
		console.log(`  cd ${projectName}`);
		console.log("  bun run dev");
		console.log("");
		console.log("Your backend is running at http://localhost:3000");
	} catch (error) {
		if (createdProjectDir) {
			try {
				await rm(projectPath, { recursive: true, force: true });
			} catch (cleanupError) {
				const cleanupMessage =
					cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
				logger.warn(`Failed to cleanup \`${projectName}\`: ${cleanupMessage}`);
			}
		}

		const message = error instanceof Error ? error.message : String(error);
		logger.error(
			`Failed to install dependencies.\n` +
			`Try running manually: cd ${projectName} && bun install\n` +
			`Error: ${message}`
		);

		throw error;
	}
}
