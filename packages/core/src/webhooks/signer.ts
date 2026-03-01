import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sign a webhook payload using HMAC-SHA256
 * @param payload - The webhook payload to sign
 * @param secret - The secret key used for signing
 * @returns The hex-encoded HMAC-SHA256 signature
 */
export function signPayload(payload: unknown, secret: string): string {
	const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
	const hmac = createHmac("sha256", secret);
	hmac.update(payloadString);
	return hmac.digest("hex");
}

export function verifySignature(payload: unknown, signature: string, secret: string): boolean {
	// Stringify payload if it's an object
	const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);

	// Compute expected signature
	const hmac = createHmac("sha256", secret);
	hmac.update(payloadString);
	const expectedSignature = hmac.digest("hex");

	// Use built-in timing-safe comparison to prevent timing attacks
	const sigBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expectedSignature);

	// timingSafeEqual requires both buffers to be the same length
	if (sigBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(sigBuffer, expectedBuffer);
}
