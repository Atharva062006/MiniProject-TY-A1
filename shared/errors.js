const { ERROR_CODES } = require('./constants');

/** Base application error */
class AppError extends Error {
  constructor(code, message, statusCode = 500, details = []) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(ERROR_CODES.NOT_FOUND, `${resource} '${id}' not found`, 404);
  }
}

class ConflictError extends AppError {
  constructor(message, details = []) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
  }
}

class DuplicateKeyError extends AppError {
  constructor(key) {
    super(ERROR_CODES.DUPLICATE_KEY, `Duplicate idempotency key: ${key}`, 409);
  }
}

class InvalidTransitionError extends AppError {
  constructor(from, to) {
    super(ERROR_CODES.INVALID_TRANSITION, `Invalid state transition: ${from} → ${to}`, 422);
  }
}

class LockTimeoutError extends AppError {
  constructor(resourceId) {
    super(ERROR_CODES.LOCK_TIMEOUT, `Lock timeout acquiring resource: ${resourceId}`, 503);
  }
}

class TransactionError extends AppError {
  constructor(message) {
    super(ERROR_CODES.TRANSACTION_FAILED, message, 500);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(ERROR_CODES.FORBIDDEN, message, 403);
  }
}

/**
 * Express error-handling middleware — catches all AppErrors and formats
 * them using the standard error envelope.
 */
function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
      meta: { correlation_id: correlationId, timestamp: new Date().toISOString() },
    });
  }
  console.error('[Unhandled]', err);
  return res.status(500).json({
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'An unexpected error occurred', details: [] },
    meta: { correlation_id: correlationId, timestamp: new Date().toISOString() },
  });
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DuplicateKeyError,
  InvalidTransitionError,
  LockTimeoutError,
  TransactionError,
  UnauthorizedError,
  ForbiddenError,
  errorHandler,
};
