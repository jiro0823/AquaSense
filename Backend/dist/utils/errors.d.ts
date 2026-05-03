/**
 * Custom error class for API errors
 */
export declare class ApiError extends Error {
    statusCode: number;
    message: string;
    error?: (string | Record<string, unknown>) | undefined;
    constructor(statusCode: number, message: string, error?: (string | Record<string, unknown>) | undefined);
}
/**
 * Validation error for request validation failures
 */
export declare class ValidationError extends ApiError {
    constructor(message: string, error?: Record<string, unknown>);
}
/**
 * Not found error for missing resources
 */
export declare class NotFoundError extends ApiError {
    constructor(message?: string);
}
/**
 * Unauthorized error
 */
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string);
}
/**
 * Forbidden error
 */
export declare class ForbiddenError extends ApiError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map