/**
 * Webhooks Test Suite
 *
 * Tests for untested webhook functions in core/src/webhooks/
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import type { BetterBaseConfig } from "../src/config/schema";
import { connectToRealtime } from "../src/webhooks/integrator";
import { initializeWebhooks } from "../src/webhooks/startup";

describe("Webhook Functions", () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("initializeWebhooks", () => {
		it("should return null when no webhooks configured", () => {
			const config: BetterBaseConfig = {} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).toBeNull();
		});

		it("should return null when webhooks array is empty", () => {
			const config: BetterBaseConfig = {
				webhooks: [],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).toBeNull();
		});

		it("should skip disabled webhooks", () => {
			process.env.WEBHOOK_URL = "https://example.com/webhook";
			process.env.WEBHOOK_SECRET = "secret123";

			const config: BetterBaseConfig = {
				webhooks: [
					{
						id: "test-webhook",
						enabled: false,
						url: "process.env.WEBHOOK_URL",
						secret: "process.env.WEBHOOK_SECRET",
						events: ["insert"],
					},
				],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).toBeNull();
		});

		it("should skip webhooks with invalid env var references", () => {
			const config: BetterBaseConfig = {
				webhooks: [
					{
						id: "test-webhook",
						enabled: true,
						url: "https://example.com/webhook", // Not a process.env reference
						secret: "secret123",
						events: ["insert"],
					},
				],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).toBeNull();
		});

		it("should skip webhooks with missing env vars", () => {
			// Don't set the env vars
			const config: BetterBaseConfig = {
				webhooks: [
					{
						id: "test-webhook",
						enabled: true,
						url: "process.env.MISSING_WEBHOOK_URL",
						secret: "process.env.MISSING_WEBHOOK_SECRET",
						events: ["insert"],
					},
				],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).toBeNull();
		});

		it("should initialize webhook with valid config and env vars", () => {
			process.env.MY_WEBHOOK_URL = "https://example.com/webhook";
			process.env.MY_WEBHOOK_SECRET = "secret123";

			const config: BetterBaseConfig = {
				webhooks: [
					{
						id: "test-webhook",
						enabled: true,
						url: "process.env.MY_WEBHOOK_URL",
						secret: "process.env.MY_WEBHOOK_SECRET",
						events: ["insert", "update", "delete"],
					},
				],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).not.toBeNull();
		});

		it("should handle multiple webhooks", () => {
			process.env.WEBHOOK_URL_1 = "https://example.com/webhook1";
			process.env.WEBHOOK_SECRET_1 = "secret1";
			process.env.WEBHOOK_URL_2 = "https://example.com/webhook2";
			process.env.WEBHOOK_SECRET_2 = "secret2";

			const config: BetterBaseConfig = {
				webhooks: [
					{
						id: "webhook-1",
						enabled: true,
						url: "process.env.WEBHOOK_URL_1",
						secret: "process.env.WEBHOOK_SECRET_1",
						events: ["insert"],
					},
					{
						id: "webhook-2",
						enabled: true,
						url: "process.env.WEBHOOK_URL_2",
						secret: "process.env.WEBHOOK_SECRET_2",
						events: ["update"],
					},
				],
			} as BetterBaseConfig;
			const emitter = new EventEmitter();

			const result = initializeWebhooks(config, emitter);

			expect(result).not.toBeNull();
		});
	});

	describe("connectToRealtime", () => {
		it("should connect dispatcher to realtime emitter", () => {
			const emitter = new EventEmitter();

			// Create a minimal mock dispatcher
			const mockDispatcher = {
				dispatch: async () => ({ success: true }),
			};

			// Should not throw
			expect(() => connectToRealtime(mockDispatcher as any, emitter)).not.toThrow();
		});

		it("should handle db:change events", async () => {
			const emitter = new EventEmitter();
			let dispatchCalled = false;

			const mockDispatcher = {
				dispatch: async (event: any) => {
					dispatchCalled = true;
					return { success: true };
				},
			};

			connectToRealtime(mockDispatcher as any, emitter);

			// Emit a db:change event
			emitter.emit("db:change", { table: "users", type: "insert" });

			// Give async dispatch time to run
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(dispatchCalled).toBe(true);
		});

		it("should handle db:insert events", async () => {
			const emitter = new EventEmitter();
			let dispatchCalled = false;

			const mockDispatcher = {
				dispatch: async (event: any) => {
					dispatchCalled = true;
					return { success: true };
				},
			};

			connectToRealtime(mockDispatcher as any, emitter);

			emitter.emit("db:insert", { table: "users", type: "insert" });

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(dispatchCalled).toBe(true);
		});

		it("should handle db:update events", async () => {
			const emitter = new EventEmitter();
			let dispatchCalled = false;

			const mockDispatcher = {
				dispatch: async (event: any) => {
					dispatchCalled = true;
					return { success: true };
				},
			};

			connectToRealtime(mockDispatcher as any, emitter);

			emitter.emit("db:update", { table: "users", type: "update" });

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(dispatchCalled).toBe(true);
		});

		it("should handle db:delete events", async () => {
			const emitter = new EventEmitter();
			let dispatchCalled = false;

			const mockDispatcher = {
				dispatch: async (event: any) => {
					dispatchCalled = true;
					return { success: true };
				},
			};

			connectToRealtime(mockDispatcher as any, emitter);

			emitter.emit("db:delete", { table: "users", type: "delete" });

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(dispatchCalled).toBe(true);
		});

		it("should handle dispatch errors gracefully", async () => {
			const emitter = new EventEmitter();

			const mockDispatcher = {
				dispatch: async () => {
					throw new Error("Dispatch failed");
				},
			};

			// Should not throw
			expect(() => connectToRealtime(mockDispatcher as any, emitter)).not.toThrow();

			// Emit event that will cause dispatch to fail
			emitter.emit("db:change", { table: "users" });

			// Should complete without throwing
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
	});
});
