export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class TokenReuseError extends AppError {
  constructor() {
    super("Token reuse detected — all sessions revoked", 401, "TOKEN_REUSE");
    this.name = "TokenReuseError";
  }
}

export class SessionExpiredError extends AppError {
  constructor() {
    super("Session expired", 401, "SESSION_EXPIRED");
    this.name = "SessionExpiredError";
  }
}
