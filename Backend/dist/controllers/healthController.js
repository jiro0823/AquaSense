"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
/**
 * Health check controller
 */
const healthCheck = (_req, res) => {
    const response = {
        success: true,
        statusCode: 200,
        message: 'Server is running',
        data: {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        },
    };
    res.status(200).json(response);
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=healthController.js.map