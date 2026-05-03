"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
/**
 * User Service - Handles user management and authentication
 * Using PostgreSQL database with Sequelize ORM
 */
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("../utils/logger");
const User_1 = require("../database/models/User");
class UserService {
    /**
     * Register a new user
     */
    async registerUser(fullName, email, password) {
        try {
            // Validate email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }
            // Validate password length
            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }
            // Check if user already exists
            const existingUser = await User_1.User.findOne({
                where: { email: email.toLowerCase() },
            });
            if (existingUser) {
                throw new Error('User with this email already exists');
            }
            // Hash password
            const saltRounds = 10;
            const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
            // Create user in database
            const user = await User_1.User.create({
                fullName,
                email: email.toLowerCase(),
                passwordHash,
            });
            logger_1.logger.info('New user registered', { id: user.id, email: user.email });
            return this.mapUserModel(user);
        }
        catch (error) {
            logger_1.logger.error('Error registering user', error);
            throw error;
        }
    }
    /**
     * Authenticate user (login)
     */
    async authenticateUser(email, password) {
        try {
            const user = await User_1.User.findOne({
                where: { email: email.toLowerCase() },
            });
            if (!user) {
                logger_1.logger.warn('Login attempt with non-existent email', { email });
                return null;
            }
            // Compare password
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                logger_1.logger.warn('Login attempt with invalid password', { email });
                return null;
            }
            logger_1.logger.info('User authenticated', { id: user.id, email: user.email });
            return this.mapUserModel(user);
        }
        catch (error) {
            logger_1.logger.error('Error authenticating user', error);
            return null;
        }
    }
    /**
     * Get user by ID
     */
    async getUserById(id) {
        try {
            const user = await User_1.User.findByPk(id);
            return user ? this.mapUserModel(user) : null;
        }
        catch (error) {
            logger_1.logger.error('Error fetching user by ID', error);
            return null;
        }
    }
    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        try {
            const user = await User_1.User.findOne({
                where: { email: email.toLowerCase() },
            });
            return user ? this.mapUserModel(user) : null;
        }
        catch (error) {
            logger_1.logger.error('Error fetching user by email', error);
            return null;
        }
    }
    /**
     * Get user without password hash
     */
    getPublicUser(user) {
        const { passwordHash, ...publicUser } = user;
        return publicUser;
    }
    /**
     * Map Sequelize User model to User interface
     */
    mapUserModel(user) {
        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
exports.userService = new UserService();
//# sourceMappingURL=userService.js.map