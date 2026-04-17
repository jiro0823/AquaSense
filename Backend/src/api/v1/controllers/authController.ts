/**
 * Authentication Controllers
 * Handles signup and login logic
 */
import { Request, Response } from 'express';
import { userService } from '../../../services/userService';
import { tokenService } from '../../../utils/tokenService';
import { sendSuccess, sendError } from '../../../utils/response';
import { logger } from '../../../utils/logger';

interface SignupRequest {
  fullName?: string;
  email?: string;
  password?: string;
}

interface LoginRequest {
  email?: string;
  password?: string;
}

/**
 * Sign up a new user
 * POST /api/v1/auth/signup
 */
export const signup = async (req: Request<{}, {}, SignupRequest>, res: Response): Promise<void> => {
  try {
    const { fullName, email, password } = req.body;

    // Validation
    if (!fullName || !email || !password) {
      sendError(res, 400, 'Missing required fields: fullName, email, password');
      return;
    }

    if (password.length < 8) {
      sendError(res, 400, 'Password must be at least 8 characters long');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendError(res, 400, 'Invalid email format');
      return;
    }

    // Register user
    const user = await userService.registerUser(fullName, email, password);

    if (!user) {
      sendError(res, 400, 'User registration failed');
      return;
    }

    // Generate token
    const token = tokenService.generateToken({
      userId: user.id,
      email: user.email,
    });

    const publicUser = userService.getPublicUser(user);

    sendSuccess(res, 201, 'User registered successfully', {
      user: publicUser,
      token,
    });

    logger.info('User signup successful', { email: user.email });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'User registration failed';
    logger.error('Signup error', error);
    sendError(res, 400, errorMessage);
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      sendError(res, 400, 'Missing required fields: email, password');
      return;
    }

    // Authenticate user
    const user = await userService.authenticateUser(email, password);

    if (!user) {
      logger.warn('Login failed - invalid credentials', { email });
      sendError(res, 401, 'Invalid email or password');
      return;
    }

    // Generate token
    const token = tokenService.generateToken({
      userId: user.id,
      email: user.email,
    });

    const publicUser = userService.getPublicUser(user);

    sendSuccess(res, 200, 'Login successful', {
      user: publicUser,
      token,
    });

    logger.info('User login successful', { email: user.email });
  } catch (error) {
    logger.error('Login error', error);
    sendError(res, 500, 'Login failed');
  }
};

/**
 * Verify token
 * GET /api/v1/auth/verify
 */
export const verifyToken = (req: Request, res: Response): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      sendError(res, 401, 'No token provided');
      return;
    }

    const payload = tokenService.verifyToken(token);

    if (!payload) {
      sendError(res, 401, 'Invalid or expired token');
      return;
    }

    sendSuccess(res, 200, 'Token is valid', {
      userId: payload.userId,
      email: payload.email,
    });
  } catch (error) {
    logger.error('Token verification error', error);
    sendError(res, 500, 'Token verification failed');
  }
};
