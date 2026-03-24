import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
	if (!_pool) {
		if (!process.env.DATABASE_URL) {
			throw new Error("DATABASE_URL environment variable is required");
		}
		_pool = new Pool({
			connectionString: process.env.DATABASE_URL,
			max: 10,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 5_000,
		});
	}
	return _pool;
}
