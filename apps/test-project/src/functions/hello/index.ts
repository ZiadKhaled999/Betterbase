import type { FunctionContext } from "@betterbase/core/functions";

/**
 * Sample function that returns a greeting
 * Access at http://localhost:3000/functions/hello
 */
export default async function(ctx: FunctionContext): Promise<Response> {
	return new Response(JSON.stringify({
		message: "Hello from function!",
		env: Object.keys(ctx.env),
	}), {
		headers: { 'Content-Type': 'application/json' }
	});
}
