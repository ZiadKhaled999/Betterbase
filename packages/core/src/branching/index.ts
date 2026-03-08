/**
 * Branching Module - Main Orchestration
 *
 * Provides the main interface for creating and managing preview environments.
 * Orchestrates database branching and storage branching together.
 */

import type { ProviderType, BetterBaseConfig } from "../config/schema";
import type { StorageConfig, StorageAdapter } from "../storage/types";
import { resolveStorageAdapter, createStorage } from "../storage";
import {
	DatabaseBranching,
	createDatabaseBranching,
	buildBranchConfig,
} from "./database";
import {
	StorageBranching,
	createStorageBranching,
} from "./storage";
import type {
	BranchConfig,
	BranchStatus,
	CreateBranchOptions,
	PreviewEnvironment,
	BranchOperationResult,
	BranchListResult,
	BranchingConfig,
} from "./types";
import { BranchStatus as BranchStatusEnum } from "./types";

/**
 * Default branching configuration
 */
const DEFAULT_BRANCHING_CONFIG: BranchingConfig = {
	enabled: true,
	maxPreviews: 10,
	defaultSleepTimeout: 3600, // 1 hour
	storageEnabled: true,
};

/**
 * In-memory store for branch configurations
 * In a real implementation, this would be stored in a database
 */
const branchStore = new Map<string, BranchConfig>();

/**
 * BranchManager - Main class for managing preview environments
 */
export class BranchManager {
	private databaseBranching: DatabaseBranching | null = null;
	private storageBranching: StorageBranching | null = null;
	private config: BranchingConfig;
	private mainBranch: string;

	/**
	 * Create a new BranchManager instance
	 * @param betterbaseConfig - The BetterBase configuration
	 */
	constructor(betterbaseConfig: BetterBaseConfig) {
		this.config = DEFAULT_BRANCHING_CONFIG;
		this.mainBranch = "main";

		// Initialize database branching if provider supports it
		if (betterbaseConfig.provider.connectionString) {
			this.databaseBranching = createDatabaseBranching(
				betterbaseConfig.provider.connectionString,
				betterbaseConfig.provider.type,
			);
		}

		// Initialize storage branching if configured
		if (betterbaseConfig.storage && this.config.storageEnabled) {
			try {
				const storageAdapter = resolveStorageAdapter(
					betterbaseConfig.storage as StorageConfig,
				);
				this.storageBranching = createStorageBranching(
					storageAdapter,
					betterbaseConfig.storage.bucket,
					betterbaseConfig.storage as StorageConfig,
				);
			} catch (error) {
				console.warn(
					"Failed to initialize storage branching:",
					error,
				);
			}
		}
	}

