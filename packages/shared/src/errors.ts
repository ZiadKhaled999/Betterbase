export class BetterBaseError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode = 500,
	) {
		super(message);
		this.name = "BetterBaseError";
	}
}

export class ValidationError extends BetterBaseError {
	constructor(message: string) {
		super(message, "VALIDATION_ERROR", 400);
		this.name = "ValidationError";
	}
}

export class NotFoundError extends BetterBaseError {
	constructor(resource: string) {
		super(`${resource} not found`, "NOT_FOUND", 404);
		this.name = "NotFoundError";
	}
}

export class UnauthorizedError extends BetterBaseError {
	constructor(message = "Unauthorized") {
		super(message, "UNAUTHORIZED", 401);
		this.name = "UnauthorizedError";
	}
}
