/**
 * Response utility for consistent API responses
 */
import { Response } from 'express';
export declare const sendSuccess: <T = unknown>(res: Response, statusCode: number, message: string, data?: T) => Response;
export declare const sendError: (res: Response, statusCode: number, message: string, error?: string | Record<string, unknown>) => Response;
//# sourceMappingURL=response.d.ts.map