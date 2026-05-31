/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, logout, verifyToken } from '../controllers/authController';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Authentication endpoints
 */

// Signup route
router.post('/signup', authLimiter, signup);

// Login route
router.post('/login', authLimiter, login);

// Logout route
router.post('/logout', logout);

// Verify token route
router.get('/verify', verifyToken);

export default router;
