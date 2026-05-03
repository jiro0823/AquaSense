"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const index_1 = require("../types/index");
/**
 * Logger utility for consistent logging throughout the application
 */
class Logger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
    }
    debug(message, data) {
        if (this.isDevelopment) {
            console.debug(this.formatMessage(index_1.LogLevel.DEBUG, message, data));
        }
    }
    info(message, data) {
        console.info(this.formatMessage(index_1.LogLevel.INFO, message, data));
    }
    warn(message, data) {
        console.warn(this.formatMessage(index_1.LogLevel.WARN, message, data));
    }
    error(message, error) {
        const errorData = error instanceof Error ? error.message : error;
        console.error(this.formatMessage(index_1.LogLevel.ERROR, message, errorData));
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map