export class BetterBaseError extends Error {
	constructor(
		message: string,
		public code?: string,
		public details?: unknown,
		public status?: number,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NetworkError extends BetterBaseError {
	constructor(message: string, details?: unknown) {
		super(message, "NETWORK_ERROR", details);
	}
}

export class AuthError extends BetterBaseError {
	constructor(message: string, details?: unknown) {
		super(message, "AUTH_ERROR", details, 401);
	}
}

export class ValidationError extends BetterBaseError {
	constructor(message: string, details?: unknown) {
		super(message, "VALIDATION_ERROR", details, 400);
	}
}