	/**
	 * Update the branching configuration
	 * @param config - New branching configuration
	 */
	setConfig(config: Partial<BranchingConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get the current branching configuration
	 * @returns Current branching configuration
	 */
	getConfig(): BranchingConfig {
		return this.config;
	}

	/**
	 * Set the main branch name
	 * @param branchName - Name of the main branch
	 */
	setMainBranch(branchName: string): void {
		this.mainBranch = branchName;
	}

	/**
	 * Get the main branch name
	 * @returns Main branch name
	 */
	getMainBranch(): string {
		return this.mainBranch;
	}

	/**
	 * Create a new preview environment
	 * @param options - Options for creating the preview
	 * @returns Result of the branch creation operation
	 */
	async createBranch(options: CreateBranchOptions): Promise<BranchOperationResult> {
		const warnings: string[] = [];
		const infos: string[] = [];

		// Check if branching is enabled
		if (!this.config.enabled) {
			return {
				success: false,
				error: "Branching is not enabled in the configuration",
			};
		}

		// Check max previews limit
		const currentCount = branchStore.size;
		if (currentCount >= this.config.maxPreviews) {
			return {
				success: false,
				error: `Maximum number of preview environments (${this.config.maxPreviews}) reached`,
			};
		}

		const branchName = options.name;
		const sourceBranch = options.sourceBranch || this.mainBranch;

		// Generate preview URL
		const previewUrl = this.generatePreviewUrl(branchName);

		// Create preview database if database branching is available
		let dbConnectionString: string | undefined;
		if (this.databaseBranching) {
			if (!this.databaseBranching.isBranchingSupported()) {
				// Database branching not supported for this provider - throw error
				throw new Error(
					"Database branching is not supported for the current database provider. " +
						"Please use a supported provider such as PostgreSQL or Neon.",
				);
			}
			// Provider supports branching, proceed with cloning
			try {
				const previewDb = await this.databaseBranching.cloneDatabase(
					branchName,
					options.copyDatabase ?? true,
				);
				dbConnectionString = previewDb.connectionString;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Database cloning failed: ${message}`,
				);
			}
		}

		// Create preview storage bucket if storage branching is available
		let storageBucket: string | undefined;
		if (this.storageBranching && options.copyStorage !== false) {
			try {
				const previewStorage =
					await this.storageBranching.createPreviewBucket(branchName);
				storageBucket = previewStorage.bucket;

				// Copy files from main bucket
				if (options.copyStorage === true) {
					const filesCopied = await this.storageBranching.copyFilesToPreview(
						previewStorage.bucket,
					);
					infos.push(`Copied ${filesCopied} files to preview storage`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				warnings.push(`Storage bucket creation failed: ${message}`);
				console.warn("Storage branching failed:", error);
			}
		}

		// Build branch configuration
		const branchConfig: BranchConfig = {
			id: `branch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			name: branchName,
			previewUrl,
			sourceBranch,
			createdAt: new Date(),
			lastAccessedAt: new Date(),
			status: BranchStatusEnum.ACTIVE,
			databaseConnectionString: dbConnectionString,
			storageBucket,
			sleepTimeout: options.sleepTimeout || this.config.defaultSleepTimeout,
			meta: options.meta,
		};

		// Store branch configuration
		branchStore.set(branchConfig.id, branchConfig);

		return {
			success: true,
			branch: branchConfig,
			warnings: warnings.length > 0 ? warnings : undefined,
			infos: infos.length > 0 ? infos : undefined,
		};
	}

	/**
	 * Get a branch by ID
	 * @param branchId - The branch ID
	 * @returns Branch configuration or undefined
	 */
	getBranch(branchId: string): BranchConfig | undefined {
		const branch = branchStore.get(branchId);
		if (branch) {
			// Update last accessed time
			branch.lastAccessedAt = new Date();
		}
		return branch;
	}

	/**
	 * Get a branch by name
	 * @param name - The branch name
	 * @returns Branch configuration or undefined
	 */
	getBranchByName(name: string): BranchConfig | undefined {
		for (const branch of branchStore.values()) {
			if (branch.name === name) {
				// Update last accessed time
				branch.lastAccessedAt = new Date();
				return branch;
			}
		}
		return undefined;
	}

	/**
	 * List all preview environments
	 * @param options - Options for listing branches
	 * @returns List of branches with pagination info
	 */
	listBranches(options?: {
		status?: BranchStatus;
		limit?: number;
		offset?: number;
	}): BranchListResult {
		let branches = Array.from(branchStore.values());

		// Filter by status if provided
		if (options?.status) {
			branches = branches.filter((b) => b.status === options.status);
		}

		// Sort by creation date (newest first)
		branches.sort(
			(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
		);

		// Apply pagination
		const limit = options?.limit || 50;
		const offset = options?.offset || 0;
		const paginatedBranches = branches.slice(offset, offset + limit);

		return {
			branches: paginatedBranches,
			total: branches.length,
			hasMore: offset + limit < branches.length,
		};
	}

	/**
	 * Delete a preview environment
	 * @param branchId - The branch ID to delete
	 * @returns Result of the delete operation
	 */
	async deleteBranch(branchId: string): Promise<BranchOperationResult> {
		const branch = branchStore.get(branchId);
		if (!branch) {
			return {
				success: false,
				error: `Branch '${branchId}' not found`,
			};
		}

		const warnings: string[] = [];

		// Teardown database if exists
		if (branch.databaseConnectionString && this.databaseBranching) {
			try {
				await this.databaseBranching.teardownPreviewDatabase(
					branch.databaseConnectionString,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				warnings.push(`Database teardown failed: ${message}`);
			}
		}

		// Teardown storage if exists
		if (branch.storageBucket && this.storageBranching) {
			try {
				await this.storageBranching.teardownPreviewStorage(branch.storageBucket);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				warnings.push(`Storage teardown failed: ${message}`);
			}
		}

		// Update status to deleted
		branch.status = BranchStatusEnum.DELETED;
		branchStore.delete(branchId);

		return {
			success: true,
			branch,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}

	/**
	 * Sleep (pause) a preview environment
	 * @param branchId - The branch ID to sleep
	 * @returns Result of the sleep operation
	 */
	async sleepBranch(branchId: string): Promise<BranchOperationResult> {
		const branch = branchStore.get(branchId);
		if (!branch) {
			return {
				success: false,
				error: `Branch '${branchId}' not found`,
			};
		}

		if (branch.status === BranchStatusEnum.SLEEPING) {
			return {
				success: false,
				error: `Branch '${branchId}' is already sleeping`,
			};
		}

		if (branch.status === BranchStatusEnum.DELETED) {
			return {
				success: false,
				error: `Branch '${branchId}' has been deleted`,
			};
		}

		// Mark as sleeping
		branch.status = BranchStatusEnum.SLEEPING;

		return {
			success: true,
			branch,
		};
	}

	/**
	 * Wake (resume) a preview environment
	 * @param branchId - The branch ID to wake
	 * @returns Result of the wake operation
	 */
	async wakeBranch(branchId: string): Promise<BranchOperationResult> {
		const branch = branchStore.get(branchId);
		if (!branch) {
			return {
				success: false,
				error: `Branch '${branchId}' not found`,
			};
		}

		if (branch.status === BranchStatusEnum.ACTIVE) {
			return {
				success: false,
				error: `Branch '${branchId}' is already active`,
			};
		}

		if (branch.status === BranchStatusEnum.DELETED) {
			return {
				success: false,
				error: `Branch '${branchId}' has been deleted and cannot be woken`,
			};
		}

		// Mark as active
		branch.status = BranchStatusEnum.ACTIVE;
		branch.lastAccessedAt = new Date();

		return {
			success: true,
			branch,
		};
	}

	/**
	 * Get full preview environment details
	 * @param branchId - The branch ID
	 * @returns Full preview environment details
	 */
	async getPreviewEnvironment(branchId: string): Promise<PreviewEnvironment | null> {
		const branch = this.getBranch(branchId);
		if (!branch) {
			return null;
		}

		return {
			id: branch.id,
			name: branch.name,
			previewUrl: branch.previewUrl,
			database: {
				connectionString: branch.databaseConnectionString || "",
				provider: "postgres" as ProviderType, // Would need to be stored in branch config
				database: "", // Would need to extract from connection string
			},
			storage: {
				bucket: branch.storageBucket || "",
				publicUrl: branch.storageBucket
					? this.storageBranching?.getPublicUrl(branch.storageBucket) || ""
					: "",
				initialized: !!branch.storageBucket,
			},
			meta: {
				createdAt: branch.createdAt,
				lastAccessedAt: branch.lastAccessedAt,
				status: branch.status,
				sourceBranch: branch.sourceBranch,
			},
		};
	}

	/**
	 * Generate a preview URL for a branch
	 * @param branchName - Name of the branch
	 * @returns Preview URL
	 */
	private generatePreviewUrl(branchName: string): string {
		const sanitized = branchName
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
		const timestamp = Date.now().toString(36);
		return `https://preview-${sanitized}-${timestamp}.preview.betterbase.app`;
	}
}

/**
 * Create a new BranchManager instance
 * @param config - BetterBase configuration
 * @returns A new BranchManager instance
 */
export function createBranchManager(config: BetterBaseConfig): BranchManager {
	return new BranchManager(config);
}

/**
 * Get all branches (for testing/development)
 * @returns Map of branch configurations
 */
export function getAllBranches(): Map<string, BranchConfig> {
	return new Map(branchStore);
}

/**
 * Clear all branches (for testing/development)
 */
export function clearAllBranches(): void {
	branchStore.clear();
}

// Re-export types
export type {
	BranchConfig,
	BranchStatus,
	CreateBranchOptions,
	PreviewEnvironment,
	BranchOperationResult,
	BranchListResult,
	BranchingConfig,
} from "./types";
