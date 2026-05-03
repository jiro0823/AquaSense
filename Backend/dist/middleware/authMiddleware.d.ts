/**
 * Authentication Middleware - Verifies JWT tokens on protected routes
 */
import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
}
/**
 * Middleware to verify JWT token
 */
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware to check if user is authenticated (optional)
 */
export declare const optionalAuth: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
export default authenticateToken;
//# sourceMappingURL=authMiddleware.d.ts.map