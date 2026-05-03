/**
 * Water Quality Controllers
 * API endpoints for water quality monitoring
 */
import { Request, Response } from 'express';
/**
 * Add new water quality reading
 * POST /api/v1/water/readings
 */
export declare const addReading: (_req: Request, res: Response) => Promise<void>;
/**
 * Ingest status and expected ESP32 URL
 * GET /api/v1/water/ingest-status
 */
export declare const getIngestStatus: (_req: Request, res: Response) => void;
/**
 * Get latest reading
 * GET /api/v1/water/readings/latest
 */
export declare const getLatestReading: (_req: Request, res: Response) => Promise<void>;
/**
 * Get readings within time range
 * GET /api/v1/water/readings?minutes=60
 */
export declare const getReadingsByTimeRange: (req: Request, res: Response) => Promise<void>;
/**
 * Get statistics
 * GET /api/v1/water/statistics?minutes=60
 */
export declare const getStatistics: (req: Request, res: Response) => Promise<void>;
/**
 * Get alerts
 * GET /api/v1/water/alerts?limit=50
 */
export declare const getAlerts: (req: Request, res: Response) => void;
/**
 * Get thresholds
 * GET /api/v1/water/thresholds
 */
export declare const getThresholds: (_req: Request, res: Response) => void;
/**
 * Update thresholds
 * PUT /api/v1/water/thresholds
 */
export declare const updateThresholds: (req: Request, res: Response) => void;
/**
 * Get dashboard data (combined view)
 * GET /api/v1/water/dashboard
 */
export declare const getDashboardData: (_req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=waterController.d.ts.map