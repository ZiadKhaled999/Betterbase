import { beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { registerRoutes } from "../src/routes";

describe("users CRUD endpoint", () => {
	let app: Hono;

	beforeAll(async () => {
		// Import db AFTER app modules load — this is the exact same
		// db instance the route handlers will use at runtime.
		// We run CREATE TABLE IF NOT EXISTS on it so the schema exists
		// before any test hits the GET /api/users endpoint.
		const { db } = await import("../src/db");

		db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

		app = new Hono();
		registerRoutes(app);
	});

	describe("GET /api/users", () => {
		test("returns empty users array when no users exist", async () => {
			const res = await app.request("/api/users");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(Array.isArray(data.users)).toBe(true);
			expect(data.users).toEqual([]);
		});

		test("accepts limit and offset query parameters", async () => {
			const res = await app.request("/api/users?limit=10&offset=5");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.pagination.limit).toBe(10);
			expect(data.pagination.offset).toBe(5);
		});

		test("returns 400 for invalid limit", async () => {
			const res = await app.request("/api/users?limit=-1");
			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.error).toContain("Invalid pagination query parameters");
		});

		test("returns 400 for non-numeric limit", async () => {
			const res = await app.request("/api/users?limit=abc");
			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.error).toContain("Invalid pagination query parameters");
		});
	});

	describe("POST /api/users", () => {
		// NOTE: The POST route currently has a TODO stub — it validates the
		// payload but does not persist to the DB. These tests reflect that
		// intentional current behavior. When the real insert is implemented,
		// update the first test to expect 201 and check for a returned `id`.
		test("validates payload but does not persist (stub behavior)", async () => {
			const res = await app.request("/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "test@example.com", name: "Test User" }),
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.message).toBe("User payload validated (not persisted)");
			expect(data.user.email).toBe("test@example.com");
			expect(data.user.name).toBe("Test User");
		});

		test("returns 400 for missing email", async () => {
			const res = await app.request("/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test User" }),
			});
			expect(res.status).toBe(400);
		});

		test("returns 400 for invalid email", async () => {
			const res = await app.request("/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "not-an-email", name: "Test User" }),
			});
			expect(res.status).toBe(400);
		});

		test("returns 400 for malformed JSON", async () => {
			const res = await app.request("/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not valid json",
			});
			expect(res.status).toBe(400);
		});
	});
});
