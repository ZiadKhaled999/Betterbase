import { type StorageFactory, createStorage } from "@betterbase/core/storage";
import type { StorageConfig } from "@betterbase/core/storage";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError, z } from "zod";
import { auth } from "../auth";
import { parseBody } from "../middleware/validation";

// Get storage config from environment variables
function getStorageConfig(): StorageConfig | null {
	const provider = process.env.STORAGE_PROVIDER;
	const bucket = process.env.STORAGE_BUCKET;

	if (!provider || !bucket) {
		return null;
	}

	const baseConfig = {
		bucket,
	};

	switch (provider) {
		case "s3":
			return {
				provider: "s3",
				...baseConfig,
				region: process.env.STORAGE_REGION || "us-east-1",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
			};
		case "r2":
			return {
				provider: "r2",
				...baseConfig,
				accountId: process.env.STORAGE_ACCOUNT_ID || "",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
				endpoint: process.env.STORAGE_ENDPOINT,
			};
		case "backblaze":
			return {
				provider: "backblaze",
				...baseConfig,
				region: process.env.STORAGE_REGION || "us-west-002",
				accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
				endpoint: process.env.STORAGE_ENDPOINT,
			};
		case "minio":
			return {
				provider: "minio",
				...baseConfig,
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

// Initialize storage factory
const storageConfig = getStorageConfig();
const storage: StorageFactory | null = storageConfig ? createStorage(storageConfig) : null;

// Validate bucket access - only allow configured bucket
function validateBucket(bucket: string): void {
	if (!storageConfig) {
		throw new HTTPException(503, { message: "Storage not configured" });
	}
	if (bucket !== storageConfig.bucket) {
		throw new HTTPException(403, { message: "Invalid bucket access" });
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
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		c.set("user", session.user);
		c.set("session", session.session);
	} catch (error) {
		console.error("Storage requireAuth error:", error);
		return c.json({ error: "Unauthorized" }, 401);
	}
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
storageRouter.get("/:bucket", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		const prefix = c.req.query("prefix");
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
storageRouter.delete("/:bucket", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		const body = await c.req.json().catch(() => ({}));
		const parsed = parseBody(deleteFilesSchema, body);

		// Validate all paths before deletion
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
storageRouter.post("/:bucket/upload", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

		// Get content type from headers or form
		const contentType = c.req.header("Content-Type") || "application/octet-stream";

		// Best-effort early abort based on Content-Length header (can be spoofed)
		const contentLength = c.req.header("Content-Length");
		const maxSize = 50 * 1024 * 1024; // 50MB limit

		if (contentLength && Number.parseInt(contentLength, 10) > maxSize) {
			return c.json({ error: "File too large. Maximum size is 50MB" }, 400);
		}

		// Stream the body and enforce maxSize during streaming to prevent DoS attacks
		// Content-Length can be spoofed, so we must enforce the limit during read
		const bodyStream = c.req.raw.body;
		if (!bodyStream) {
			return c.json({ error: "No body provided" }, 400);
		}

		const chunks: Uint8Array[] = [];
		const reader = bodyStream.getReader();
		let byteCount = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				byteCount += value.length;
				if (byteCount > maxSize) {
					return c.json({ error: "File too large. Maximum size is 50MB" }, 413);
				}

				chunks.push(value);
			}
		} catch (error) {
			return c.json({ error: "Failed to read body" }, 400);
		}

		// Concatenate all chunks into a single buffer
		const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

		// Extract and validate path from query param or use default
		const pathInput = c.req.query("path") || `uploads/${Date.now()}-file`;
		const path = validatePath(pathInput);

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
storageRouter.get("/:bucket/:key{.+}", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

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
storageRouter.get("/:bucket/:key{.+}/public", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

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
storageRouter.post("/:bucket/:key{.+}/sign", async (c) => {
	try {
		const bucket = c.req.param("bucket");
		const keyInput = c.req.param("key");
		const key = validatePath(keyInput);
		validateBucket(bucket);

		if (!storage) {
			return c.json({ error: "Storage not configured" }, 503);
		}

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
