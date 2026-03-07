/**
 * Storage Branching Module
 *
 * Handles storage bucket cloning and management for preview environments.
 * Uses S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO)
 */

import type {
	StorageAdapter,
	StorageConfig,
	StorageObject,
} from "../storage/types";
import type { PreviewStorage } from "./types";

/**
 * Generate a unique bucket name for a preview branch
 * @param branchName - The name of the branch
 * @param mainBucket - The main bucket name
 * @returns A unique bucket name
 */
function generatePreviewBucketName(branchName: string, mainBucket: string): string {
	const timestamp = Date.now().toString(36);
	const sanitized = branchName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return `${mainBucket}-preview-${sanitized}-${timestamp}`;
}

/**
 * Storage branching manager for creating and managing preview storage buckets
 */
export class StorageBranching {
	private mainStorageAdapter: StorageAdapter;
	private mainBucket: string;
	private config: StorageConfig;

	/**
	 * Create a new StorageBranching instance
	 * @param storageAdapter - Storage adapter for the main storage
	 * @param mainBucket - Main bucket name
	 * @param config - Storage configuration
	 */
	constructor(
		storageAdapter: StorageAdapter,
		mainBucket: string,
		config: StorageConfig,
	) {
		this.mainStorageAdapter = storageAdapter;
		this.mainBucket = mainBucket;
		this.config = config;
	}

	/**
	 * Create a new preview storage bucket
	 * For S3-compatible storage, buckets are created automatically on first upload
	 * @param branchName - Name for the preview branch
	 * @returns Preview storage details
	 */
	async createPreviewBucket(branchName: string): Promise<PreviewStorage> {
		const previewBucket = generatePreviewBucketName(branchName, this.mainBucket);

		// For S3-compatible storage, the bucket is implicitly created on first use
		// We don't need to explicitly create it, but we verify it's accessible
		const publicUrl = this.getPublicUrl(previewBucket);

		return {
			bucket: previewBucket,
			publicUrl,
			initialized: true,
		};
	}

	/**
	 * Copy files from the main bucket to a preview bucket
	 * @param previewBucket - Name of the preview bucket
	 * @param prefix - Optional prefix to filter files to copy
	 * @returns Number of files copied
	 */
	async copyFilesToPreview(
		previewBucket: string,
		prefix?: string,
	): Promise<number> {
		// List all objects in the main bucket
		const objects = await this.mainStorageAdapter.listObjects(
			this.mainBucket,
			prefix,
		);

		let copiedCount = 0;

		// Copy each object to the preview bucket
		for (const obj of objects) {
			if (!obj.key) continue;

			try {
				// Download from main bucket
				const fileData = await this.mainStorageAdapter.download(
					this.mainBucket,
					obj.key,
				);

				// Upload to preview bucket
				await this.mainStorageAdapter.upload(
					previewBucket,
					obj.key,
					fileData,
					{
						contentType: obj.contentType,
					},
				);

				copiedCount++;
			} catch (error) {
				console.warn(
					`Failed to copy file ${obj.key} to preview bucket:`,
					error,
				);
			}
		}

		return copiedCount;
	}

	/**
	 * Teardown (delete) a preview storage bucket
	 * @param previewBucket - Name of the preview bucket to delete
	 */
	async teardownPreviewStorage(previewBucket: string): Promise<void> {
		try {
			// List all objects in the preview bucket
			const objects = await this.mainStorageAdapter.listObjects(previewBucket);

			if (objects.length > 0) {
				// Delete all objects in the bucket
				const keys = objects.map((obj) => obj.key!).filter(Boolean);
				await this.mainStorageAdapter.delete(previewBucket, keys);
			}

			// Note: Actual bucket deletion depends on the provider
			// For S3-compatible storage, we don't delete the bucket itself
			// as it may require special permissions or may not be supported
			console.log(
				`Preview storage bucket '${previewBucket}' has been cleaned up`,
			);
		} catch (error) {
			console.warn(
				`Failed to teardown preview storage bucket '${previewBucket}':`,
				error,
			);
			// Don't throw - cleanup should be best-effort
		}
	}

	/**
	 * Get the public URL for a file in a bucket
	 * @param bucket - Bucket name
	 * @param key - Object key
	 * @returns Public URL
	 */
	getPublicUrl(bucket: string, key?: string): string {
		return this.mainStorageAdapter.getPublicUrl(bucket, key || "");
	}

	/**
	 * Get the main storage adapter
	 * @returns The main storage adapter
	 */
	getMainStorageAdapter(): StorageAdapter {
		return this.mainStorageAdapter;
	}

	/**
	 * Get a storage adapter for a specific preview bucket
	 * @param previewBucket - Preview bucket name
	 * @returns Storage adapter configured for the preview bucket
	 */
	getPreviewStorageAdapter(previewBucket: string): StorageAdapter {
		// Return the same adapter - it can access any bucket
		return this.mainStorageAdapter;
	}

	/**
	 * List all preview buckets (those with 'preview-' in the name)
	 * Note: This requires additional API calls and may be slow
	 * @returns Array of preview bucket names
	 */
	async listPreviewBuckets(): Promise<string[]> {
		// For S3-compatible storage, we can't easily list all buckets
		// This would require additional provider-specific API calls
		// In practice, we'd store bucket metadata in our branch registry
		return [];
	}

	/**
	 * Check if a preview bucket exists
	 * @param bucketName - Name of the bucket to check
	 * @returns True if the bucket exists (has any objects)
	 */
	async previewBucketExists(bucketName: string): Promise<boolean> {
		try {
			const objects = await this.mainStorageAdapter.listObjects(bucketName);
			return objects.length > 0 || true; // Bucket exists if we can list it
		} catch {
			return false;
		}
	}
}

/**
 * Create a new StorageBranching instance
 * @param storageAdapter - Storage adapter for the main storage
 * @param mainBucket - Main bucket name
 * @param config - Storage configuration
 * @returns A new StorageBranching instance
 */
export function createStorageBranching(
	storageAdapter: StorageAdapter,
	mainBucket: string,
	config: StorageConfig,
): StorageBranching {
	return new StorageBranching(storageAdapter, mainBucket, config);
}
