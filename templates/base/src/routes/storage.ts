import { type StorageFactory, createStorage, type StoragePolicy, type StorageConfig, checkStorageAccess, getPolicyDenialMessage } from "@betterbase/core/storage";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError, z } from "zod";
import { auth } from "../auth";
import { parseBody } from "../middleware/validation";

// Type for user from auth
type AuthUser = { id: string; [key: string]: unknown };

// Extended context type for storage operations
interface StorageContext extends Context {
	get(key: "user"): AuthUser | undefined;
	get(key: "session"): unknown;
}

// Default max file size: 50MB
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

// Get storage config from environment variables
function getStorageConfig(): StorageConfig | null {
	const provider = process.env.STORAGE_PROVIDER;
	const bucket = process.env.STORAGE_BUCKET;

	if (!provider || !bucket) {
		return null;
	}

	switch (provider) {
		case "s3":
			return {
				provider: "s3" as const,
				bucket,
				region: process.env.STORAGE_REGION || "us-east-1",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
			};
		case "r2":
			return {
				provider: "r2" as const,
				bucket,
				accountId: process.env.STORAGE_ACCOUNT_ID || "",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
				endpoint: process.env.STORAGE_ENDPOINT,
			};
		case "backblaze":
			return {
				provider: "backblaze" as const,
				bucket,
				region: process.env.STORAGE_REGION || "us-west-002",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
				endpoint: process.env.STORAGE_ENDPOINT,
			};
		case "minio":
			return {
				provider: "minio" as const,
				bucket,
				endpoint: process.env.STORAGE_ENDPOINT || "localhost:9000",
				port: Number.parseInt(process.env.STORAGE_PORT || "9000", 10),
				useSSL: process.env.STORAGE_USE_SSL === "true",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
			};
		default:
			return null;
	}
}

// Get storage policies from environment variables
function getStoragePolicies(): StoragePolicy[] {
	const policiesJson = process.env.STORAGE_POLICIES;
	if (!policiesJson) {
		return [];
	}

	try {
		const parsed = JSON.parse(policiesJson);
		if (Array.isArray(parsed)) {
			return parsed;
		}
		return [];
	} catch {
		console.warn("[Storage] Invalid STORAGE_POLICIES JSON, ignoring");
		return [];
	}
}

// Initialize storage factory
const storageConfig = getStorageConfig();
const storage: StorageFactory | null = storageConfig ? createStorage(storageConfig) : null;
const storagePolicies = getStoragePolicies();

// Validate bucket access - only allow configured bucket
function validateBucket(bucket: string): void {
	if (!storageConfig) {
		throw new HTTPException(503, { message: "Storage not configured" });
	}
	if (bucket !== storageConfig.bucket) {
		throw new HTTPException(403, { message: "Invalid bucket access" });
	}
}

// Get allowed MIME types from environment
function getAllowedMimeTypes(): string[] {
	const allowed = process.env.STORAGE_ALLOWED_MIME_TYPES;
	if (!allowed) {
		return []; // No restrictions
	}
	return allowed.split(",").map((m) => m.trim());
}

// Get max file size from environment
function getMaxFileSize(): number {
	const maxSize = process.env.STORAGE_MAX_FILE_SIZE;
	if (!maxSize) {
		return DEFAULT_MAX_FILE_SIZE;
	}
	const parsed = parseInt(maxSize, 10);
	return isNaN(parsed) ? DEFAULT_MAX_FILE_SIZE : parsed;
}

