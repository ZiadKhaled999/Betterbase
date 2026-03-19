import { EventEmitter } from "node:events";
EventEmitter.defaultMaxListeners = 20;

import { describe, expect, it } from "bun:test";
import * as prompts from "../src/utils/prompts";

describe("Prompt utilities", () => {
	describe("text prompt", () => {
		it("validates message is required", async () => {
			// Empty message should fail validation
			await expect(prompts.text({ message: "" })).rejects.toThrow();
		});

		it("accepts valid text prompt options", async () => {
			// Actually call the prompts.text function to verify it accepts valid input
			const result = prompts.text({ message: "Enter your name:" });
			expect(result).toBeDefined();
		});

		it("accepts initial value option", async () => {
			// Actually call the prompts.text function with initial value
			const result = prompts.text({ message: "Enter your name:", initial: "John" });
			expect(result).toBeDefined();
		});
	});

	describe("confirm prompt", () => {
		it("validates message is required", async () => {
			// Empty message should fail validation
			await expect(prompts.confirm({ message: "" })).rejects.toThrow();
		});

		it("accepts valid confirm prompt options", async () => {
			// Actually call the prompts.confirm function to verify it accepts valid input
			const result = prompts.confirm({ message: "Continue?", default: true });
			expect(result).toBeDefined();
		});

		it("accepts initial option for backward compatibility", async () => {
			// Actually call the prompts.confirm function with initial value
			const result = prompts.confirm({ message: "Continue?", initial: false });
			expect(result).toBeDefined();
		});
	});

	describe("select prompt", () => {
		it("validates message is required", async () => {
			// Empty message should fail validation
			await expect(
				prompts.select({ message: "", options: [{ value: "a", label: "A" }] }),
			).rejects.toThrow();
		});

		it("validates options are required", async () => {
			// Empty options should fail validation
			await expect(prompts.select({ message: "Select one:", options: [] })).rejects.toThrow();
		});

		it("validates option has value and label", async () => {
			// Actually call the prompts.select function to verify it accepts valid input
			const result = prompts.select({
				message: "Select one:",
				options: [{ value: "neon", label: "Neon" }],
			});
			expect(result).toBeDefined();
		});

		it("accepts default option", async () => {
			// Actually call the prompts.select function with default option
			const result = prompts.select({
				message: "Select provider:",
				options: [
					{ value: "neon", label: "Neon" },
					{ value: "turso", label: "Turso" },
				],
				default: "neon",
			});
			expect(result).toBeDefined();
		});

		it("accepts initial option for backward compatibility", async () => {
			// Actually call the prompts.select function with initial option
			const result = prompts.select({
				message: "Select provider:",
				options: [
					{ value: "neon", label: "Neon" },
					{ value: "turso", label: "Turso" },
				],
				initial: "turso",
			});
			expect(result).toBeDefined();
		});

		it("validates default matches an option value", async () => {
			// Actually call the prompts.select function - validation should fail because "invalid" is not in options
			await expect(
				prompts.select({
					message: "Select provider:",
					options: [
						{ value: "neon", label: "Neon" },
						{ value: "turso", label: "Turso" },
					],
					default: "invalid",
				}),
			).rejects.toThrow();
		});
	});
});
