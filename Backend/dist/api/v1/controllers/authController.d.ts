/**
 * Authentication Controllers
 * Handles signup and login logic
 */
import { Request, Response } from 'express';
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
export declare const signup: (req: Request<{}, {}, SignupRequest>, res: Response) => Promise<void>;
/**
 * Login user
 * POST /api/v1/auth/login
 */
export declare const login: (req: Request<{}, {}, LoginRequest>, res: Response) => Promise<void>;
/**
 * Verify token
 * GET /api/v1/auth/verify
 */
export declare const verifyToken: (req: Request, res: Response) => void;
export {};
//# sourceMappingURL=authController.d.ts.map