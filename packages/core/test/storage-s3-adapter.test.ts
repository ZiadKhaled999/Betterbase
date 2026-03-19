import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createS3Adapter } from "../src/storage/s3-adapter";
import type { BackblazeConfig, MinioConfig, R2Config, S3Config } from "../src/storage/types";

describe("S3 Adapter", () => {
	describe("createS3Adapter - S3 Provider", () => {
		test("should create S3 adapter with valid S3 config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
			expect(typeof adapter.upload).toBe("function");
			expect(typeof adapter.download).toBe("function");
			expect(typeof adapter.delete).toBe("function");
			expect(typeof adapter.getPublicUrl).toBe("function");
			expect(typeof adapter.createSignedUrl).toBe("function");
			expect(typeof adapter.listObjects).toBe("function");
		});

		test("should return StorageAdapter interface", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			// Verify all interface methods exist
			expect("upload" in adapter).toBe(true);
			expect("download" in adapter).toBe(true);
			expect("delete" in adapter).toBe(true);
			expect("getPublicUrl" in adapter).toBe(true);
			expect("createSignedUrl" in adapter).toBe(true);
			expect("listObjects" in adapter).toBe(true);
		});
	});

	describe("S3 Adapter - Get Public URL", () => {
		test("should generate correct S3 public URL format", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "path/to/file.txt");

			expect(url).toBe("https://my-bucket.s3.us-east-1.amazonaws.com/path%2Fto%2Ffile.txt");
		});

		test("should handle different regions", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "eu-west-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://my-bucket.s3.eu-west-1.amazonaws.com/file.txt");
		});

		test("should handle west regions", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-west-2",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://my-bucket.s3.us-west-2.amazonaws.com/file.txt");
		});

		test("should handle nested paths", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "folder/subfolder/file.txt");

			expect(url).toContain("folder%2Fsubfolder%2Ffile.txt");
		});

		test("should handle special characters in path", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "path with spaces/file.txt");

			// URL-encode special characters in the path
			expect(url).toContain("path%20with%20spaces%2Ffile.txt");
		});
	});

	describe("R2 Provider", () => {
		test("should create R2 adapter", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
			expect(typeof adapter.getPublicUrl).toBe("function");
		});

		test("should generate correct R2 public URL", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toContain("abc123.r2.cloudflarestorage.com");
			expect(url).toContain("file.txt");
		});

		test("should use custom endpoint if provided", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
				endpoint: "https://custom.r2.cloudflarestorage.com",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://custom.r2.cloudflarestorage.com/my-bucket/file.txt");
		});
	});

	describe("Backblaze Provider", () => {
		test("should create Backblaze adapter", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-002",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});

		test("should generate correct Backblaze public URL", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-002",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://my-bucket.s3.us-west-002.backblazeb2.com/file.txt");
		});

		test("should handle different Backblaze regions", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "eu-central-003",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://my-bucket.s3.eu-central-003.backblazeb2.com/file.txt");
		});
	});

	describe("MinIO Provider", () => {
		test("should create MinIO adapter with default settings", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});

		test("should create MinIO adapter with custom port", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				port: 9000,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toContain("localhost:9000");
		});

		test("should generate correct MinIO public URL with SSL (default)", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				useSSL: true,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("https://localhost:443/my-bucket/file.txt");
		});

		test("should generate correct MinIO public URL without SSL", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				useSSL: false,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("http://localhost:9000/my-bucket/file.txt");
		});

		test("should use custom port without SSL", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				port: 9001,
				useSSL: false,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toBe("http://localhost:9001/my-bucket/file.txt");
		});

		test("should default to port 9000 without SSL", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				useSSL: false,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			};

			const adapter = createS3Adapter(config);
			const url = adapter.getPublicUrl("my-bucket", "file.txt");

			expect(url).toContain(":9000/");
		});
	});

	describe("Adapter Interface Compliance", () => {
		test("S3 adapter should have all required methods", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);

			// upload method
			expect(adapter.upload).toBeInstanceOf(Function);

			// download method
			expect(adapter.download).toBeInstanceOf(Function);

			// delete method
			expect(adapter.delete).toBeInstanceOf(Function);

			// getPublicUrl method
			expect(adapter.getPublicUrl).toBeInstanceOf(Function);

			// createSignedUrl method
			expect(adapter.createSignedUrl).toBeInstanceOf(Function);

			// listObjects method
			expect(adapter.listObjects).toBeInstanceOf(Function);
		});

		test("R2 adapter should have all required methods", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "abc123",
				accessKeyId: "key",
				secretAccessKey: "secret",
			};

			const adapter = createS3Adapter(config);

			expect(adapter.upload).toBeInstanceOf(Function);
			expect(adapter.download).toBeInstanceOf(Function);
			expect(adapter.delete).toBeInstanceOf(Function);
			expect(adapter.getPublicUrl).toBeInstanceOf(Function);
			expect(adapter.createSignedUrl).toBeInstanceOf(Function);
			expect(adapter.listObjects).toBeInstanceOf(Function);
		});
	});

	describe("Config validation", () => {
		test("should accept minimal S3 config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "b",
				region: "us-east-1",
				accessKeyId: "k",
				secretAccessKey: "s",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});

		test("should accept full R2 config with endpoint", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "b",
				accountId: "a",
				accessKeyId: "k",
				secretAccessKey: "s",
				endpoint: "https://custom.r2.cloudflarestorage.com",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});

		test("should accept full Backblaze config with endpoint", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "b",
				region: "us-west",
				accessKeyId: "k",
				secretAccessKey: "s",
				endpoint: "https://s3.us-west.backblazeb2.com",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});

		test("should accept full MinIO config", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "b",
				endpoint: "minio.example.com",
				port: 9000,
				useSSL: true,
				accessKeyId: "k",
				secretAccessKey: "s",
			};

			const adapter = createS3Adapter(config);
			expect(adapter).toBeDefined();
		});
	});
});
