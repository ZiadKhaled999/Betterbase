import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Pool } from "pg";

const getSecret = () => new TextEncoder().encode(process.env.BETTERBASE_JWT_SECRET!);

const TOKEN_EXPIRY = "30d";
const BCRYPT_ROUNDS = 12;

// --- Password ---

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

// --- JWT for admin sessions ---

export async function signAdminToken(adminUserId: string): Promise<string> {
	return new SignJWT({ sub: adminUserId, type: "admin" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(TOKEN_EXPIRY)
		.sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<{ sub: string } | null> {
	try {
		const { payload } = await jwtVerify(token, getSecret());
		if (payload.type !== "admin") return null;
		return { sub: payload.sub as string };
	} catch {
		return null;
	}
}

// --- Middleware helper: extract + verify token from Authorization header ---

export function extractBearerToken(authHeader: string | undefined): string | null {
	if (!authHeader?.startsWith("Bearer ")) return null;
	return authHeader.slice(7);
}

// --- Seed initial admin on first start ---

export async function seedAdminUser(pool: Pool, email: string, password: string): Promise<void> {
	const { rows } = await pool.query("SELECT id FROM betterbase_meta.admin_users WHERE email = $1", [
		email,
	]);
	if (rows.length > 0) return; // Already exists

	const hash = await hashPassword(password);
	await pool.query(
		"INSERT INTO betterbase_meta.admin_users (email, password_hash) VALUES ($1, $2)",
		[email, hash],
	);
	console.log(`[auth] Seeded admin user: ${email}`);
}
