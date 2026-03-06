import { describe, it, expect, beforeAll, afterAll, vi } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
	Storage,
	createStorage,
	resolveStorageAdapter,
	BucketClient,
	type StorageFactory,
	type StorageConfig,
	type UploadOptions,
	type SignedUrlOptions,
	type UploadResult,
	type StorageObject,
} from "../src/storage/index"
import {
	type StorageProvider,
	type S3Config,
	type R2Config,
	type BackblazeConfig,
	type MinioConfig,
	type ManagedConfig,
	type StorageAdapter,
	type UploadOptions as StorageUploadOptions,
	type SignedUrlOptions as StorageSignedUrlOptions,
	type UploadResult as StorageUploadResult,
	type StorageObject as StorageStorageObject,
} from "../src/storage/types"

let tmpDir: string

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"))
})

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true })
})

describe("storage/types", () => {
	describe("StorageProvider type", () => {
		it("accepts 's3' as valid provider", () => {
			const provider: StorageProvider = "s3"
			expect(provider).toBe("s3")
		})

		it("accepts 'r2' as valid provider", () => {
			const provider: StorageProvider = "r2"
			expect(provider).toBe("r2")
		})

		it("accepts 'backblaze' as valid provider", () => {
			const provider: StorageProvider = "backblaze"
			expect(provider).toBe("backblaze")
		})

		it("accepts 'minio' as valid provider", () => {
			const provider: StorageProvider = "minio"
			expect(provider).toBe("minio")
		})

		it("accepts 'managed' as valid provider", () => {
			const provider: StorageProvider = "managed"
			expect(provider).toBe("managed")
		})
	})

	describe("S3Config", () => {
		it("validates valid S3 config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			}
			expect(config.provider).toBe("s3")
			expect(config.bucket).toBe("my-bucket")
		})
	})

	describe("R2Config", () => {
		it("validates R2 config with endpoint", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "my-account-id",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
				endpoint: "https://my-bucket.r2.cloudflarestorage.com",
			}
			expect(config.provider).toBe("r2")
			expect(config.accountId).toBe("my-account-id")
		})
	})

	describe("BackblazeConfig", () => {
		it("validates Backblaze config", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-000",
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
			}
			expect(config.provider).toBe("backblaze")
		})
	})

	describe("MinioConfig", () => {
		it("validates Minio config", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				port: 9000,
				useSSL: false,
				accessKeyId: "minioadmin",
				secretAccessKey: "minioadmin",
			}
			expect(config.provider).toBe("minio")
		})
	})

	describe("ManagedConfig", () => {
		it("validates managed config", () => {
			const config: ManagedConfig = {
				provider: "managed",
				bucket: "my-bucket",
			}
			expect(config.provider).toBe("managed")
		})
	})

	describe("UploadOptions", () => {
		it("validates upload options with contentType", () => {
			const options: UploadOptions = {
				contentType: "image/jpeg",
			}
			expect(options.contentType).toBe("image/jpeg")
		})

		it("validates upload options with metadata", () => {
			const options: UploadOptions = {
				metadata: {
					"x-custom-key": "custom-value",
				},
			}
			expect(options.metadata).toBeDefined()
		})

		it("validates upload options with isPublic", () => {
			const options: UploadOptions = {
				isPublic: true,
			}
			expect(options.isPublic).toBe(true)
		})
	})

	describe("SignedUrlOptions", () => {
		it("validates signed URL options", () => {
			const options: SignedUrlOptions = {
				expiresIn: 3600,
			}
			expect(options.expiresIn).toBe(3600)
		})
	})

	describe("UploadResult", () => {
		it("validates upload result", () => {
			const result: UploadResult = {
				key: "path/to/file.jpg",
				size: 1024,
				contentType: "image/jpeg",
				etag: "\"abc123\"",
			}
			expect(result.key).toBe("path/to/file.jpg")
			expect(result.size).toBe(1024)
		})
	})

	describe("StorageObject", () => {
		it("validates storage object", () => {
			const obj: StorageObject = {
				key: "path/to/file.jpg",
				size: 1024,
				lastModified: new Date("2024-01-01"),
				contentType: "image/jpeg",
			}
			expect(obj.key).toBe("path/to/file.jpg")
			expect(obj.lastModified).toBeInstanceOf(Date)
		})
	})
})

