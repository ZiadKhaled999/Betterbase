/**
 * S3-Compatible Storage Adapter Implementation
 *
 * Provides storage adapter for AWS S3, Cloudflare R2, Backblaze B2, and MinIO
 * using AWS SDK v3.
 */

import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	type ObjectIdentifier,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ImageTransformer } from "./image-transformer";
import type {
	BackblazeConfig,
	ImageTransformOptions,
	MinioConfig,
	R2Config,
	S3Config,
	SignedUrlOptions,
	StorageAdapter,
	StorageConfig,
	StorageObject,
	UploadOptions,
	UploadResult,
} from "./types";

/**
 * S3StorageAdapter implements the StorageAdapter interface for S3-compatible storage services
 */
export class S3StorageAdapter implements StorageAdapter {
	private client: S3Client;
	private config: StorageConfig;
	private region: string;
	private transformer: ImageTransformer;

	constructor(config: StorageConfig) {
		this.config = config;
		this.region = this.getRegion(config);

		this.client = this.createClient(config);
		this.transformer = new ImageTransformer();
	}

	/**
	 * Get the region from config based on provider type
	 */
	private getRegion(config: StorageConfig): string {
		switch (config.provider) {
			case "s3":
				return (config as S3Config).region;
			case "r2":
				return "auto";
			case "backblaze":
				return (config as BackblazeConfig).region;
			case "minio":
				return "us-east-1"; // MinIO typically uses single region
			default:
				return "us-east-1";
		}
	}

	/**
	 * Create S3Client based on provider type
	 */
	private createClient(config: StorageConfig): S3Client {
		const commonOptions = {
			credentials: {
				accessKeyId: this.getAccessKeyId(config),
				secretAccessKey: this.getSecretAccessKey(config),
			},
		};

		switch (config.provider) {
			case "s3": {
				const s3Config = config as S3Config;
				return new S3Client({
					...commonOptions,
					region: s3Config.region,
				});
			}

			case "r2": {
				const r2Config = config as R2Config;
				const endpoint =
					r2Config.endpoint || `https://${r2Config.accountId}.r2.cloudflarestorage.com`;
				return new S3Client({
					...commonOptions,
					endpoint,
					region: "auto",
					forcePathStyle: false,
				});
			}

			case "backblaze": {
				const bzConfig = config as BackblazeConfig;
				return new S3Client({
					...commonOptions,
					region: bzConfig.region,
					endpoint: bzConfig.endpoint,
					forcePathStyle: false,
				});
			}

			case "minio": {
				const minioConfig = config as MinioConfig;
				const protocol = minioConfig.useSSL !== false ? "https" : "http";
				const endpoint = `${protocol}://${minioConfig.endpoint}:${minioConfig.port || (minioConfig.useSSL !== false ? 443 : 9000)}`;
				return new S3Client({
					...commonOptions,
					endpoint,
					region: "us-east-1",
					forcePathStyle: true,
				});
			}

			default:
				throw new Error(`Unsupported storage provider: ${(config as StorageConfig).provider}`);
		}
	}

	/**
	 * Get access key ID from config
	 */
	private getAccessKeyId(config: StorageConfig): string {
		switch (config.provider) {
			case "s3":
				return (config as S3Config).accessKeyId;
			case "r2":
				return (config as R2Config).accessKeyId;
			case "backblaze":
				return (config as BackblazeConfig).accessKeyId;
			case "minio":
				return (config as MinioConfig).accessKeyId;
			default:
				throw new Error(`Unsupported provider: ${config.provider}`);
		}
	}

	/**
	 * Get secret access key from config
	 */
	private getSecretAccessKey(config: StorageConfig): string {
		switch (config.provider) {
			case "s3":
				return (config as S3Config).secretAccessKey;
			case "r2":
				return (config as R2Config).secretAccessKey;
			case "backblaze":
				return (config as BackblazeConfig).secretAccessKey;
			case "minio":
				return (config as MinioConfig).secretAccessKey;
			default:
				throw new Error(`Unsupported provider: ${config.provider}`);
		}
	}

