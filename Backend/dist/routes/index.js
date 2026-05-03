"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthController_1 = require("../controllers/healthController");
const router = (0, express_1.Router)();
/**
 * @deprecated
 * Legacy routes file. New API endpoints should be created in:
 * src/api/v1/routes/
 *
 * This file is kept for backwards compatibility.
 * All new routes should follow the versioned API structure:
 * src/api/v1/routes/[feature].ts
 * src/api/v1/controllers/[feature]Controller.ts
 */
/**
 * Health check endpoint (legacy)
 */
router.get('/health', healthController_1.healthCheck);
exports.default = router;
//# sourceMappingURL=index.js.map