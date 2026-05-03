"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authenticateToken = void 0;
const tokenService_1 = require("../utils/tokenService");
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            logger_1.logger.debug('No token provided');
            (0, response_1.sendError)(res, 401, 'No authentication token provided');
            return;
        }
        const payload = tokenService_1.tokenService.verifyToken(token);
        if (!payload) {
            logger_1.logger.debug('Invalid or expired token');
            (0, response_1.sendError)(res, 401, 'Invalid or expired token');
            return;
        }
        req.userId = payload.userId;
        req.userEmail = payload.email;
        logger_1.logger.debug('Token verified', { userId: payload.userId });
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', error);
        (0, response_1.sendError)(res, 500, 'Authentication failed');
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Middleware to check if user is authenticated (optional)
 */
const optionalAuth = (req, _res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const payload = tokenService_1.tokenService.verifyToken(token);
            if (payload) {
                req.userId = payload.userId;
                req.userEmail = payload.email;
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
exports.default = exports.authenticateToken;
//# sourceMappingURL=authMiddleware.js.map