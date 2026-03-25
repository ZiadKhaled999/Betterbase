import { Context } from "hono";

declare module "hono" {
	interface ContextVariables {
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
