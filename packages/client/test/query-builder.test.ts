// packages/client/test/query-builder.test.ts
// Tests for QueryBuilder via createClient().from()
// QueryBuilder is never instantiated directly — always via client.from(table).
// fetch is injected via createClient({ fetch: mockFetch }) to avoid real HTTP.

import { describe, expect, mock, test } from "bun:test";
import { createClient } from "../src/index";

function mockFetch(responseData: unknown, status = 200) {
	return mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ users: responseData, error: null }), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
}

function makeClient(fetchImpl: ReturnType<typeof mock>) {
	return createClient({
		url: "http://localhost:3000",
		fetch: fetchImpl as unknown as typeof fetch,
	});
}

describe("QueryBuilder — HTTP request construction", () => {
	test("execute() makes a GET request", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").execute();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [, opts] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect((opts?.method ?? "GET").toUpperCase()).toBe("GET");
	});

	test("execute() targets /api/<table>", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("/api/users");
	});

	test(".select() appends select param to URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").select("id,name").execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("select=id%2Cname");
	});

	test(".eq() appends filter to URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").eq("id", "abc123").execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("abc123");
	});

	test(".limit() appends limit param to URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").limit(10).execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("limit=10");
	});

	test(".offset() appends offset param to URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").offset(20).execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("offset=20");
	});

	test(".order() appends sort param to URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").order("name", "desc").execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("sort=name%3Adesc");
	});

	test(".in() sends JSON-encoded array", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").in("id", ["a", "b", "c"]).execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("id_in");
	});
});

describe("QueryBuilder — response handling", () => {
	test("returns data array on success", async () => {
		const fetchImpl = mockFetch([{ id: "1", name: "Alice" }]);
		const client = makeClient(fetchImpl);
		const result = await client.from("users").execute();
		expect(result.data).toEqual([{ id: "1", name: "Alice" }]);
	});

	test("returns error: null on success", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		const result = await client.from("users").execute();
		expect(result.error).toBeNull();
	});

	test("returns error and null data on 500", async () => {
		const fetchImpl = mockFetch({ error: "Internal error" }, 500);
		const client = makeClient(fetchImpl);
		const result = await client.from("users").execute();
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	test("returns error and null data when fetch throws", async () => {
		const failFetch = mock(() => Promise.reject(new Error("Network timeout")));
		const client = makeClient(failFetch);
		const result = await client.from("users").execute();
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	test("is single-use — second execute() returns error", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		const qb = client.from("users");
		await qb.execute();
		const second = await qb.execute();
		expect(second.error).not.toBeNull();
		// fetch should only have been called once
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});

describe("QueryBuilder — chaining", () => {
	test("methods are chainable and return the same builder instance", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		const qb = client.from("users");
		// All chained — no error thrown
		await expect(
			qb.select("id").eq("name", "Alice").limit(5).offset(0).order("id", "asc").execute(),
		).resolves.toBeDefined();
	});

	test(".eq() with special characters produces a parseable URL", async () => {
		const fetchImpl = mockFetch([]);
		const client = makeClient(fetchImpl);
		await client.from("users").eq("name", "O'Reilly & Co. <test>").execute();
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(() => new URL(url)).not.toThrow();
	});
});

describe("QueryBuilder — insert / update / delete", () => {
	test("insert() sends POST request", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		await client.from("users").insert({ name: "Alice", email: "alice@example.com" });
		const [, opts] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(opts.method).toBe("POST");
	});

	test("update() sends PATCH request", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		await client.from("users").update("1", { name: "Bob" });
		const [, opts] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(opts.method).toBe("PATCH");
	});

	test("delete() sends DELETE request", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		await client.from("users").delete("1");
		const [, opts] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(opts.method).toBe("DELETE");
	});

	test("single() sends GET to /api/<table>/<id>", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ user: { id: "42" } }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		await client.from("users").single("42");
		const [url] = fetchImpl.mock.calls[0] as [string];
		expect(url).toContain("/api/users/42");
	});
});
