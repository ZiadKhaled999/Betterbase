/**
 * Branching/Preview Environment Types
 *
 * Defines types for creating isolated development environments (preview environments)
 * similar to Vercel's preview deployments or Supabase's database branching.
 */

import type { ProviderType } from "@betterbase/shared";
import type { StorageConfig } from "../storage/types";

/**
 * Status of a preview environment
 */
export enum BranchStatus {
	/** Environment is actively running and accessible */
	ACTIVE = "active",
	/** Environment is paused (sleeping) to save resources */
	SLEEPING = "sleeping",
	/** Environment has been deleted */
	DELETED = "deleted",
}

/**
 * Configuration for a specific preview environment branch
 */
export interface BranchConfig {
	/** Unique identifier for the branch */
	id: string;
	/** Human-readable name of the branch */
	name: string;
	/** Full preview URL for accessing the environment */
	previewUrl: string;
	/** Source branch that this preview is based on */
	sourceBranch: string;
	/** Timestamp when the branch was created */
	createdAt: Date;
	/** Timestamp when the branch was last accessed */
	lastAccessedAt: Date;
	/** Current status of the branch */
	status: BranchStatus;
	/** Database connection string for the preview DB */
	databaseConnectionString?: string;
	/** Preview storage bucket name */
	storageBucket?: string;
	/** Custom sleep timeout in seconds (overrides default) */
	sleepTimeout?: number;
	/** Metadata about the preview environment */
	meta?: Record<string, unknown>;
}

/**
 * Options for creating a new preview environment
 */
export interface CreateBranchOptions {
	/** Name for the preview environment (will be slugified) */
	name: string;
	/** Source branch to base the preview on (default: main) */
	sourceBranch?: string;
	/** Custom sleep timeout in seconds */
	sleepTimeout?: number;
	/** Whether to copy storage data from source (default: true) */
	copyStorage?: boolean;
	/** Whether to copy database data from source (default: true) */
	copyDatabase?: boolean;
	/** Additional metadata to store with the branch */
	meta?: Record<string, unknown>;
}

/**
 * Preview environment with full connection details
 */
export interface PreviewEnvironment {
	/** Unique identifier */
	id: string;
	/** Environment name */
	name: string;
	/** Preview URL */
	previewUrl: string;
	/** Database connection for the preview */
	database: PreviewDatabase;
	/** Storage configuration for the preview */
	storage: PreviewStorage;
	/** Environment metadata */
	meta: PreviewMeta;
}

/**
 * Database connection details for a preview environment
 */
export interface PreviewDatabase {
	/** Connection string for the preview database */
	connectionString: string;
	/** The provider type (postgres, neon, etc.) */
	provider: ProviderType;
	/** Database name */
	database: string;
}

/**
 * Storage details for a preview environment
 */
export interface PreviewStorage {
	/** Bucket name for preview storage */
	bucket: string;
	/** Base URL for accessing preview storage */
	publicUrl: string;
	/** Whether storage has been initialized */
	initialized: boolean;
}

/**
 * Metadata for a preview environment
 */
export interface PreviewMeta {
	/** When the preview was created */
	createdAt: Date;
	/** When the preview was last accessed */
	lastAccessedAt: Date;
	/** Current status */
	status: BranchStatus;
	/** Source branch name */
	sourceBranch: string;
	/** Additional metadata */
	custom?: Record<string, unknown>;
}

/**
 * Configuration for branching/preview features
 */
export interface BranchingConfig {
	/** Whether branching is enabled */
	enabled: boolean;
	/** Maximum number of preview environments allowed */
	maxPreviews: number;
	/** Default sleep timeout in seconds (default: 3600 = 1 hour) */
	defaultSleepTimeout: number;
	/** Whether storage branching is enabled */
	storageEnabled: boolean;
}

/**
 * Branch metadata stored in the system database
 */
export interface BranchMetadata {
	/** Unique branch ID */
	id: string;
	/** Branch name (slugified) */
	slug: string;
	/** Display name */
	displayName: string;
	/** Source branch */
	sourceBranch: string;
	/** Preview URL */
	previewUrl: string;
	/** Database connection string (encrypted in production) */
	dbConnectionString: string;
	/** Storage bucket name */
	storageBucket: string;
	/** Current status */
	status: BranchStatus;
	/** Creation timestamp */
	createdAt: string;
	/** Last accessed timestamp */
	lastAccessedAt: string;
	/** Sleep timeout in seconds */
	sleepTimeout: number;
	/** JSON metadata */
	meta: string;
}

/**
 * Result of a branch operation
 */
export interface BranchOperationResult {
	/** Whether the operation was successful */
	success: boolean;
	/** The created/updated branch config */
	branch?: BranchConfig;
	/** Error message if failed */
	error?: string;
	/** Any warnings during the operation */
	warnings?: string[];
	/** Informational messages during the operation */
	infos?: string[];
}

/**
 * List of preview environments with pagination
 */
export interface BranchListResult {
	/** Array of branch configurations */
	branches: BranchConfig[];
	/** Total number of branches */
	total: number;
	/** Whether there are more branches */
	hasMore: boolean;
}
