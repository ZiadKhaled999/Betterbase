import { describe, expect, test } from "bun:test";
import { signPayload, verifySignature } from "../src/webhooks/signer";

describe("webhooks/signer", () => {
	describe("signPayload", () => {
		test("signs a string payload", () => {
			const payload = "test payload";
			const secret = "my-secret-key";
			const signature = signPayload(payload, secret);

			expect(signature).toBeDefined();
			expect(typeof signature).toBe("string");
			expect(signature.length).toBe(64); // SHA256 hex is 64 chars
		});

		test("signs an object payload", () => {
			const payload = { event: "user.created", data: { id: "123" } };
			const secret = "my-secret-key";
			const signature = signPayload(payload, secret);

			expect(signature).toBeDefined();
			expect(typeof signature).toBe("string");
			expect(signature.length).toBe(64);
		});

		test("same input produces same signature", () => {
			const payload = "test payload";
			const secret = "my-secret-key";

			const sig1 = signPayload(payload, secret);
			const sig2 = signPayload(payload, secret);

			expect(sig1).toBe(sig2);
		});

		test("different secrets produce different signatures", () => {
			const payload = "test payload";

			const sig1 = signPayload(payload, "secret1");
			const sig2 = signPayload(payload, "secret2");

			expect(sig1).not.toBe(sig2);
		});

		test("different payloads produce different signatures", () => {
			const secret = "my-secret-key";

			const sig1 = signPayload("payload1", secret);
			const sig2 = signPayload("payload2", secret);

			expect(sig1).not.toBe(sig2);
		});
	});

	describe("verifySignature", () => {
		test("returns true for valid signature", () => {
			const payload = "test payload";
			const secret = "my-secret-key";
			const signature = signPayload(payload, secret);

			const isValid = verifySignature(payload, signature, secret);
			expect(isValid).toBe(true);
		});

		test("returns false for invalid signature", () => {
			const payload = "test payload";
			const secret = "my-secret-key";
			const invalidSignature = "a".repeat(64);

			const isValid = verifySignature(payload, invalidSignature, secret);
			expect(isValid).toBe(false);
		});

		test("returns false for wrong secret", () => {
			const payload = "test payload";
			const signature = signPayload(payload, "correct-secret");
			const wrongSecret = "wrong-secret";

			const isValid = verifySignature(payload, signature, wrongSecret);
			expect(isValid).toBe(false);
		});

		test("returns false for tampered payload", () => {
			const payload = "original payload";
			const secret = "my-secret-key";
			const signature = signPayload(payload, secret);

			const tamperedPayload = "tampered payload";
			const isValid = verifySignature(tamperedPayload, signature, secret);
			expect(isValid).toBe(false);
		});

		test("handles object payloads", () => {
			const payload = { event: "user.created", data: { id: "123" } };
			const secret = "my-secret-key";
			const signature = signPayload(payload, secret);

			const isValid = verifySignature(payload, signature, secret);
			expect(isValid).toBe(true);
		});

		test("returns false for mismatched signature length", () => {
			const payload = "test payload";
			const secret = "my-secret-key";
			const shortSignature = "abc";

			const isValid = verifySignature(payload, shortSignature, secret);
			expect(isValid).toBe(false);
		});
	});
});
