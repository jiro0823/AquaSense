"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_1 = __importDefault(require("./health"));
const auth_1 = __importDefault(require("./auth"));
const routes_1 = __importDefault(require("../../../iot/water/routes"));
const router = (0, express_1.Router)();
/**
 * API v1 routes
 * All routes are prefixed with /api/v1
 */
// Health check routes
router.use(health_1.default);
// Authentication routes
router.use('/auth', auth_1.default);
// Water Quality IoT routes
router.use('/water', routes_1.default);
// Add more route modules here as needed:
// router.use(userRoutes);
// router.use(productRoutes);
exports.default = router;
//# sourceMappingURL=index.js.map