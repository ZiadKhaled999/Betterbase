/**
 * Storage Module - Fluent Builder API
 *
 * Provides a Supabase-compatible storage API with { data, error } response pattern
 * for easy migration. Supports S3, R2, Backblaze B2, MinIO backends.
 *
 * @example
 * ```typescript
 * const storage = createStorage(config);
 * const avatars = storage.from('avatars');
 *
 * const { data, error } = await avatars.upload('user123/profile.jpg', fileBuffer, {
 *   contentType: 'image/jpeg',
 * });
 * ```
 */

import { createS3Adapter } from "./s3-adapter";
import type {
	SignedUrlOptions,
	StorageAdapter,
	StorageConfig,
	StorageObject,
	StorageProvider,
	UploadOptions,
	UploadResult,
} from "./types";

// Re-export all types for external consumers
export type {
	StorageAdapter,
	StorageConfig,
	StorageProvider,
	UploadOptions,
	SignedUrlOptions,
	UploadResult,
	StorageObject,
	StoragePolicy,
} from "./types";
export { createS3Adapter } from "./s3-adapter";
export { checkStorageAccess, getPolicyDenialMessage } from "./policy-engine";

/**
 * Fluent API client bound to a specific bucket.
 * All async methods return `{ data, error }` for consistency with @betterbase/client.
 */
export interface BucketClient {
	upload(
		path: string,
		body: Buffer | ReadableStream,
		options?: UploadOptions,
	): Promise<{ data: UploadResult | null; error: Error | null }>;

	download(path: string): Promise<{ data: Buffer | null; error: Error | null }>;

	remove(paths: string[]): Promise<{ data: { message: string } | null; error: Error | null }>;

	getPublicUrl(path: string): string;

	createSignedUrl(
		path: string,
		options?: SignedUrlOptions,
	): Promise<{ data: { signedUrl: string } | null; error: Error | null }>;

	list(prefix?: string): Promise<{ data: StorageObject[] | null; error: Error | null }>;
}

/**
 * Main storage factory interface.
 * Use `from(bucket)` to get a BucketClient scoped to a specific bucket.
 */
export interface StorageFactory {
	from(bucket: string): BucketClient;
}

/**
 * Resolve the appropriate StorageAdapter based on the provider in config.
 *
 * @param config - Storage configuration with provider discriminator
 * @returns A StorageAdapter instance for the configured provider
 * @throws Error if provider is 'managed' (not yet available)
 */
export function resolveStorageAdapter(config: StorageConfig): StorageAdapter {
	if (config.provider === "managed") {
		throw new Error(
			"Managed storage provider is coming soon. Please use s3, r2, backblaze, or minio.",
		);
	}

	// All non-managed providers use the S3-compatible adapter
	return createS3Adapter(config);
}

/**
 * Internal BucketClient implementation that wraps a StorageAdapter
 * and binds all operations to a specific bucket name.
 */
class BucketClientImpl implements BucketClient {
	constructor(
		private readonly adapter: StorageAdapter,
		private readonly bucket: string,
	) {}

	async upload(
		path: string,
		body: Buffer | ReadableStream,
		options?: UploadOptions,
	): Promise<{ data: UploadResult | null; error: Error | null }> {
		try {
			const result = await this.adapter.upload(this.bucket, path, body, options);
			return { data: result, error: null };
		} catch (err) {
			return {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}

	async download(path: string): Promise<{ data: Buffer | null; error: Error | null }> {
		try {
			const result = await this.adapter.download(this.bucket, path);
			return { data: result, error: null };
		} catch (err) {
			return {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}

	async remove(
		paths: string[],
	): Promise<{ data: { message: string } | null; error: Error | null }> {
		try {
			await this.adapter.delete(this.bucket, paths);
			return {
				data: { message: `Successfully removed ${paths.length} file(s)` },
				error: null,
			};
		} catch (err) {
			return {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}

	getPublicUrl(path: string): string {
		return this.adapter.getPublicUrl(this.bucket, path);
	}

	async createSignedUrl(
		path: string,
		options?: SignedUrlOptions,
	): Promise<{ data: { signedUrl: string } | null; error: Error | null }> {
		try {
			const signedUrl = await this.adapter.createSignedUrl(this.bucket, path, options);
			return { data: { signedUrl }, error: null };
		} catch (err) {
			return {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}

	async list(prefix?: string): Promise<{ data: StorageObject[] | null; error: Error | null }> {
		try {
			const objects = await this.adapter.listObjects(this.bucket, prefix);
			return { data: objects, error: null };
		} catch (err) {
			return {
				data: null,
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}
}

/**
 * Storage class implementing the StorageFactory interface.
 * Wraps a StorageAdapter and provides fluent bucket access via `from()`.
 */
export class Storage implements StorageFactory {
	constructor(private readonly adapter: StorageAdapter) {}

	/**
	 * Get a BucketClient scoped to the specified bucket.
	 *
	 * @param bucket - The bucket name to scope operations to
	 * @returns A BucketClient bound to the given bucket
	 */
	from(bucket: string): BucketClient {
		return new BucketClientImpl(this.adapter, bucket);
	}
}

/**
 * Create a StorageFactory from a StorageConfig.
 *
 * Returns a factory with a fluent `.from(bucket)` API that mirrors
 * Supabase's storage interface for easy migration.
 *
 * @param config - Storage configuration (S3, R2, Backblaze, MinIO, or managed)
 * @returns A StorageFactory instance, or null if config is null/undefined
 *
 * @example
 * ```typescript
 * const storage = createStorage({
 *   provider: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   accessKeyId: 'AKIA...',
 *   secretAccessKey: 'secret',
 * });
 *
 * if (storage) {
 *   const { data, error } = await storage.from('avatars').upload('pic.jpg', buffer);
 * }
 * ```
 */
export function createStorage(config: StorageConfig | null | undefined): StorageFactory | null {
	if (!config) {
		return null;
	}

	const adapter = resolveStorageAdapter(config);
	return new Storage(adapter);
}
