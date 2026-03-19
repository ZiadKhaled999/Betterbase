import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type BucketClient,
	Storage,
	type StorageFactory,
	createStorage,
	resolveStorageAdapter,
} from "../src/storage/index";
import type {
	BackblazeConfig,
	ManagedConfig,
	MinioConfig,
	R2Config,
	S3Config,
	StorageConfig,
} from "../src/storage/types";

describe("Storage Module", () => {
	describe("createStorage", () => {
		test("should return null for null config", () => {
			const result = createStorage(null);
			expect(result).toBeNull();
		});

		test("should return null for undefined config", () => {
			const result = createStorage(undefined);
			expect(result).toBeNull();
		});

		test("should return StorageFactory for valid S3 config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const result = createStorage(config);
			expect(result).not.toBeNull();
			expect(typeof result?.from).toBe("function");
		});

		test("should return StorageFactory for valid R2 config", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const result = createStorage(config);
			expect(result).not.toBeNull();
			expect(typeof result?.from).toBe("function");
		});

		test("should return StorageFactory for valid Backblaze config", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-002",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const result = createStorage(config);
			expect(result).not.toBeNull();
			expect(typeof result?.from).toBe("function");
		});

		test("should return StorageFactory for valid MinIO config", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const result = createStorage(config);
			expect(result).not.toBeNull();
			expect(typeof result?.from).toBe("function");
		});

		test("should throw error for managed provider", () => {
			const config: ManagedConfig = {
				provider: "managed",
				bucket: "my-bucket",
			};

			expect(() => createStorage(config)).toThrow(
				"Managed storage provider is coming soon. Please use s3, r2, backblaze, or minio.",
			);
		});
	});

	describe("StorageFactory.from()", () => {
		test("should return BucketClient with from() method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config);
			expect(storage).not.toBeNull();

			const bucket = storage!.from("avatars");
			expect(bucket).toBeDefined();
		});

		test("should return BucketClient with all required methods", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("avatars");

			expect(typeof bucket.upload).toBe("function");
			expect(typeof bucket.download).toBe("function");
			expect(typeof bucket.remove).toBe("function");
			expect(typeof bucket.getPublicUrl).toBe("function");
			expect(typeof bucket.createSignedUrl).toBe("function");
			expect(typeof bucket.list).toBe("function");
		});
	});

	describe("resolveStorageAdapter", () => {
		test("should resolve S3 adapter for s3 provider", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = resolveStorageAdapter(config);
			expect(adapter).toBeDefined();
			expect(typeof adapter.upload).toBe("function");
		});

		test("should resolve adapter for R2 provider", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = resolveStorageAdapter(config);
			expect(adapter).toBeDefined();
		});

		test("should throw error for managed provider", () => {
			const config: ManagedConfig = {
				provider: "managed",
				bucket: "my-bucket",
			};

			expect(() => resolveStorageAdapter(config)).toThrow(
				"Managed storage provider is coming soon",
			);
		});
	});

	describe("Storage class", () => {
		test("should create Storage instance with adapter", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = resolveStorageAdapter(config);
			const storage = new Storage(adapter);

			expect(storage).toBeDefined();
			expect(typeof storage.from).toBe("function");
		});

		test("should return BucketClient from from()", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = resolveStorageAdapter(config);
			const storage = new Storage(adapter);
			const bucket = storage.from("test-bucket");

			expect(bucket).toBeDefined();
		});
	});

	describe("BucketClient operations", () => {
		test("BucketClient should have upload method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("avatars");

			expect(bucket.upload).toBeInstanceOf(Function);
		});

		test("BucketClient should have download method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("files");

			expect(bucket.download).toBeInstanceOf(Function);
		});

		test("BucketClient should have remove method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("files");

			expect(bucket.remove).toBeInstanceOf(Function);
		});

		test("BucketClient should have getPublicUrl method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("files");

			expect(bucket.getPublicUrl).toBeInstanceOf(Function);
		});

		test("BucketClient should have createSignedUrl method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("files");

			expect(bucket.createSignedUrl).toBeInstanceOf(Function);
		});

		test("BucketClient should have list method", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("files");

			expect(bucket.list).toBeInstanceOf(Function);
		});
	});

	describe("Type exports", () => {
		test("should export StorageConfig type", () => {
			const configs: StorageConfig[] = [
				{
					provider: "s3",
					bucket: "b",
					region: "us-east-1",
					accessKeyId: "k",
					secretAccessKey: "s",
				},
				{ provider: "r2", bucket: "b", accountId: "a", accessKeyId: "k", secretAccessKey: "s" },
				{
					provider: "backblaze",
					bucket: "b",
					region: "us-west",
					accessKeyId: "k",
					secretAccessKey: "s",
				},
				{
					provider: "minio",
					bucket: "b",
					endpoint: "localhost",
					accessKeyId: "k",
					secretAccessKey: "s",
				},
				{ provider: "managed", bucket: "b" },
			];
			expect(configs.length).toBe(5);
		});

		test("should export StorageFactory interface", () => {
			// Just verify the type is available
			type TestFactory = StorageFactory;
			expect(true).toBe(true);
		});

		test("should export BucketClient interface", () => {
			// Just verify the type is available
			type TestClient = BucketClient;
			expect(true).toBe(true);
		});
	});

	describe("Multiple buckets", () => {
		test("should create multiple bucket clients from same storage", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;

			const avatars = storage.from("avatars");
			const files = storage.from("files");
			const images = storage.from("images");

			expect(avatars).toBeDefined();
			expect(files).toBeDefined();
			expect(images).toBeDefined();

			// Each should be a different client instance
			expect(avatars).not.toBe(files);
			expect(files).not.toBe(images);
		});
	});

	describe("Edge cases", () => {
		test("should handle empty bucket name", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("");

			expect(bucket).toBeDefined();
		});

		test("should handle bucket name with special characters", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const storage = createStorage(config)!;
			const bucket = storage.from("my-bucket-123");

			expect(bucket).toBeDefined();
		});
	});
});
