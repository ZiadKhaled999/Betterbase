import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
	type StorageProvider,
	type StorageConfig,
	type UploadOptions,
	type SignedUrlOptions,
	type UploadResult,
	type StorageObject,
	type AllowedMimeTypes,
	type BucketConfig,
	type StoragePolicy,
	type S3Config,
	type R2Config,
	type BackblazeConfig,
	type MinioConfig,
	type ManagedConfig,
	defineStoragePolicy,
} from "../src/storage/types";

describe("Storage Types", () => {
	describe("StorageProvider", () => {
		test("should allow 's3' as valid provider", () => {
			const provider: StorageProvider = "s3";
			expect(provider).toBe("s3");
		});

		test("should allow 'r2' as valid provider", () => {
			const provider: StorageProvider = "r2";
			expect(provider).toBe("r2");
		});

		test("should allow 'backblaze' as valid provider", () => {
			const provider: StorageProvider = "backblaze";
			expect(provider).toBe("backblaze");
		});

		test("should allow 'minio' as valid provider", () => {
			const provider: StorageProvider = "minio";
			expect(provider).toBe("minio");
		});

		test("should allow 'managed' as valid provider", () => {
			const provider: StorageProvider = "managed";
			expect(provider).toBe("managed");
		});
	});

	describe("UploadOptions", () => {
		test("should allow optional contentType", () => {
			const options: UploadOptions = {
				contentType: "image/jpeg",
			};
			expect(options.contentType).toBe("image/jpeg");
		});

		test("should allow optional metadata", () => {
			const options: UploadOptions = {
				metadata: { userId: "user-123" },
			};
			expect(options.metadata).toEqual({ userId: "user-123" });
		});

		test("should allow optional isPublic flag", () => {
			const options: UploadOptions = {
				isPublic: true,
			};
			expect(options.isPublic).toBe(true);
		});

		test("should allow empty options", () => {
			const options: UploadOptions = {};
			expect(options).toEqual({});
		});
	});

	describe("SignedUrlOptions", () => {
		test("should allow optional expiresIn", () => {
			const options: SignedUrlOptions = {
				expiresIn: 3600,
			};
			expect(options.expiresIn).toBe(3600);
		});

		test("should allow empty options", () => {
			const options: SignedUrlOptions = {};
			expect(options).toEqual({});
		});
	});

	describe("UploadResult", () => {
		test("should have required key and size properties", () => {
			const result: UploadResult = {
				key: "path/to/file.jpg",
				size: 1024,
			};
			expect(result.key).toBe("path/to/file.jpg");
			expect(result.size).toBe(1024);
		});

		test("should allow optional contentType and etag", () => {
			const result: UploadResult = {
				key: "path/to/file.jpg",
				size: 1024,
				contentType: "image/jpeg",
				etag: "\"abc123\"",
			};
			expect(result.contentType).toBe("image/jpeg");
			expect(result.etag).toBe("\"abc123\"");
		});
	});

	describe("StorageObject", () => {
		test("should have required properties", () => {
			const obj: StorageObject = {
				key: "path/to/file.jpg",
				size: 1024,
				lastModified: new Date("2024-01-01"),
			};
			expect(obj.key).toBe("path/to/file.jpg");
			expect(obj.size).toBe(1024);
			expect(obj.lastModified).toEqual(new Date("2024-01-01"));
		});

		test("should allow optional contentType", () => {
			const obj: StorageObject = {
				key: "path/to/file.jpg",
				size: 1024,
				lastModified: new Date(),
				contentType: "image/jpeg",
			};
			expect(obj.contentType).toBe("image/jpeg");
		});
	});

	describe("AllowedMimeTypes", () => {
		test("should allow only allow list", () => {
			const mimeTypes: AllowedMimeTypes = {
				allow: ["image/jpeg", "image/png"],
			};
			expect(mimeTypes.allow).toEqual(["image/jpeg", "image/png"]);
		});

		test("should allow deny list", () => {
			const mimeTypes: AllowedMimeTypes = {
				deny: ["application/octet-stream"],
			};
			expect(mimeTypes.deny).toEqual(["application/octet-stream"]);
		});

		test("should allow allowListOnly flag", () => {
			const mimeTypes: AllowedMimeTypes = {
				allow: ["image/jpeg"],
				allowListOnly: true,
			};
			expect(mimeTypes.allowListOnly).toBe(true);
		});
	});

	describe("BucketConfig", () => {
		test("should allow maxFileSize", () => {
			const config: BucketConfig = {
				maxFileSize: 10 * 1024 * 1024, // 10MB
			};
			expect(config.maxFileSize).toBe(10 * 1024 * 1024);
		});

		test("should allow allowedMimeTypes", () => {
			const config: BucketConfig = {
				allowedMimeTypes: { allow: ["image/*"] },
			};
			expect(config.allowedMimeTypes?.allow).toEqual(["image/*"]);
		});

		test("should allow allowedExtensions", () => {
			const config: BucketConfig = {
				allowedExtensions: ["jpg", "png", "gif"],
			};
			expect(config.allowedExtensions).toEqual(["jpg", "png", "gif"]);
		});

		test("should allow empty config", () => {
			const config: BucketConfig = {};
			expect(config).toEqual({});
		});
	});

	describe("defineStoragePolicy", () => {
		test("should create storage policy with bucket, operation, and expression", () => {
			const policy = defineStoragePolicy("avatars", "upload", "auth.uid() = path.split('/')[1]");
			expect(policy.bucket).toBe("avatars");
			expect(policy.operation).toBe("upload");
			expect(policy.expression).toBe("auth.uid() = path.split('/')[1]");
		});

		test("should create policy with wildcard operation", () => {
			const policy = defineStoragePolicy("public-files", "*", "true");
			expect(policy.bucket).toBe("public-files");
			expect(policy.operation).toBe("*");
			expect(policy.expression).toBe("true");
		});

		test("should create policy with different operations", () => {
			const uploadPolicy = defineStoragePolicy("files", "upload", "true");
			const downloadPolicy = defineStoragePolicy("files", "download", "true");
			const listPolicy = defineStoragePolicy("files", "list", "true");
			const deletePolicy = defineStoragePolicy("files", "delete", "true");

			expect(uploadPolicy.operation).toBe("upload");
			expect(downloadPolicy.operation).toBe("download");
			expect(listPolicy.operation).toBe("list");
			expect(deletePolicy.operation).toBe("delete");
		});
	});

	describe("StorageConfig types", () => {
		test("should validate S3Config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			};
			expect(config.provider).toBe("s3");
			expect(config.bucket).toBe("my-bucket");
		});

		test("should validate R2Config", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key123",
				secretAccessKey: "secret123",
			};
			expect(config.provider).toBe("r2");
			expect(config.accountId).toBe("abc123");
		});

		test("should validate R2Config with custom endpoint", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key123",
				secretAccessKey: "secret123",
				endpoint: "https://custom.r2.cloudflarestorage.com",
			};
			expect(config.endpoint).toBe("https://custom.r2.cloudflarestorage.com");
		});

		test("should validate BackblazeConfig", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-002",
				accessKeyId: "key123",
				secretAccessKey: "secret123",
			};
			expect(config.provider).toBe("backblaze");
			expect(config.region).toBe("us-west-002");
		});

		test("should validate BackblazeConfig with custom endpoint", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-002",
				accessKeyId: "key123",
				secretAccessKey: "secret123",
				endpoint: "https://s3.us-west-002.backblazeb2.com",
			};
			expect(config.endpoint).toBe("https://s3.us-west-002.backblazeb2.com");
		});

		test("should validate MinioConfig", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};
			expect(config.provider).toBe("minio");
			expect(config.endpoint).toBe("localhost");
		});

		test("should validate MinioConfig with full options", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				port: 9000,
				useSSL: false,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};
			expect(config.port).toBe(9000);
			expect(config.useSSL).toBe(false);
		});

		test("should validate ManagedConfig", () => {
			const config: ManagedConfig = {
				provider: "managed",
				bucket: "my-bucket",
			};
			expect(config.provider).toBe("managed");
			expect(config.bucket).toBe("my-bucket");
		});

		test("should validate StorageConfig union type", () => {
			// Test that all config types are assignable to StorageConfig
			const configs: StorageConfig[] = [
				{ provider: "s3", bucket: "b", region: "us-east-1", accessKeyId: "k", secretAccessKey: "s" },
				{ provider: "r2", bucket: "b", accountId: "a", accessKeyId: "k", secretAccessKey: "s" },
				{ provider: "backblaze", bucket: "b", region: "us-west", accessKeyId: "k", secretAccessKey: "s" },
				{ provider: "minio", bucket: "b", endpoint: "localhost", accessKeyId: "k", secretAccessKey: "s" },
				{ provider: "managed", bucket: "b" },
			];
			expect(configs.length).toBe(5);
		});
	});
});