describe("storage/index", () => {
	describe("createStorage", () => {
		it("returns null for null config", () => {
			const storage = createStorage(null)
			expect(storage).toBeNull()
		})

		it("returns null for undefined config", () => {
			const storage = createStorage(undefined)
			expect(storage).toBeNull()
		})

		it("throws for managed provider", () => {
			const config: StorageConfig = {
				provider: "managed",
				bucket: "my-bucket",
			}
			expect(() => createStorage(config)).toThrow("Managed storage provider")
		})

		it("creates S3 storage factory", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const storage = createStorage(config)
			expect(storage).toBeInstanceOf(Storage)
		})
	})

	describe("resolveStorageAdapter", () => {
		it("throws for managed provider", () => {
			const config: ManagedConfig = {
				provider: "managed",
				bucket: "my-bucket",
			}
			expect(() => resolveStorageAdapter(config)).toThrow("Managed storage provider")
		})

		it("returns S3 adapter for S3 config", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const adapter = resolveStorageAdapter(config)
			expect(adapter).toBeDefined()
		})

		it("returns S3 adapter for R2 config", () => {
			const config: R2Config = {
				provider: "r2",
				bucket: "my-bucket",
				accountId: "test-account",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const adapter = resolveStorageAdapter(config)
			expect(adapter).toBeDefined()
		})

		it("returns S3 adapter for Backblaze config", () => {
			const config: BackblazeConfig = {
				provider: "backblaze",
				bucket: "my-bucket",
				region: "us-west-000",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const adapter = resolveStorageAdapter(config)
			expect(adapter).toBeDefined()
		})

		it("returns S3 adapter for Minio config", () => {
			const config: MinioConfig = {
				provider: "minio",
				bucket: "my-bucket",
				endpoint: "localhost",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const adapter = resolveStorageAdapter(config)
			expect(adapter).toBeDefined()
		})
	})
})

describe("Storage class", () => {
	describe("from method", () => {
		it("returns a BucketClient", () => {
			const config: S3Config = {
				provider: "s3",
				bucket: "my-bucket",
				region: "us-east-1",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			}
			const storage = createStorage(config) as StorageFactory
			const bucket = storage.from("avatars")
			expect(bucket).toBeDefined()
		})
	})
})

describe("BucketClient", () => {
	let storage: StorageFactory
	let adapter: StorageAdapter

	beforeAll(() => {
		const config: S3Config = {
			provider: "s3",
			bucket: "test-bucket",
			region: "us-east-1",
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
		}
		adapter = resolveStorageAdapter(config)
		storage = new Storage(adapter)
	})

	describe("upload", () => {
		it("returns data and error structure on success", async () => {
			// Mock the upload to avoid real S3 call
			const mockUpload = vi.fn().mockResolvedValue({
				key: "test/file.jpg",
				size: 100,
				contentType: "image/jpeg",
			})
			adapter.upload = mockUpload

			const bucket = storage.from("test-bucket")
			const result = await bucket.upload("test/file.jpg", Buffer.from("test"))

			expect(result).toHaveProperty("data")
			expect(result).toHaveProperty("error")
		})

		it("returns error on failure", async () => {
			const mockUpload = vi.fn().mockRejectedValue(new Error("Upload failed"))
			adapter.upload = mockUpload

			const bucket = storage.from("test-bucket")
			const result = await bucket.upload("test/file.jpg", Buffer.from("test"))

			expect(result.data).toBeNull()
			expect(result.error).toBeInstanceOf(Error)
		})
	})

	describe("download", () => {
		it("returns data and error structure", async () => {
			const mockDownload = vi.fn().mockResolvedValue(Buffer.from("test content"))
			adapter.download = mockDownload

			const bucket = storage.from("test-bucket")
			const result = await bucket.download("test/file.jpg")

			expect(result).toHaveProperty("data")
			expect(result).toHaveProperty("error")
		})
	})

	describe("remove", () => {
		it("returns success message", async () => {
			const mockDelete = vi.fn().mockResolvedValue(undefined)
			adapter.delete = mockDelete

			const bucket = storage.from("test-bucket")
			const result = await bucket.remove(["test/file.jpg"])

			expect(result.data).toHaveProperty("message")
			expect(result.error).toBeNull()
		})
	})

	describe("getPublicUrl", () => {
		it("returns public URL", () => {
			const bucket = storage.from("test-bucket")
			const url = bucket.getPublicUrl("test/file.jpg")
			expect(url).toContain("test-bucket")
		})
	})

	describe("createSignedUrl", () => {
		it("returns signed URL data and error structure", async () => {
			const mockSignedUrl = vi.fn().mockResolvedValue("https://signed.url")
			adapter.createSignedUrl = mockSignedUrl

			const bucket = storage.from("test-bucket")
			const result = await bucket.createSignedUrl("test/file.jpg")

			expect(result).toHaveProperty("data")
			expect(result).toHaveProperty("error")
		})
	})

	describe("list", () => {
		it("returns list of objects", async () => {
			const mockList = vi.fn().mockResolvedValue([
				{
					key: "test/file1.jpg",
					size: 100,
					lastModified: new Date(),
				},
			])
			adapter.listObjects = mockList

			const bucket = storage.from("test-bucket")
			const result = await bucket.list()

			expect(result).toHaveProperty("data")
			expect(result).toHaveProperty("error")
		})
	})
})

describe("S3Adapter URL generation", () => {
	it("generates correct S3 URL format", () => {
		const config: S3Config = {
			provider: "s3",
			bucket: "my-bucket",
			region: "us-east-1",
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
		}
		const adapter = resolveStorageAdapter(config)

		const url = adapter.getPublicUrl("my-bucket", "path/to/file.jpg")
		expect(url).toBe("https://my-bucket.s3.us-east-1.amazonaws.com/path/to/file.jpg")
	})

	it("generates correct R2 URL format", () => {
		const config: R2Config = {
			provider: "r2",
			bucket: "my-bucket",
			accountId: "my-account",
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
		}
		const adapter = resolveStorageAdapter(config)

		const url = adapter.getPublicUrl("my-bucket", "path/to/file.jpg")
		expect(url).toContain("my-bucket")
		expect(url).toContain("my-account")
	})

	it("generates correct Backblaze URL format", () => {
		const config: BackblazeConfig = {
			provider: "backblaze",
			bucket: "my-bucket",
			region: "us-west-000",
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
		}
		const adapter = resolveStorageAdapter(config)

		const url = adapter.getPublicUrl("my-bucket", "path/to/file.jpg")
		expect(url).toContain("my-bucket")
		expect(url).toContain("backblazeb2.com")
	})

	it("generates correct Minio URL format", () => {
		const config: MinioConfig = {
			provider: "minio",
			bucket: "my-bucket",
			endpoint: "localhost",
			port: 9000,
			useSSL: false,
			accessKeyId: "test-key",
			secretAccessKey: "test-secret",
		}
		const adapter = resolveStorageAdapter(config)

		const url = adapter.getPublicUrl("my-bucket", "path/to/file.jpg")
		expect(url).toContain("localhost:9000")
		expect(url).toContain("my-bucket")
	})
})
