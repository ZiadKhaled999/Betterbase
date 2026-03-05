import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { registerRoutes } from "../src/routes";

describe("health endpoint", () => {
	let app: Hono;

	beforeAll(() => {
		app = new Hono();
		registerRoutes(app);
	});

	test("GET /health returns 200 with healthy status", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.status).toBe("healthy");
		expect(data.database).toBe("connected");
		expect(data.timestamp).toBeDefined();
	});
});
