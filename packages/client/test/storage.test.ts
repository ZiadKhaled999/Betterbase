import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NetworkError } from "../src/errors";
import { Storage, StorageBucketClient } from "../src/storage";

let tmpDir: string;

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"));
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
	mock.restore();
});

// Create a mock BetterBaseClient for testing
function createMockClient(responses: {
	upload?: { path: string; url: string };
	download?: string;
	publicUrl?: string;
	signedUrl?: string;
	remove?: string;
	list?: { files: Array<{ name: string; size: number; lastModified: string }> };
}): { getUrl: () => string; fetch: typeof fetch } {
	const mockFetch = mock(
		async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = typeof input === "string" ? input : input.toString();

			if (url.includes("/upload") && init?.method === "POST") {
				if (responses.upload) {
					return new Response(JSON.stringify(responses.upload), { status: 200 });
				}
				return new Response(
					JSON.stringify({ path: "test.txt", url: "https://example.com/test.txt" }),
					{ status: 200 },
				);
			}

			if (url.includes("/public") && init?.method === "GET") {
				return new Response(
					JSON.stringify({ publicUrl: responses.publicUrl ?? "https://example.com/public.txt" }),
					{ status: 200 },
				);
			}

			if (url.includes("/sign") && init?.method === "POST") {
				return new Response(
					JSON.stringify({
						signedUrl: responses.signedUrl ?? "https://example.com/signed.txt?sig=abc",
					}),
					{ status: 200 },
				);
			}

			if (init?.method === "DELETE") {
				return new Response(JSON.stringify({ message: responses.remove ?? "Files removed" }), {
					status: 200,
				});
			}

			if (init?.method === "GET") {
				return new Response(JSON.stringify(responses.list ?? { files: [] }), { status: 200 });
			}

			return new Response("Not Found", { status: 404 });
		},
	);

	return {
		getUrl: () => "http://localhost:3000",
		fetch: mockFetch,
	};
}

describe("Storage", () => {
	describe("constructor", () => {
		it("creates Storage instance", () => {
			const mockClient = createMockClient({});
			const storage = new Storage(mockClient as any);
			expect(storage).toBeDefined();
		});
	});

	describe("from", () => {
		it("returns StorageBucketClient for specified bucket", () => {
			const mockClient = createMockClient({});
			const storage = new Storage(mockClient as any);
			const bucketClient = storage.from("my-bucket");

			expect(bucketClient).toBeInstanceOf(StorageBucketClient);
		});

		it("creates bucket client with different bucket names", () => {
			const mockClient = createMockClient({});
			const storage = new Storage(mockClient as any);

			const bucket1 = storage.from("bucket-one");
			const bucket2 = storage.from("bucket-two");

			expect(bucket1).toBeDefined();
			expect(bucket2).toBeDefined();
		});
	});
});

