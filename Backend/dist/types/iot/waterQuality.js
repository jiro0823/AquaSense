"use strict";
/**
 * Water Quality Monitoring - Type Definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THRESHOLDS = exports.WaterQualityStatus = void 0;
/**
 * Status determination based on parameters
 */
var WaterQualityStatus;
(function (WaterQualityStatus) {
    WaterQualityStatus["GOOD"] = "good";
    WaterQualityStatus["WARNING"] = "warning";
    WaterQualityStatus["CRITICAL"] = "critical";
    WaterQualityStatus["OFFLINE"] = "offline";
})(WaterQualityStatus || (exports.WaterQualityStatus = WaterQualityStatus = {}));
/**
 * Default thresholds for water quality (can be customized per device)
 */
exports.DEFAULT_THRESHOLDS = {
    temperature: {
        min: 5,
        max: 35,
        critical: { min: 0, max: 50 },
    },
    pH: {
        min: 6.5,
        max: 8.5,
        critical: { min: 0, max: 14 },
    },
    dissolvedOxygen: {
        min: 5,
        max: 14,
        critical: 3,
    },
    turbidity: {
        max: 5,
        critical: 10,
    },
};
//# sourceMappingURL=waterQuality.js.map