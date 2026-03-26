// Centralized query key factory — prevents key typos and enables targeted invalidation
export const QK = {
	// Instance
	health: () => ["health"] as const,
	instance: () => ["instance"] as const,
	smtp: () => ["smtp"] as const,
	notifications: () => ["notifications"] as const,
	// Metrics
	metrics: () => ["metrics"] as const,
	metricsOverview: () => ["metrics", "overview"] as const,
	metricsTimeseries: (metric: string, period: string) =>
		["metrics", "timeseries", metric, period] as const,
	metricsLatency: (period: string) => ["metrics", "latency", period] as const,
	metricsTopEndpoints: (period: string) => ["metrics", "top-endpoints", period] as const,
	// Auth
	adminMe: () => ["admin", "me"] as const,
	// Admin users
	adminUsers: () => ["admin-users"] as const,
	// RBAC
	roles: () => ["roles"] as const,
	roleAssignments: () => ["role-assignments"] as const,
	// API keys
	apiKeys: () => ["api-keys"] as const,
	cliSessions: () => ["cli-sessions"] as const,
	// Projects
	projects: () => ["projects"] as const,
	project: (id: string) => ["projects", id] as const,
	// Per-project
	projectUsers: (id: string, params: Record<string, string>) =>
		["projects", id, "users", params] as const,
	projectUser: (id: string, userId: string) => ["projects", id, "users", userId] as const,
	projectUserStats: (id: string) => ["projects", id, "users", "stats"] as const,
	projectAuthConfig: (id: string) => ["projects", id, "auth-config"] as const,
	projectDatabase: (id: string) => ["projects", id, "database"] as const,
	projectTables: (id: string) => ["projects", id, "database", "tables"] as const,
	projectColumns: (id: string, table: string) =>
		["projects", id, "database", "tables", table] as const,
	projectRealtime: (id: string) => ["projects", id, "realtime"] as const,
	projectEnv: (id: string) => ["projects", id, "env"] as const,
	projectWebhooks: (id: string) => ["projects", id, "webhooks"] as const,
	projectDeliveries: (id: string, webhookId: string) =>
		["projects", id, "webhooks", webhookId, "deliveries"] as const,
	projectFunctions: (id: string) => ["projects", id, "functions"] as const,
	projectInvocations: (id: string, fnId: string) =>
		["projects", id, "functions", fnId, "invocations"] as const,
	projectFnStats: (id: string, fnId: string, period: string) =>
		["projects", id, "functions", fnId, "stats", period] as const,
	// Logs
	logs: (params: Record<string, string>) => ["logs", params] as const,
	audit: (params: Record<string, string>) => ["audit", params] as const,
	auditActions: () => ["audit", "actions"] as const,
	// Storage
	storageBuckets: () => ["storage", "buckets"] as const,
	storageObjects: (bucket: string) => ["storage", "buckets", bucket, "objects"] as const,
	// Webhooks (global)
	webhooks: () => ["webhooks"] as const,
	// Functions (global)
	functions: () => ["functions"] as const,
};
