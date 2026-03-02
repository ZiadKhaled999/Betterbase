// packages/client/test/realtime.test.ts
// Tests for RealtimeClient
// Real API chain: client.from(table).on(event, callback).subscribe(filter?)
// RealtimeClient constructor: new RealtimeClient(url, token?)
// WebSocket is only created on connect(), which is called inside subscribe().
// In test env, WebSocket is undefined so the client sets disabled=true.
// We test both the disabled path and the enabled path via a mock WebSocket.

import { describe, expect, mock, test } from "bun:test";
import { RealtimeClient } from "../src/realtime";

// ─── Disabled path (no WebSocket available) ──────────────────────────────────

describe("RealtimeClient — no WebSocket environment", () => {
	test("can be constructed without throwing", () => {
		expect(() => new RealtimeClient("http://localhost:3000")).not.toThrow();
	});

	test("setToken() does not throw", () => {
		const client = new RealtimeClient("http://localhost:3000");
		expect(() => client.setToken("my-token")).not.toThrow();
	});

	test("from() returns an object with an on() method", () => {
		const client = new RealtimeClient("http://localhost:3000");
		const result = client.from("users");
		expect(typeof result.on).toBe("function");
	});

	test("from().on() returns an object with a subscribe() method", () => {
		const client = new RealtimeClient("http://localhost:3000");
		const result = client.from("users").on("INSERT", () => {});
		expect(typeof result.subscribe).toBe("function");
	});

	test("subscribe() returns an object with an unsubscribe() method", () => {
		const client = new RealtimeClient("http://localhost:3000");
		const sub = client.from("users").on("INSERT", () => {}).subscribe();
		expect(typeof sub.unsubscribe).toBe("function");
	});

	test("unsubscribe() does not throw", () => {
		const client = new RealtimeClient("http://localhost:3000");
		const sub = client.from("users").on("INSERT", () => {}).subscribe();
		expect(() => sub.unsubscribe()).not.toThrow();
	});

	test("disconnect() does not throw", () => {
		const client = new RealtimeClient("http://localhost:3000");
		expect(() => client.disconnect()).not.toThrow();
	});

	test("callback is NOT called when disabled (no WebSocket)", () => {
		const client = new RealtimeClient("http://localhost:3000");
		const cb = mock(() => {});
		client.from("users").on("INSERT", cb).subscribe();
		// No way to simulate messages when disabled — callback must stay at 0
		expect(cb).toHaveBeenCalledTimes(0);
	});
});

// ─── Enabled path (mock WebSocket) ───────────────────────────────────────────

class MockWebSocket {
	static OPEN = 1;
	static CONNECTING = 0;
	readyState = MockWebSocket.OPEN;
	sent: string[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: ((e: unknown) => void) | null = null;
	static lastInstance: MockWebSocket | null = null;

	constructor(public url: string) {
		MockWebSocket.lastInstance = this;
		// Fire onopen asynchronously like a real WebSocket
		Promise.resolve().then(() => this.onopen?.());
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.readyState = 3;
		this.onclose?.();
	}

	simulateMessage(data: unknown) {
		this.onmessage?.({ data: JSON.stringify(data) });
	}
}

// Patch global WebSocket so RealtimeClient.connect() uses our mock
function withMockWebSocket(fn: () => Promise<void>): () => Promise<void> {
	return async () => {
		const original = (globalThis as Record<string, unknown>).WebSocket;
		(globalThis as Record<string, unknown>).WebSocket = MockWebSocket;
		MockWebSocket.lastInstance = null;
		try {
			await fn();
		} finally {
			(globalThis as Record<string, unknown>).WebSocket = original;
		}
	};
}

describe("RealtimeClient — with mock WebSocket", () => {
	test(
		"subscribe() triggers a WebSocket connection",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			client.from("users").on("INSERT", () => {}).subscribe();
			// Wait for async open
			await new Promise((r) => setTimeout(r, 20));
			expect(MockWebSocket.lastInstance).not.toBeNull();
		}),
	);

	test(
		"subscribe() sends a subscribe message after connection opens",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			client.from("users").on("INSERT", () => {}).subscribe();
			await new Promise((r) => setTimeout(r, 20));
			const ws = MockWebSocket.lastInstance!;
			const subscribeMsg = ws.sent.find((s) => {
				try {
					return JSON.parse(s).type === "subscribe";
				} catch {
					return false;
				}
			});
			expect(subscribeMsg).toBeDefined();
			expect(JSON.parse(subscribeMsg!).table).toBe("users");
		}),
	);

	test(
		"INSERT callback fires when server sends matching event",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			const received: unknown[] = [];
			client
				.from("users")
				.on("INSERT", (payload) => received.push(payload))
				.subscribe();
			await new Promise((r) => setTimeout(r, 20));

			MockWebSocket.lastInstance!.simulateMessage({
				type: "update",
				event: "INSERT",
				table: "users",
				data: { id: "1", name: "Alice" },
				timestamp: Date.now(),
			});

			expect(received.length).toBe(1);
			expect((received[0] as { event: string }).event).toBe("INSERT");
		}),
	);

	test(
		"callback does NOT fire for a different table",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			const received: unknown[] = [];
			client.from("users").on("INSERT", (p) => received.push(p)).subscribe();
			await new Promise((r) => setTimeout(r, 20));

			MockWebSocket.lastInstance!.simulateMessage({
				type: "update",
				event: "INSERT",
				table: "posts", // different table
				data: { id: "1" },
				timestamp: Date.now(),
			});

			expect(received.length).toBe(0);
		}),
	);

	test(
		"wildcard event '*' receives all event types",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			const events: string[] = [];
			client
				.from("users")
				.on("*", (p) => events.push((p as { event: string }).event))
				.subscribe();
			await new Promise((r) => setTimeout(r, 20));

			const ws = MockWebSocket.lastInstance!;
			ws.simulateMessage({ type: "update", event: "INSERT", table: "users", data: {}, timestamp: 0 });
			ws.simulateMessage({ type: "update", event: "UPDATE", table: "users", data: {}, timestamp: 0 });
			ws.simulateMessage({ type: "update", event: "DELETE", table: "users", data: {}, timestamp: 0 });

			expect(events).toEqual(["INSERT", "UPDATE", "DELETE"]);
		}),
	);

	test(
		"unsubscribe() sends unsubscribe message when last subscriber leaves",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			const sub = client.from("users").on("INSERT", () => {}).subscribe();
			await new Promise((r) => setTimeout(r, 20));

			sub.unsubscribe();

			const ws = MockWebSocket.lastInstance!;
			const unsubMsg = ws.sent.find((s) => {
				try {
					return JSON.parse(s).type === "unsubscribe";
				} catch {
					return false;
				}
			});
			expect(unsubMsg).toBeDefined();
		}),
	);

	test(
		"WebSocket URL uses ws:// protocol",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000");
			client.from("users").on("INSERT", () => {}).subscribe();
			await new Promise((r) => setTimeout(r, 20));
			expect(MockWebSocket.lastInstance!.url).toContain("ws://");
		}),
	);

	test(
		"token is appended to WebSocket URL when provided",
		withMockWebSocket(async () => {
			const client = new RealtimeClient("http://localhost:3000", "my-token");
			client.from("users").on("INSERT", () => {}).subscribe();
			await new Promise((r) => setTimeout(r, 20));
			expect(MockWebSocket.lastInstance!.url).toContain("token=my-token");
		}),
	);
});
