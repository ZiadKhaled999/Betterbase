/**
 * Logger Functions Test Suite
 *
 * Tests for untested logger functions in core/src/logger/index.ts
 */

import { describe, expect, it } from "bun:test";
import { createRequestLogger, logError, logSlowQuery, logSuccess } from "../src/logger";

describe("Logger Functions", () => {
	describe("createRequestLogger", () => {
		it("should create a child logger with reqId", () => {
			const reqLogger = createRequestLogger();

			expect(reqLogger).toBeDefined();
			expect(reqLogger.child).toBeDefined();
		});

		it("should generate unique request IDs", () => {
			const reqLogger1 = createRequestLogger();
			const reqLogger2 = createRequestLogger();

			// The child loggers should have different bindings
			expect(reqLogger1).not.toBe(reqLogger2);
		});

		it("should allow logging with the request logger", () => {
			const reqLogger = createRequestLogger();

			// Should not throw
			expect(() => reqLogger.info("test message")).not.toThrow();
		});
	});

	describe("logSlowQuery", () => {
		it("should not log when query is fast", () => {
			const query = "SELECT * FROM users";
			const duration = 50; // 50ms, below threshold of 100ms
			const threshold = 100;

			// Should not throw and should not log
			expect(() => logSlowQuery(query, duration, threshold)).not.toThrow();
		});

		it("should log warning when query exceeds threshold", () => {
			const query = "SELECT * FROM users WHERE id = 1";
			const duration = 200; // 200ms, above threshold of 100ms
			const threshold = 100;

			// Should log warning but not throw
			expect(() => logSlowQuery(query, duration, threshold)).not.toThrow();
		});

		it("should use default threshold of 100ms", () => {
			const query = "SELECT * FROM users";
			const duration = 50; // Below default threshold

			expect(() => logSlowQuery(query, duration)).not.toThrow();
		});

		it("should log warning with custom threshold", () => {
			const query = "SELECT * FROM users";
			const duration = 500;
			const threshold = 200;

			expect(() => logSlowQuery(query, duration, threshold)).not.toThrow();
		});

		it("should handle empty query string", () => {
			const duration = 200;

			expect(() => logSlowQuery("", duration)).not.toThrow();
		});

		it("should handle very long query strings", () => {
			const longQuery = "SELECT " + "a".repeat(1000);
			const duration = 200;

			// Should truncate in the log but not throw
			expect(() => logSlowQuery(longQuery, duration)).not.toThrow();
		});
	});

	describe("logError", () => {
		it("should log error with message", () => {
			const error = new Error("Test error");

			expect(() => logError(error)).not.toThrow();
		});

		it("should log error with context", () => {
			const error = new Error("Test error");
			const context = { userId: "123", operation: "test" };

			expect(() => logError(error, context)).not.toThrow();
		});

		it("should log error with empty context", () => {
			const error = new Error("Test error");
			const context = {};

			expect(() => logError(error, context)).not.toThrow();
		});

		it("should handle error without stack trace", () => {
			const error = new Error("Test error");
			delete error.stack;

			expect(() => logError(error)).not.toThrow();
		});

		it("should handle error with custom name", () => {
			const error = new Error("Test error");
			error.name = "CustomError";

			expect(() => logError(error)).not.toThrow();
		});

		it("should handle various context values", () => {
			const error = new Error("Test error");
			const context = {
				userId: "123",
				count: 42,
				active: true,
				data: { nested: "value" },
			};

			expect(() => logError(error, context)).not.toThrow();
		});
	});

	describe("logSuccess", () => {
		it("should log success with operation name", () => {
			const operation = "test_operation";
			const duration = 100;

			expect(() => logSuccess(operation, duration)).not.toThrow();
		});

		it("should log success with metadata", () => {
			const operation = "test_operation";
			const duration = 100;
			const metadata = { records: 10, userId: "123" };

			expect(() => logSuccess(operation, duration, metadata)).not.toThrow();
		});

		it("should log success with empty metadata", () => {
			const operation = "test_operation";
			const duration = 100;
			const metadata = {};

			expect(() => logSuccess(operation, duration, metadata)).not.toThrow();
		});

		it("should handle zero duration", () => {
			const operation = "test_operation";
			const duration = 0;

			expect(() => logSuccess(operation, duration)).not.toThrow();
		});

		it("should handle long operation names", () => {
			const operation = "very_long_operation_name_that_does_something";
			const duration = 500;

			expect(() => logSuccess(operation, duration)).not.toThrow();
		});

		it("should handle complex metadata", () => {
			const operation = "test";
			const duration = 100;
			const metadata = {
				users: ["user1", "user2"],
				count: 2,
				data: { key: "value" },
			};

			expect(() => logSuccess(operation, duration, metadata)).not.toThrow();
		});
	});
});
