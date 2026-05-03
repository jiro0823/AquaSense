"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
/**
 * Global error handling middleware
 */
const errorHandler = (err, _req, res, _next) => {
    logger_1.logger.error('Request Error', {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
    });
    const isDevelopment = process.env.NODE_ENV === 'development';
    // Determine appropriate status code
    let statusCode = 500;
    let message = 'Internal server error';
    // Handle specific error types
    if (err.message.includes('validation')) {
        statusCode = 400;
        message = 'Validation error';
    }
    else if (err.message.includes('unauthorized')) {
        statusCode = 401;
        message = 'Unauthorized';
    }
    else if (err.message.includes('not found')) {
        statusCode = 404;
        message = 'Resource not found';
    }
    else if (err.message.includes('duplicate')) {
        statusCode = 409;
        message = 'Resource already exists';
    }
    const response = {
        success: false,
        statusCode,
        message,
        error: isDevelopment ? err.message : 'An error occurred processing your request',
    };
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found middleware
 */
const notFoundHandler = (req, res) => {
    const response = {
        success: false,
        statusCode: 404,
        message: 'Resource not found',
        error: `Cannot ${req.method} ${req.originalUrl}`,
    };
    res.status(404).json(response);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map