"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.login = exports.signup = void 0;
const userService_1 = require("../../../services/userService");
const tokenService_1 = require("../../../utils/tokenService");
const response_1 = require("../../../utils/response");
const logger_1 = require("../../../utils/logger");
/**
 * Sign up a new user
 * POST /api/v1/auth/signup
 */
const signup = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        // Validation
        if (!fullName || !email || !password) {
            (0, response_1.sendError)(res, 400, 'Missing required fields: fullName, email, password');
            return;
        }
        if (password.length < 8) {
            (0, response_1.sendError)(res, 400, 'Password must be at least 8 characters long');
            return;
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            (0, response_1.sendError)(res, 400, 'Invalid email format');
            return;
        }
        // Register user
        const user = await userService_1.userService.registerUser(fullName, email, password);
        if (!user) {
            (0, response_1.sendError)(res, 400, 'User registration failed');
            return;
        }
        // Generate token
        const token = tokenService_1.tokenService.generateToken({
            userId: user.id,
            email: user.email,
        });
        const publicUser = userService_1.userService.getPublicUser(user);
        (0, response_1.sendSuccess)(res, 201, 'User registered successfully', {
            user: publicUser,
            token,
        });
        logger_1.logger.info('User signup successful', { email: user.email });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'User registration failed';
        logger_1.logger.error('Signup error', error);
        (0, response_1.sendError)(res, 400, errorMessage);
    }
};
exports.signup = signup;
/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            (0, response_1.sendError)(res, 400, 'Missing required fields: email, password');
            return;
        }
        // Authenticate user
        const user = await userService_1.userService.authenticateUser(email, password);
        if (!user) {
            logger_1.logger.warn('Login failed - invalid credentials', { email });
            (0, response_1.sendError)(res, 401, 'Invalid email or password');
            return;
        }
        // Generate token
        const token = tokenService_1.tokenService.generateToken({
            userId: user.id,
            email: user.email,
        });
        const publicUser = userService_1.userService.getPublicUser(user);
        (0, response_1.sendSuccess)(res, 200, 'Login successful', {
            user: publicUser,
            token,
        });
        logger_1.logger.info('User login successful', { email: user.email });
    }
    catch (error) {
        logger_1.logger.error('Login error', error);
        (0, response_1.sendError)(res, 500, 'Login failed');
    }
};
exports.login = login;
/**
 * Verify token
 * GET /api/v1/auth/verify
 */
const verifyToken = (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            (0, response_1.sendError)(res, 401, 'No token provided');
            return;
        }
        const payload = tokenService_1.tokenService.verifyToken(token);
        if (!payload) {
            (0, response_1.sendError)(res, 401, 'Invalid or expired token');
            return;
        }
        (0, response_1.sendSuccess)(res, 200, 'Token is valid', {
            userId: payload.userId,
            email: payload.email,
        });
    }
    catch (error) {
        logger_1.logger.error('Token verification error', error);
        (0, response_1.sendError)(res, 500, 'Token verification failed');
    }
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=authController.js.map