	/**
	 * Upload a file to storage
	 */
	async upload(
		bucket: string,
		key: string,
		body: Buffer | globalThis.ReadableStream,
		options?: UploadOptions,
	): Promise<UploadResult> {
		// Convert ReadableStream to Buffer if needed (for Bun runtime)
		let uploadBody: Buffer | Uint8Array;
		if (body instanceof globalThis.ReadableStream) {
			uploadBody = await this.streamToBuffer(body);
		} else {
			uploadBody = body;
		}

		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: uploadBody,
			ContentType: options?.contentType,
			Metadata: options?.metadata,
		});

		const response = await this.client.send(command);

		return {
			key,
			size: uploadBody.length,
			contentType: options?.contentType,
			etag: response.ETag,
		};
	}

	/**
	 * Convert ReadableStream to Buffer
	 */
	private async streamToBuffer(stream: globalThis.ReadableStream): Promise<Buffer> {
		const chunks: Uint8Array[] = [];
		const reader = stream.getReader();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}

		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}

		return Buffer.from(result);
	}

	/**
	 * Download a file from storage
	 */
	async download(bucket: string, key: string): Promise<Buffer> {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const response = await this.client.send(command);

		if (!response.Body) {
			throw new Error("Empty response body from S3");
		}

		// Convert the body to Buffer
		if (Buffer.isBuffer(response.Body)) {
			return response.Body;
		}

		// Handle ReadableStream body
		const uint8Array = await response.Body?.transformToByteArray();
		if (!uint8Array) throw new Error("Empty response body");
		return Buffer.from(uint8Array);
	}

	/**
	 * Delete one or more files from storage
	 */
	async delete(bucket: string, keys: string[]): Promise<void> {
		if (keys.length === 0) {
			return;
		}

		const objects: ObjectIdentifier[] = keys.map((key) => ({ Key: key }));

		const command = new DeleteObjectsCommand({
			Bucket: bucket,
			Delete: {
				Objects: objects,
				Quiet: true,
			},
		});

		await this.client.send(command);
	}

	/**
	 * Get the public URL for a file
	 */
	getPublicUrl(bucket: string, key: string): string {
		const encodedKey = encodeURIComponent(key);
		switch (this.config.provider) {
			case "s3": {
				const s3Config = this.config as S3Config;
				return `https://${bucket}.s3.${s3Config.region}.amazonaws.com/${encodedKey}`;
			}

			case "r2": {
				const r2Config = this.config as R2Config;
				if (r2Config.endpoint) {
					return `${r2Config.endpoint}/${bucket}/${encodedKey}`;
				}
				return `https://${bucket}.${r2Config.accountId}.r2.cloudflarestorage.com/${encodedKey}`;
			}

			case "backblaze": {
				const bzConfig = this.config as BackblazeConfig;
				return `https://${bucket}.s3.${bzConfig.region}.backblazeb2.com/${encodedKey}`;
			}

			case "minio": {
				const minioConfig = this.config as MinioConfig;
				const protocol = minioConfig.useSSL !== false ? "https" : "http";
				const port = minioConfig.port || (minioConfig.useSSL !== false ? 443 : 9000);
				return `${protocol}://${minioConfig.endpoint}:${port}/${bucket}/${encodedKey}`;
			}

			default:
				throw new Error(`Unsupported provider: ${this.config.provider}`);
		}
	}

	/**
	 * Generate a signed URL for temporary private access
	 */
	async createSignedUrl(bucket: string, key: string, options?: SignedUrlOptions): Promise<string> {
		const expiresIn = options?.expiresIn || 3600;

		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const url = await getSignedUrl(this.client, command, { expiresIn });
		return url;
	}

	/**
	 * Generate a signed URL for uploading a file
	 */
	async createUploadSignedUrl(
		bucket: string,
		key: string,
		options?: SignedUrlOptions,
	): Promise<string> {
		const expiresIn = options?.expiresIn || 3600;

		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const url = await getSignedUrl(this.client, command, { expiresIn });
		return url;
	}

	/**
	 * List objects in a bucket with optional prefix filtering
	 */
	async listObjects(bucket: string, prefix?: string): Promise<StorageObject[]> {
		const command = new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: prefix,
		});

		const response = await this.client.send(command);

		if (!response.Contents) {
			return [];
		}

		return response.Contents.map((item) => ({
			key: item.Key || "",
			size: item.Size || 0,
			lastModified: item.LastModified || new Date(),
			contentType: undefined,
		}));
	}

	/**
	 * Download a file with optional image transformations
	 *
	 * Architecture:
	 * 1. If no transform options → return original file
	 * 2. If transform options → check cache first
	 * 3. If cached → return cached version
	 * 4. If not cached → transform original, cache result, return
	 */
	async downloadWithTransform(
		bucket: string,
		key: string,
		options?: ImageTransformOptions,
	): Promise<Buffer> {
		// If no transform options, return original file
		if (!options || Object.keys(options).length === 0) {
			return this.download(bucket, key);
		}

		// Generate cache key and path
		const cacheKey = this.transformer.generateCacheKey(key, options);
		const cachePath = this.transformer.buildCachePath(cacheKey, options.format || "webp");

		// Check if cached version exists
		try {
			const cachedBuffer = await this.download(bucket, cachePath);
			// Return cached version if it exists
			return cachedBuffer;
		} catch {
			// Cache miss - proceed with transformation
		}

		// Download original file
		const originalBuffer = await this.download(bucket, key);

		// Transform the image
		const transformResult = await this.transformer.transform(originalBuffer, options);

		// Upload to cache
		const contentType = this.transformer.getContentType(transformResult.format);
		await this.upload(bucket, cachePath, transformResult.buffer, {
			contentType,
		});

		return transformResult.buffer;
	}
}

/**
 * Factory function to create an S3 storage adapter based on configuration
 */
export function createS3Adapter(config: StorageConfig): StorageAdapter {
	return new S3StorageAdapter(config);
}
