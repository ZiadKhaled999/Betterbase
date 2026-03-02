// packages/client/test/edge-cases.test.ts
// Edge case tests for the client SDK — network failures, bad responses,
// boundary inputs, and single-use QueryBuilder enforcement.

import { describe, expect, mock, test } from "bun:test";
import { createClient } from "../src/index";

function makeClient(fetchImpl: ReturnType<typeof mock>) {
	return createClient({
		url: "http://localhost:3000",
		fetch: fetchImpl as unknown as typeof fetch,
	});
}

describe("Client SDK — network failure handling", () => {
	test("handles fetch throwing a network error — returns error, not throw", async () => {
		const failFetch = mock(() => Promise.reject(new Error("Network timeout")));
		const client = makeClient(failFetch);
		const result = await client.from("users").execute();
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	test("error message reflects the original network error", async () => {
		const failFetch = mock(() => Promise.reject(new Error("ECONNREFUSED")));
		const client = makeClient(failFetch);
		const result = await client.from("users").execute();
		expect(result.error?.message).toContain("ECONNREFUSED");
	});

	test("handles server 500 without throwing", async () => {
		const errorFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 }),
			),
		);
		const client = makeClient(errorFetch);
		const result = await client.from("users").execute();
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	test("handles server returning non-JSON body without throwing", async () => {
		const badFetch = mock(() =>
			Promise.resolve(new Response("Internal Server Error", { status: 500 })),
		);
		const client = makeClient(badFetch);
		await expect(client.from("users").execute()).resolves.toBeDefined();
	});

	test("handles 404 response without throwing", async () => {
		const notFoundFetch = mock(() =>
			Promise.resolve(new Response(JSON.stringify({ error: "Not found" }), { status: 404 })),
		);
		const client = makeClient(notFoundFetch);
		const result = await client.from("users").execute();
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});
});

describe("Client SDK — URL encoding", () => {
	test(".eq() with special characters produces a parseable URL", async () => {
		const captureFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [], error: null }), { status: 200 }),
			),
		);
		const client = makeClient(captureFetch);
		await client.from("users").eq("name", "O'Reilly & Co. <test>").execute();
		const [url] = captureFetch.mock.calls[0] as [string];
		expect(() => new URL(url)).not.toThrow();
	});

	test(".in() with special characters in values produces a parseable URL", async () => {
		const captureFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [], error: null }), { status: 200 }),
			),
		);
		const client = makeClient(captureFetch);
		await client.from("users").in("name", ["Alice & Bob", "O'Reilly"]).execute();
		const [url] = captureFetch.mock.calls[0] as [string];
		expect(() => new URL(url)).not.toThrow();
	});

	test("table name is correctly included in the request URL", async () => {
		const captureFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ posts: [], error: null }), { status: 200 }),
			),
		);
		const client = makeClient(captureFetch);
		await client.from("posts").execute();
		const [url] = captureFetch.mock.calls[0] as [string];
		expect(url).toContain("/api/posts");
	});
});

describe("Client SDK — single-use QueryBuilder", () => {
	test("calling execute() twice on same builder returns error on second call", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [] }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		const qb = client.from("users");
		await qb.execute();
		const second = await qb.execute();
		expect(second.error).not.toBeNull();
		// Fetch should only be called once — the second execute returns early
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	test("each client.from() call creates a fresh independent builder", async () => {
		const fetchImpl = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [] }), { status: 200 }),
			),
		);
		const client = makeClient(fetchImpl);
		await client.from("users").execute();
		const result = await client.from("users").execute();
		// Second call from a NEW builder should succeed
		expect(result.error).toBeNull();
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});

describe("Client SDK — boundary inputs", () => {
	test(".limit(0) sends limit=0 in request", async () => {
		const captureFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [] }), { status: 200 }),
			),
		);
		const client = makeClient(captureFetch);
		await client.from("users").limit(0).execute();
		const [url] = captureFetch.mock.calls[0] as [string];
		expect(url).toContain("limit=0");
	});

	test(".offset(0) sends offset=0 in request", async () => {
		const captureFetch = mock(() =>
			Promise.resolve(
				new Response(JSON.stringify({ users: [] }), { status: 200 }),
			),
		);
		const client = makeClient(captureFetch);
		await client.from("users").offset(0).execute();
		const [url] = captureFetch.mock.calls[0] as [string];
		expect(url).toContain("offset=0");
	});
});
