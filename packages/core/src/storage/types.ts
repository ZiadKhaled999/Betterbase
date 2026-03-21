/**
 * Storage Types for S3-Compatible Storage Adapter
 *
 * Provides type definitions for the storage adapter layer that supports
 * AWS S3, Cloudflare R2, Backblaze B2, MinIO, and managed storage backends.
 */

/**
 * Supported storage providers
 */
export type StorageProvider = "s3" | "r2" | "backblaze" | "minio" | "managed";

/**
 * Options for file uploads
 */
export interface UploadOptions {
	contentType?: string;
	metadata?: Record<string, string>;
	isPublic?: boolean;
}

/**
 * Options for generating signed URLs
 */
export interface SignedUrlOptions {
	/** Expiration time in seconds, default 3600 (1 hour) */
	expiresIn?: number;
}

/**
 * Result of a successful upload operation
 */
export interface UploadResult {
	key: string;
	size: number;
	contentType?: string;
	etag?: string;
}

/**
 * Represents a storage object (file) in a bucket
 */
export interface StorageObject {
	key: string;
	size: number;
	lastModified: Date;
	contentType?: string;
}

/**
 * Allowed MIME types configuration for a bucket
 */
export interface AllowedMimeTypes {
	/** List of allowed MIME types (e.g., ['image/jpeg', 'image/png']) */
	allow?: string[];
	/** List of denied MIME types */
	deny?: string[];
	/** If true, only allow MIME types in the allow list */
	allowListOnly?: boolean;
}

/**
 * Bucket configuration options
 */
export interface BucketConfig {
	/** Maximum file size in bytes */
	maxFileSize?: number;
	/** Allowed MIME types configuration */
	allowedMimeTypes?: AllowedMimeTypes;
	/** Allowed file extensions (e.g., ['jpg', 'png']) */
	allowedExtensions?: string[];
}

/**
 * AWS S3 storage configuration
 */
export interface S3Config {
	provider: "s3";
	bucket: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
}

/**
 * Cloudflare R2 storage configuration
 */
export interface R2Config {
	provider: "r2";
	bucket: string;
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	/** Custom endpoint if needed */
	endpoint?: string;
}

/**
 * Backblaze B2 storage configuration
 */
export interface BackblazeConfig {
	provider: "backblaze";
	bucket: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint?: string;
}

/**
 * MinIO storage configuration
 */
export interface MinioConfig {
	provider: "minio";
	bucket: string;
	endpoint: string;
	port?: number;
	useSSL?: boolean;
	accessKeyId: string;
	secretAccessKey: string;
}

/**
 * Managed storage configuration (BetterBase hosted)
 */
export interface ManagedConfig {
	provider: "managed";
	bucket: string;
}

/**
 * Union of all storage configuration types
 */
export type StorageConfig = S3Config | R2Config | BackblazeConfig | MinioConfig | ManagedConfig;

/**
 * Storage policy for bucket operations
 * Similar to RLS policies but for storage operations
 */
export interface StoragePolicy {
	/** The bucket name this policy applies to */
	bucket: string;
	/** The operation this policy applies to */
	operation: "upload" | "download" | "list" | "delete" | "*";
	/** The policy expression to evaluate */
	expression: string;
}

/**
 * Helper function to create a StoragePolicy
 */
export function defineStoragePolicy(
	bucket: string,
	operation: StoragePolicy["operation"],
	expression: string,
): StoragePolicy {
	return { bucket, operation, expression };
}

/**
 * Core storage adapter interface for S3-compatible storage services
 *
 * This interface defines the contract for interacting with any S3-compatible
 * storage backend (AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.)
 */
export interface StorageAdapter {
	/**
	 * Upload a file to storage
	 * @param bucket - The bucket name
	 * @param key - The object key (path) within the bucket
	 * @param body - The file content as Buffer or ReadableStream
	 * @param options - Optional upload options
	 * @returns Promise resolving to upload result
	 */
	upload(
		bucket: string,
		key: string,
		body: Buffer | globalThis.ReadableStream,
		options?: UploadOptions,
	): Promise<UploadResult>;

	/**
	 * Download a file from storage
	 * @param bucket - The bucket name
	 * @param key - The object key (path) within the bucket
	 * @returns Promise resolving to file content as Buffer
	 */
	download(bucket: string, key: string): Promise<Buffer>;

	/**
	 * Delete one or more files from storage
	 * @param bucket - The bucket name
	 * @param keys - Array of object keys to delete
	 * @returns Promise resolving when deletion is complete
	 */
	delete(bucket: string, keys: string[]): Promise<void>;

	/**
	 * Get the public URL for a file (if publicly accessible)
	 * @param bucket - The bucket name
	 * @param key - The object key (path) within the bucket
	 * @returns The public URL string
	 */
	getPublicUrl(bucket: string, key: string): string;

	/**
	 * Generate a signed URL for temporary private access
	 * @param bucket - The bucket name
	 * @param key - The object key (path) within the bucket
	 * @param options - Optional signed URL options
	 * @returns Promise resolving to the signed URL
	 */
	createSignedUrl(bucket: string, key: string, options?: SignedUrlOptions): Promise<string>;

	/**
	 * List objects in a bucket with optional prefix filtering
	 * @param bucket - The bucket name
	 * @param prefix - Optional prefix to filter objects
	 * @returns Promise resolving to array of storage objects
	 */
	listObjects(bucket: string, prefix?: string): Promise<StorageObject[]>;

	/**
	 * Download a file with optional image transformations
	 * @param bucket - The bucket name
	 * @param key - The object key (path) within the bucket
	 * @param options - Optional transform options for image processing
	 * @returns Promise resolving to file content as Buffer (transformed if options provided)
	 */
	downloadWithTransform(
		bucket: string,
		key: string,
		options?: ImageTransformOptions,
	): Promise<Buffer>;
}

// IMAGE TRANSFORMATION TYPES

/**
 * Options for image transformations
 * All dimensions are validated: 1-4000 pixels
 */
export type ImageTransformOptions = {
	/** Output width in pixels (max: 4000) */
	width?: number;
	/** Output height in pixels (max: 4000) */
	height?: number;
	/** Output format (default: preserve original or webp) */
	format?: "webp" | "jpeg" | "png" | "avif";
	/** Quality 1-100 (default: 80) */
	quality?: number;
	/** Fit mode for resizing */
	fit?: "cover" | "contain" | "fill" | "inside" | "outside";
};

/**
 * Result of an image transformation
 */
export type TransformResult = {
	/** Transformed image buffer */
	buffer: Buffer;
	/** Output format (webp, jpeg, png, avif) */
	format: string;
	/** Size in bytes */
	size: number;
	/** Output width in pixels */
	width: number;
	/** Output height in pixels */
	height: number;
};

/**
 * Cache key for transformed images
 */
export type TransformCacheKey = {
	/** Original file path */
	path: string;
	/** MD5 hash of transform options */
	hash: string;
};

/**
 * Supported image MIME types that Sharp can process
 */
export const SUPPORTED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/tiff",
	"image/avif",
	"image/heif",
] as const;

/**
 * Check if a MIME type is supported for transformation
 */
export function isTransformableImage(contentType: string): boolean {
	return SUPPORTED_IMAGE_TYPES.includes(contentType as (typeof SUPPORTED_IMAGE_TYPES)[number]);
}