// Validate MIME type for upload
function validateMimeType(contentType: string): void {
	const allowedTypes = getAllowedMimeTypes();
	if (allowedTypes.length === 0) {
		return; // No restrictions
	}

	// Handle wildcards
	const normalizedType = contentType.toLowerCase();
	const typePart = normalizedType.split("/")[0];

	for (const allowed of allowedTypes) {
		if (allowed === normalizedType) {
			return; // Exact match
		}
		if (allowed.endsWith("/*")) {
			const prefix = allowed.slice(0, -1);
			if (normalizedType.startsWith(prefix)) {
				return; // Wildcard match (e.g., "image/*")
			}
		}
	}

	throw new HTTPException(403, {
		message: `MIME type "${contentType}" is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
	});
}

// Validate file size
function validateFileSize(size: number): void {
	const maxSize = getMaxFileSize();
	if (size > maxSize) {
		const maxSizeMB = Math.round(maxSize / (1024 * 1024));
		throw new HTTPException(400, {
			message: `File too large. Maximum size is ${maxSizeMB}MB`,
		});
	}
}

// Check storage policy for an operation
function checkPolicy(
	operation: "upload" | "download" | "list" | "delete",
	userId: string | null,
	bucket: string,
	path: string,
): void {
	// Fail-closed: if no policies are configured, deny by default
	if (storagePolicies.length === 0) {
		console.log(`[Storage Policy] No policies configured, denying ${operation} on ${path}`);
		throw new HTTPException(403, { message: getPolicyDenialMessage(operation, path) });
	}

	const allowed = checkStorageAccess(storagePolicies, userId, bucket, operation, path);
	if (!allowed) {
		throw new HTTPException(403, { message: getPolicyDenialMessage(operation, path) });
	}
}

// Sanitize path to prevent path traversal attacks
function sanitizePath(path: string): string {
	// Remove leading slashes and normalize
	const sanitized = path.replace(/^\/+/, "").replace(/\/+/g, "/");

	// Check for path traversal attempts
	if (sanitized.includes("..") || sanitized.startsWith("/")) {
		throw new HTTPException(400, {
			message: "Invalid path: path traversal not allowed",
		});
	}

	return sanitized;
}

// Validate and sanitize path parameter
function validatePath(path: string): string {
	if (!path || path.length === 0) {
		throw new HTTPException(400, { message: "Path is required" });
	}
	return sanitizePath(path);
}

// Auth middleware for storage routes
async function requireAuth(c: Context, next: Next): Promise<Response | undefined> {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	c.set("user", session.user);
	c.set("session", session.session);
	await next();
}

// Schemas for request validation
const signUrlSchema = z.object({
	expiresIn: z.number().int().positive().optional().default(3600),
});

const deleteFilesSchema = z.object({
	paths: z.array(z.string().min(1)).min(1),
});

export const storageRouter = new Hono();

// Apply auth middleware to all storage routes (except public URL)
storageRouter.use("/*", async (c, next) => {
	// Skip auth for public URL endpoint
	if (c.req.path.toString().endsWith("/public")) {
		await next();
		return;
	}
	await requireAuth(c, next);
});

// GET /api/storage/:bucket - List files
storageRouter.get("/:bucket", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		// Check list policy (allow public access if policy is 'true')
		const user = c.get("user") as AuthUser | undefined;
		const userId = user?.id || null;
		const prefix = c.req.query("prefix") || "";
		checkPolicy("list", userId, bucket, prefix);

		const sanitizedPrefix = prefix ? sanitizePath(prefix) : undefined;
		const result = await storage.from(bucket).list(sanitizedPrefix);

		if (result.error) {
			return c.json({ error: result.error.message }, 500);
		}

		const files = (result.data || []).map((obj) => ({
			name: obj.key,
			size: obj.size,
			lastModified: obj.lastModified.toISOString(),
		}));

		return c.json({ files });
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		console.error("Failed to list files:", error);
		return c.json({ error: "Failed to list files" }, 500);
	}
});

// DELETE /api/storage/:bucket - Delete files
storageRouter.delete("/:bucket", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		const user = c.get("user") as AuthUser | undefined;
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = parseBody(deleteFilesSchema, body);

		// Validate all paths and check delete policy
		for (const p of parsed.paths) {
			const sanitizedPath = validatePath(p);
			checkPolicy("delete", user.id, bucket, sanitizedPath);
		}

		const sanitizedPaths = parsed.paths.map((p: string) => validatePath(p));

		const result = await storage.from(bucket).remove(sanitizedPaths);

		if (result.error) {
			return c.json({ error: result.error.message }, 500);
		}

		return c.json({
			message: result.data?.message || "Files deleted successfully",
		});
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		if (error instanceof ZodError) {
			return c.json(
				{
					error: "Invalid request body",
					details: error.issues,
				},
				400,
			);
		}
		console.error("Failed to delete files:", error);
		return c.json({ error: "Failed to delete files" }, 500);
	}
});

// POST /api/storage/:bucket/upload - Upload a file
storageRouter.post("/:bucket/upload", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		const user = c.get("user") as AuthUser | undefined;
		if (!user) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		// Get content type from headers
		const contentType = c.req.header("Content-Type") || "application/octet-stream";

		// Validate MIME type
		validateMimeType(contentType);

		const contentLength = c.req.header("Content-Length");

		// Get the file buffer
		const arrayBuffer = await c.req.arrayBuffer();
		const body = Buffer.from(arrayBuffer);

		// Validate file size
		validateFileSize(body.length);

		// Extract and validate path from query param or use default
		const pathInput = c.req.query("path") || `uploads/${Date.now()}-file`;
		const path = validatePath(pathInput);

		// Check upload policy before uploading
		checkPolicy("upload", user.id, bucket, path);

		const result = await storage.from(bucket).upload(path, body, {
			contentType,
		});

		if (result.error) {
			return c.json({ error: result.error.message }, 500);
		}

		const publicUrl = storage.from(bucket).getPublicUrl(path);

		return c.json({
			path,
			url: publicUrl,
			size: result.data?.size || 0,
			contentType: result.data?.contentType || contentType,
		});
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		console.error("Failed to upload file:", error);
		return c.json({ error: "Failed to upload file" }, 500);
	}
});

// GET /api/storage/:bucket/:key - Download a file
storageRouter.get("/:bucket/:key", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		// Check download policy
		const user = c.get("user") as AuthUser | undefined;
		const userId = user?.id || null;
		checkPolicy("download", userId, bucket, key);

		const result = await storage.from(bucket).download(key);

		if (result.error) {
			if (result.error.message.includes("NoSuchKey") || result.error.message.includes("NotFound")) {
				return c.json({ error: "File not found" }, 404);
			}
			return c.json({ error: result.error.message }, 500);
		}

		if (!result.data) {
			return c.json({ error: "File not found" }, 404);
		}

		// Get content type from result metadata or use default
		const contentType = "application/octet-stream";

		return c.body(new Uint8Array(result.data), {
			headers: {
				"Content-Type": contentType,
				"Content-Length": String(result.data?.length || 0),
				"Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
			},
		});
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		console.error("Failed to download file:", error);
		return c.json({ error: "Failed to download file" }, 500);
	}
});

// GET /api/storage/:bucket/:key/public - Get public URL
storageRouter.get("/:bucket/:key/public", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		// Check download policy (allows anonymous if policy is 'true')
		const user = c.get("user") as AuthUser | undefined;
		const userId = user?.id || null;
		checkPolicy("download", userId, bucket, key);

		const publicUrl = storage.from(bucket).getPublicUrl(key);

		return c.json({ publicUrl });
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		console.error("Failed to get public URL:", error);
		return c.json({ error: "Failed to get public URL" }, 500);
	}
});

// POST /api/storage/:bucket/:key/sign - Create signed URL
storageRouter.post("/:bucket/:key/sign", async (c: StorageContext) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		// Check download policy for signing
		const user = c.get("user") as AuthUser | undefined;
		const userId = user?.id || null;
		checkPolicy("download", userId, bucket, key);

		const body = await c.req.json().catch(() => ({}));
		const parsed = parseBody(signUrlSchema, body);

		const result = await storage.from(bucket).createSignedUrl(key, {
			expiresIn: parsed.expiresIn,
		});

		if (result.error) {
			return c.json({ error: result.error.message }, 500);
		}

		return c.json({ signedUrl: result.data?.signedUrl || "" });
	} catch (error) {
		if (error instanceof HTTPException) {
			throw error;
		}
		if (error instanceof ZodError) {
			return c.json(
				{
					error: "Invalid request body",
					details: error.issues,
				},
				400,
			);
		}
		console.error("Failed to create signed URL:", error);
		return c.json({ error: "Failed to create signed URL" }, 500);
	}
});
