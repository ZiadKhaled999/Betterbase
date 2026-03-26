import { nanoid } from "nanoid";
import { getPool } from "./db";

export interface FunctionInvocationRecord {
	functionId: string;
	functionName: string;
	status: "success" | "error" | "timeout" | "pending";
	durationMs?: number;
	coldStart?: boolean;
	requestMethod?: string;
	requestPath?: string;
	responseStatus?: number;
	errorMsg?: string;
}

export async function logFunctionInvocation(r: FunctionInvocationRecord): Promise<void> {
	await getPool().query(
		`INSERT INTO betterbase_meta.function_invocation_logs
		(id, function_id, function_name, status, duration_ms, cold_start,
		request_method, request_path, response_status, error_msg)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		[
			nanoid(),
			r.functionId,
			r.functionName,
			r.status,
			r.durationMs ?? null,
			r.coldStart ?? false,
			r.requestMethod ?? null,
			r.requestPath ?? null,
			r.responseStatus ?? null,
			r.errorMsg ?? null,
		],
	);
}
