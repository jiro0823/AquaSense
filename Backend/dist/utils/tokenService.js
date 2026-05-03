"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = void 0;
/**
 * JWT Token Service - Handles JWT token generation and verification
 */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const config_1 = require("../config/config");
class TokenService {
    /**
     * Generate JWT token
     */
    generateToken(payload) {
        try {
            const token = jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
                expiresIn: config_1.config.jwt.expiry,
                algorithm: 'HS256',
            });
            logger_1.logger.info('JWT token generated', { userId: payload.userId });
            return token;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate token', error);
            throw error;
        }
    }
    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            return payload;
        }
        catch (error) {
            logger_1.logger.debug('Token verification failed', error instanceof Error ? error.message : error);
            return null;
        }
    }
    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token) {
        try {
            const payload = jsonwebtoken_1.default.decode(token);
            return payload;
        }
        catch (error) {
            return null;
        }
    }
}
exports.tokenService = new TokenService();
//# sourceMappingURL=tokenService.js.map