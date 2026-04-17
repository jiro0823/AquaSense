/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */
import { Router } from 'express';
import { signup, login, verifyToken } from '../controllers/authController';

const router = Router();

/**
 * Authentication endpoints
 */

// Signup route
router.post('/signup', signup);

// Login route
router.post('/login', login);

// Verify token route
router.get('/verify', verifyToken);

export default router;
