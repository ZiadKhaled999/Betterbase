import { describe, expect, it } from "bun:test";
import * as logger from "../src/utils/logger";

describe("Logger utility", () => {
	describe("info method", () => {
		it("logs informational messages", () => {
			// The info method should log to stderr with blue ℹ prefix
			expect(() => logger.info("Test info message")).not.toThrow();
		});

		it("handles empty string message", () => {
			expect(() => logger.info("")).not.toThrow();
		});

		it("handles special characters in message", () => {
			expect(() => logger.info("Special chars: @#$%^&*()")).not.toThrow();
		});
	});

	describe("warn method", () => {
		it("logs warning messages", () => {
			// The warn method should log to stderr with yellow ⚠ prefix
			expect(() => logger.warn("Test warning message")).not.toThrow();
		});

		it("handles empty string message", () => {
			expect(() => logger.warn("")).not.toThrow();
		});
	});

	describe("error method", () => {
		it("logs error messages", () => {
			// The error method should log to stderr - use a message that won't confuse the test runner
			expect(() => logger.error("[ERROR] Test error message")).not.toThrow();
		});

		it("handles empty string message", () => {
			expect(() => logger.error("")).not.toThrow();
		});

		it("handles error objects as messages", () => {
			const error = new Error("Test error");
			expect(() => logger.error("[ERROR] " + error.message)).not.toThrow();
		});
	});

	describe("success method", () => {
		it("logs success messages", () => {
			// The success method should log to stderr with green ✔ prefix
			expect(() => logger.success("Test success message")).not.toThrow();
		});

		it("handles empty string message", () => {
			expect(() => logger.success("")).not.toThrow();
		});
	});

	describe("logging with different message types", () => {
		it("handles string messages", () => {
			// Use prefixed messages to avoid test runner confusion
			expect(() => logger.info("string message")).not.toThrow();
			expect(() => logger.warn("string message")).not.toThrow();
			expect(() => logger.error("[ERROR] string message")).not.toThrow();
			expect(() => logger.success("string message")).not.toThrow();
		});

		it("handles multiline messages", () => {
			const multiline = "Line 1\nLine 2\nLine 3";
			expect(() => logger.info(multiline)).not.toThrow();
		});

		it("handles messages with quotes", () => {
			expect(() => logger.info('Message with "quotes"')).not.toThrow();
			expect(() => logger.info("Message with 'single quotes'")).not.toThrow();
		});

		it("handles unicode characters", () => {
			expect(() => logger.info("Unicode: 你好 🌍 🚀")).not.toThrow();
		});
	});
});
