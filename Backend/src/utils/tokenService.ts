/**
 * JWT Token Service - Handles JWT token generation and verification
 */
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface TokenPayload {
  userId: string;
  email: string;
  role?: 'admin' | 'farmer' | 'guest';
}

class TokenService {
  /**
   * Generate JWT token
   */
  generateToken(payload: TokenPayload): string {
    try {
      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiry as any,
        algorithm: 'HS256',
      });
      logger.info('JWT token generated', { userId: payload.userId });
      return token;
    } catch (error) {
      logger.error('Failed to generate token', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
      return payload;
    } catch (error) {
      logger.debug('Token verification failed', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.decode(token) as TokenPayload | null;
      return payload;
    } catch (error) {
      return null;
    }
  }
}

export const tokenService = new TokenService();
