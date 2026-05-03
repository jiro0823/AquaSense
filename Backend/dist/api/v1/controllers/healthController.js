"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
/**
 * Health check controller for API v1
 */
const healthCheck = (_req, res) => {
    const response = {
        success: true,
        statusCode: 200,
        message: 'API v1 is healthy',
        data: {
            version: 'v1',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        },
    };
    res.status(200).json(response);
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=healthController.js.map