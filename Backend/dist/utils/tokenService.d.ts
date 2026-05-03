export interface TokenPayload {
    userId: string;
    email: string;
}
declare class TokenService {
    /**
     * Generate JWT token
     */
    generateToken(payload: TokenPayload): string;
    /**
     * Verify JWT token
     */
    verifyToken(token: string): TokenPayload | null;
    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token: string): TokenPayload | null;
}
export declare const tokenService: TokenService;
export {};
//# sourceMappingURL=tokenService.d.ts.map