"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routes_1 = __importDefault(require("./v1/routes"));
const router = (0, express_1.Router)();
/**
 * Main API router
 * Routes all API versions
 */
// API v1
router.use('/v1', routes_1.default);
// Future API versions can be added here:
// router.use('/v2', v2Routes);
// router.use('/v3', v3Routes);
exports.default = router;
//# sourceMappingURL=index.js.map