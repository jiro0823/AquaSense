/**
 * Logger utility for consistent logging throughout the application
 */
declare class Logger {
    private readonly isDevelopment;
    constructor();
    private formatMessage;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, error?: Error | unknown): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map