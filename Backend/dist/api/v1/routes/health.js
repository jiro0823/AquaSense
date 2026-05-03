"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthController_1 = require("../controllers/healthController");
const router = (0, express_1.Router)();
/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', healthController_1.healthCheck);
exports.default = router;
//# sourceMappingURL=health.js.map