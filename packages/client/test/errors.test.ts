import { describe, expect, test } from "bun:test";
import { AuthError, BetterBaseError, NetworkError, ValidationError } from "../src/errors";

describe("errors", () => {
	describe("BetterBaseError", () => {
		test("is a subclass of Error", () => {
			const error = new BetterBaseError("test message");
			expect(error).toBeInstanceOf(Error);
		});

		test("preserves message", () => {
			const error = new BetterBaseError("test message");
			expect(error.message).toBe("test message");
		});

		test("has name property", () => {
			const error = new BetterBaseError("test");
			expect(error.name).toBe("BetterBaseError");
		});

		test("can be thrown and caught", () => {
			expect(() => {
				throw new BetterBaseError("test error");
			}).toThrow();
		});
	});

	describe("NetworkError", () => {
		test("is a subclass of BetterBaseError", () => {
			const error = new NetworkError("network failed");
			expect(error).toBeInstanceOf(BetterBaseError);
		});

		test("has correct name", () => {
			const error = new NetworkError("test");
			expect(error.name).toBe("NetworkError");
		});
	});

	describe("AuthError", () => {
		test("is a subclass of BetterBaseError", () => {
			const error = new AuthError("auth failed");
			expect(error).toBeInstanceOf(BetterBaseError);
		});

		test("has correct name", () => {
			const error = new AuthError("test");
			expect(error.name).toBe("AuthError");
		});
	});

	describe("ValidationError", () => {
		test("is a subclass of BetterBaseError", () => {
			const error = new ValidationError("validation failed");
			expect(error).toBeInstanceOf(BetterBaseError);
		});

		test("has correct name", () => {
			const error = new ValidationError("test");
			expect(error.name).toBe("ValidationError");
		});

		test("error hierarchy is correct", () => {
			const networkError = new NetworkError("test");
			const authError = new AuthError("test");
			const validationError = new ValidationError("test");

			expect(networkError).toBeInstanceOf(BetterBaseError);
			expect(authError).toBeInstanceOf(BetterBaseError);
			expect(validationError).toBeInstanceOf(BetterBaseError);
		});
	});
});
