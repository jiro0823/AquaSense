"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.ApiError = void 0;
/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(statusCode, message, error) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.error = error;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}
exports.ApiError = ApiError;
/**
 * Validation error for request validation failures
 */
class ValidationError extends ApiError {
    constructor(message, error) {
        super(400, message, error);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
/**
 * Not found error for missing resources
 */
class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(404, message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Unauthorized error
 */
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, message);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * Forbidden error
 */
class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(403, message);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
exports.ForbiddenError = ForbiddenError;
//# sourceMappingURL=errors.js.map