describe("StorageBucketClient", () => {
	describe("upload", () => {
		it("uploads file successfully and returns path and url", async () => {
			const testFilePath = path.join(tmpDir, "test-upload.txt");
			writeFileSync(testFilePath, "Hello World");
			const fileContent = readFileSync(testFilePath);

			const mockClient = createMockClient({
				upload: {
					path: "test-upload.txt",
					url: "https://storage.example.com/test-bucket/test-upload.txt",
				},
			});

			const client = new StorageBucketClient(mockClient as any, "test-bucket");
			const result = await client.upload("test-upload.txt", fileContent.buffer);

			expect(result.error).toBeNull();
			expect(result.data).toBeDefined();
			expect(result.data?.path).toBe("test-upload.txt");
			expect(result.data?.url).toBe("https://storage.example.com/test-bucket/test-upload.txt");
		});

		it("uploads with custom content type", async () => {
			const content = new ArrayBuffer(10);

			const mockClient = createMockClient({
				upload: { path: "image.png", url: "https://example.com/image.png" },
			});

			const client = new StorageBucketClient(mockClient as any, "test-bucket");
			const result = await client.upload("image.png", content, { contentType: "image/png" });

			expect(result.error).toBeNull();
			expect(result.data?.path).toBe("image.png");
		});

		it("uploads with metadata headers", async () => {
			const content = new ArrayBuffer(10);

			const mockClient = createMockClient({
				upload: { path: "doc.txt", url: "https://example.com/doc.txt" },
			});

			const client = new StorageBucketClient(mockClient as any, "test-bucket");
			const result = await client.upload("doc.txt", content, {
				metadata: {
					author: "test-author",
					version: "1.0",
				},
			});

			expect(result.error).toBeNull();
			expect(result.data?.path).toBe("doc.txt");
		});

		it("returns error when upload fails with non-ok response", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "Upload failed - file too large" }), {
					status: 413,
				});
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.upload("large.txt", new ArrayBuffer(10000000));

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Network connection failed");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.upload("test.txt", new ArrayBuffer(10));

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("download", () => {
		it("downloads file successfully and returns Blob", async () => {
			const testContent = "Hello Download World";
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(testContent, {
					status: 200,
					headers: { "Content-Type": "text/plain" },
				});
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.download("test-file.txt");

			expect(result.error).toBeNull();
			expect(result.data).toBeInstanceOf(Blob);
		});

		it("returns error when download fails with non-ok response", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "File not found" }), { status: 404 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.download("nonexistent.txt");

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Connection timeout");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.download("test.txt");

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("getPublicUrl", () => {
		it("returns public URL successfully", async () => {
			const mockClient = createMockClient({
				publicUrl: "https://cdn.example.com/bucket/file.txt",
			});

			const client = new StorageBucketClient(mockClient as any, "test-bucket");
			const result = await client.getPublicUrl("file.txt");

			expect(result.error).toBeNull();
			expect(result.data?.publicUrl).toBe("https://cdn.example.com/bucket/file.txt");
		});

		it("returns error when getting public URL fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "Bucket is private" }), { status: 403 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.getPublicUrl("private.txt");

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Network unavailable");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.getPublicUrl("test.txt");

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("createSignedUrl", () => {
		it("creates signed URL without options", async () => {
			const mockClient = createMockClient({
				signedUrl: "https://storage.example.com/file.txt?expires=3600&signature=abc123",
			});

			const client = new StorageBucketClient(mockClient as any, "test-bucket");
			const result = await client.createSignedUrl("file.txt");

			expect(result.error).toBeNull();
			expect(result.data?.signedUrl).toContain("signature=");
		});

		it("creates signed URL with expiresIn option", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					const url = typeof input === "string" ? input : input.toString();
					expect(url).toContain("expiresIn=7200");
					return new Response(
						JSON.stringify({
							signedUrl: "https://storage.example.com/file.txt?expires=7200&signature=xyz789",
						}),
						{ status: 200 },
					);
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.createSignedUrl("file.txt", { expiresIn: 7200 });

			expect(result.error).toBeNull();
			expect(result.data?.signedUrl).toContain("signature=");
		});

		it("returns error when creating signed URL fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "Access denied" }), { status: 403 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.createSignedUrl("forbidden.txt");

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Connection reset");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.createSignedUrl("test.txt");

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("remove", () => {
		it("removes single file successfully", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					expect(init?.method).toBe("DELETE");
					const body = JSON.parse(init?.body as string);
					expect(body.paths).toEqual(["file1.txt"]);
					return new Response(JSON.stringify({ message: "File removed successfully" }), {
						status: 200,
					});
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.remove(["file1.txt"]);

			expect(result.error).toBeNull();
			expect(result.data?.message).toBe("File removed successfully");
		});

		it("removes multiple files successfully", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					const body = JSON.parse(init?.body as string);
					expect(body.paths).toEqual(["file1.txt", "file2.txt", "file3.txt"]);
					return new Response(JSON.stringify({ message: "3 files removed successfully" }), {
						status: 200,
					});
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.remove(["file1.txt", "file2.txt", "file3.txt"]);

			expect(result.error).toBeNull();
		});

		it("returns error when remove fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "Permission denied" }), { status: 403 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.remove(["protected.txt"]);

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Network error");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.remove(["test.txt"]);

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("list", () => {
		it("lists files without prefix", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					const url = typeof input === "string" ? input : input.toString();
					expect(url).not.toContain("prefix=");
					return new Response(
						JSON.stringify({
							files: [
								{ name: "file1.txt", size: 1024, lastModified: "2024-01-01T00:00:00Z" },
								{ name: "file2.txt", size: 2048, lastModified: "2024-01-02T00:00:00Z" },
							],
						}),
						{ status: 200 },
					);
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.list();

			expect(result.error).toBeNull();
			expect(result.data).toBeDefined();
			expect(result.data?.length).toBe(2);
			expect(result.data?.[0].name).toBe("file1.txt");
			expect(result.data?.[1].name).toBe("file2.txt");
		});

		it("lists files with prefix filter", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					const url = typeof input === "string" ? input : input.toString();
					expect(url).toContain("prefix=images%2F");
					return new Response(
						JSON.stringify({
							files: [
								{ name: "images/photo1.jpg", size: 50000, lastModified: "2024-01-01T00:00:00Z" },
								{ name: "images/photo2.jpg", size: 60000, lastModified: "2024-01-02T00:00:00Z" },
							],
						}),
						{ status: 200 },
					);
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.list("images/");

			expect(result.error).toBeNull();
			expect(result.data?.length).toBe(2);
		});

		it("returns empty array when no files exist", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ files: [] }), { status: 200 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.list();

			expect(result.error).toBeNull();
			expect(result.data).toEqual([]);
		});

		it("returns error when list fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				return new Response(JSON.stringify({ message: "Access denied" }), { status: 403 });
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.list();

			expect(result.error).toBeDefined();
			expect(result.data).toBeNull();
		});

		it("returns NetworkError when network request fails", async () => {
			const mockFetch = mock(async (): Promise<Response> => {
				throw new Error("Network unavailable");
			});

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.list();

			expect(result.error).toBeInstanceOf(NetworkError);
			expect(result.data).toBeNull();
		});
	});

	describe("path encoding", () => {
		it("properly encodes special characters in file paths", async () => {
			const mockFetch = mock(
				async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
					const url = typeof input === "string" ? input : input.toString();
					expect(url).toContain("path=my%20folder%2Ftest%26file.txt");
					return new Response(
						JSON.stringify({
							path: "my folder/test&file.txt",
							url: "https://example.com/my folder/test&file.txt",
						}),
						{ status: 200 },
					);
				},
			);

			const testClient = {
				getUrl: () => "http://localhost:3000",
				fetch: mockFetch,
			};

			const client = new StorageBucketClient(testClient as any, "test-bucket");
			const result = await client.upload("my folder/test&file.txt", new ArrayBuffer(10));

			expect(result.error).toBeNull();
		});
	});
});
