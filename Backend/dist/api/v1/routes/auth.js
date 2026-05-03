"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const router = (0, express_1.Router)();
/**
 * Authentication endpoints
 */
// Signup route
router.post('/signup', authController_1.signup);
// Login route
router.post('/login', authController_1.login);
// Verify token route
router.get('/verify', authController_1.verifyToken);
exports.default = router;
//# sourceMappingURL=auth.js.map