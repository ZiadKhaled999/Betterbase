import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { defineStoragePolicy } from "../src/storage/types";
import type { StoragePolicy } from "../src/storage/types";
import {
	checkStorageAccess,
	getPolicyDenialMessage,
} from "../src/storage/policy-engine";

// Note: evaluateStoragePolicy is not exported, so we test through checkStorageAccess
describe("Storage Policy Engine", () => {
	describe("defineStoragePolicy", () => {
		test("should create policy with bucket, operation, and expression", () => {
			const policy = defineStoragePolicy("avatars", "upload", "true");
			expect(policy.bucket).toBe("avatars");
			expect(policy.operation).toBe("upload");
			expect(policy.expression).toBe("true");
		});
	});

	describe("checkStorageAccess - true expression", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("avatars", "upload", "true"),
			defineStoragePolicy("avatars", "download", "true"),
			defineStoragePolicy("files", "upload", "true"),
		];

		test("should allow upload when policy is 'true' with authenticated user", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "upload", "user-123/profile.jpg");
			expect(result).toBe(true);
		});

		test("should allow upload when policy is 'true' with anonymous user", () => {
			const result = checkStorageAccess(policies, null, "avatars", "upload", "public/file.jpg");
			expect(result).toBe(true);
		});

		test("should allow download when policy is 'true'", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "download", "user-123/profile.jpg");
			expect(result).toBe(true);
		});

		test("should allow different bucket operations", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "document.pdf");
			expect(result).toBe(true);
		});
	});

	describe("checkStorageAccess - false expression", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("private", "upload", "false"),
			defineStoragePolicy("private", "download", "false"),
		];

		test("should deny upload when policy is 'false'", () => {
			const result = checkStorageAccess(policies, "user-123", "private", "upload", "secret.txt");
			expect(result).toBe(false);
		});

		test("should deny download when policy is 'false'", () => {
			const result = checkStorageAccess(policies, "user-123", "private", "download", "secret.txt");
			expect(result).toBe(false);
		});

		test("should deny with anonymous user when policy is 'false'", () => {
			const result = checkStorageAccess(policies, null, "private", "upload", "secret.txt");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - path.startsWith expression", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("files", "upload", "path.startsWith('public/')"),
			defineStoragePolicy("files", "download", "path.startsWith('public/')"),
		];

		test("should allow when path starts with prefix", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "public/document.pdf");
			expect(result).toBe(true);
		});

		test("should allow for nested paths starting with prefix", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "public/images/photo.jpg");
			expect(result).toBe(true);
		});

		test("should deny when path does not start with prefix", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "private/document.pdf");
			expect(result).toBe(false);
		});

		test("should work for download operations", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "download", "public/file.txt");
			expect(result).toBe(true);
		});

		test("should deny download for non-prefix paths", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "download", "private/file.txt");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - auth.uid() = path.split() expression", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("avatars", "upload", "auth.uid() = path.split('/')[0]"),
		];

		test("should allow when userId matches first path segment", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "upload", "user-123/profile.jpg");
			expect(result).toBe(true);
		});

		test("should deny when userId does not match first path segment", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "upload", "user-456/profile.jpg");
			expect(result).toBe(false);
		});

		test("should deny when userId is null (anonymous)", () => {
			const result = checkStorageAccess(policies, null, "avatars", "upload", "user-123/profile.jpg");
			expect(result).toBe(false);
		});

		test("should work with longer paths", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "upload", "user-123/images/2024/photo.jpg");
			expect(result).toBe(true);
		});
	});

	describe("checkStorageAccess - auth.uid() = path.split with delimiter", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("files", "upload", "auth.uid() = path.split('/')[1]"),
		];

		test("should allow when userId matches second path segment", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "prefix/user-123/file.txt");
			expect(result).toBe(true);
		});

		test("should deny when userId does not match second segment", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "prefix/user-456/file.txt");
			expect(result).toBe(false);
		});

		test("should deny when userId is null", () => {
			const result = checkStorageAccess(policies, null, "files", "upload", "prefix/user-123/file.txt");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - wildcard operation", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("public", "*", "true"),
		];

		test("should allow upload with wildcard policy", () => {
			const result = checkStorageAccess(policies, "user-123", "public", "upload", "file.txt");
			expect(result).toBe(true);
		});

		test("should allow download with wildcard policy", () => {
			const result = checkStorageAccess(policies, "user-123", "public", "download", "file.txt");
			expect(result).toBe(true);
		});

		test("should allow list with wildcard policy", () => {
			const result = checkStorageAccess(policies, "user-123", "public", "list", "");
			expect(result).toBe(true);
		});

		test("should allow delete with wildcard policy", () => {
			const result = checkStorageAccess(policies, "user-123", "public", "delete", "file.txt");
			expect(result).toBe(true);
		});

		test("should allow with anonymous user", () => {
			const result = checkStorageAccess(policies, null, "public", "upload", "file.txt");
			expect(result).toBe(true);
		});
	});

	describe("checkStorageAccess - no matching policies", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("avatars", "upload", "true"),
		];

		test("should deny when no policy matches the bucket", () => {
			const result = checkStorageAccess(policies, "user-123", "unknown-bucket", "upload", "file.txt");
			expect(result).toBe(false);
		});

		test("should deny when no policy matches the operation", () => {
			const result = checkStorageAccess(policies, "user-123", "avatars", "delete", "file.txt");
			expect(result).toBe(false);
		});

		test("should deny when bucket and operation don't match", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "list", "");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - multiple policies", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("files", "upload", "path.startsWith('public/')"),
			defineStoragePolicy("files", "upload", "auth.uid() = path.split('/')[0]"),
		];

		test("should allow if any policy matches (public path)", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "public/document.pdf");
			expect(result).toBe(true);
		});

		test("should allow if any policy matches (user path)", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "user-123/file.txt");
			expect(result).toBe(true);
		});

		test("should deny if no policy matches", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "private/document.pdf");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - list operation", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("files", "list", "true"),
		];

		test("should allow list operation with 'true' policy", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "list", "");
			expect(result).toBe(true);
		});

		test("should allow list with path prefix", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "list", "folder/");
			expect(result).toBe(true);
		});

		test("should deny list without matching policy", () => {
			const noListPolicy: StoragePolicy[] = [
				defineStoragePolicy("files", "upload", "true"),
			];
			const result = checkStorageAccess(noListPolicy, "user-123", "files", "list", "");
			expect(result).toBe(false);
		});
	});

	describe("checkStorageAccess - delete operation", () => {
		const policies: StoragePolicy[] = [
			defineStoragePolicy("files", "delete", "true"),
		];

		test("should allow delete operation with 'true' policy", () => {
			const result = checkStorageAccess(policies, "user-123", "files", "delete", "file.txt");
			expect(result).toBe(true);
		});

		test("should deny delete without matching policy", () => {
			const noDeletePolicy: StoragePolicy[] = [
				defineStoragePolicy("files", "upload", "true"),
			];
			const result = checkStorageAccess(noDeletePolicy, "user-123", "files", "delete", "file.txt");
			expect(result).toBe(false);
		});
	});

	describe("getPolicyDenialMessage", () => {
		test("should return message for upload operation", () => {
			const message = getPolicyDenialMessage("upload", "file.txt");
			expect(message).toContain("upload");
			expect(message).toContain("file.txt");
		});

		test("should return message for download operation", () => {
			const message = getPolicyDenialMessage("download", "image.jpg");
			expect(message).toContain("download");
			expect(message).toContain("image.jpg");
		});

		test("should return message for list operation", () => {
			const message = getPolicyDenialMessage("list", "folder/");
			expect(message).toContain("list");
			expect(message).toContain("folder/");
		});

		test("should return message for delete operation", () => {
			const message = getPolicyDenialMessage("delete", "old-file.txt");
			expect(message).toContain("delete");
			expect(message).toContain("old-file.txt");
		});
	});

	describe("Edge cases", () => {
		test("should handle empty path", () => {
			const policies: StoragePolicy[] = [
				defineStoragePolicy("files", "list", "true"),
			];
			const result = checkStorageAccess(policies, "user-123", "files", "list", "");
			expect(result).toBe(true);
		});

		test("should handle paths with special characters", () => {
			const policies: StoragePolicy[] = [
				defineStoragePolicy("files", "upload", "path.startsWith('public/')"),
			];
			const result = checkStorageAccess(policies, "user-123", "files", "upload", "public/file with spaces.txt");
			expect(result).toBe(true);
		});

		test("should handle very long paths", () => {
			const policies: StoragePolicy[] = [
				defineStoragePolicy("files", "upload", "true"),
			];
			const longPath = "a".repeat(1000);
			const result = checkStorageAccess(policies, "user-123", "files", "upload", longPath);
			expect(result).toBe(true);
		});

		test("should handle bucket names with special characters", () => {
			const policies: StoragePolicy[] = [
				defineStoragePolicy("my-bucket", "upload", "true"),
			];
			const result = checkStorageAccess(policies, "user-123", "my-bucket", "upload", "file.txt");
			expect(result).toBe(true);
		});
	});
});
