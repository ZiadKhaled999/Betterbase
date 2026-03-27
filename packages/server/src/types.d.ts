import "hono";

declare module "hono" {
	interface ContextVariableMap {
		adminUser: {
			id: string;
			email: string;
		};
		project: {
			id: string;
			name: string;
			slug: string;
		};
	}
}
