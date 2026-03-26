export interface AuditLog {
	id: string;
	action: string;
	target_type: string;
	target_id: string;
	admin_id: string;
	details: Record<string, unknown>;
	created_at: string;
}

export interface Project {
	id: string;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface ProjectUser {
	id: string;
	project_id: string;
	user_id: string;
	role: string;
	created_at: string;
}

export interface ApiKey {
	id: string;
	name: string;
	key_prefix: string;
	last_used_at: string | null;
	expires_at: string | null;
	created_at: string;
}

export interface Role {
	id: string;
	name: string;
	description: string;
	permissions: string[];
}

export interface RoleAssignment {
	id: string;
	admin_id: string;
	role_id: string;
	created_at: string;
}

export interface StorageBucket {
	name: string;
	created_at: string;
	public: boolean;
}

export interface StorageObject {
	name: string;
	size: number;
	content_type: string;
	created_at: string;
}

export interface Webhook {
	id: string;
	project_id: string;
	url: string;
	event: string;
	active: boolean;
	created_at: string;
}

export interface WebhookDelivery {
	id: string;
	webhook_id: string;
	status: number;
	response: string;
	created_at: string;
}

export interface FunctionDef {
	id: string;
	project_id: string;
	name: string;
	code: string;
	created_at: string;
	updated_at: string;
}

export interface FunctionInvocation {
	id: string;
	function_id: string;
	status: string;
	duration_ms: number;
	created_at: string;
}

export interface LogEntry {
	id: string;
	level: string;
	message: string;
	context: Record<string, unknown>;
	timestamp: string;
}

export interface MetricsOverview {
	total_requests: number;
	active_projects: number;
	total_api_keys: number;
	avg_latency_ms: number;
}

export interface TimeseriesPoint {
	timestamp: string;
	value: number;
}

export interface TopEndpoint {
	path: string;
	method: string;
	count: number;
	avg_latency_ms: number;
}

export interface LatencyMetric {
	p50: number;
	p90: number;
	p99: number;
}
