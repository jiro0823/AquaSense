"use strict";
/**
 * Example service layer for business logic
 * Services handle core business logic and communicate with data sources
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleService = exports.ExampleService = void 0;
const logger_1 = require("../utils/logger");
/**
 * Example service for demonstration
 */
class ExampleService {
    /**
     * Example method - replace with your actual business logic
     */
    async getExampleData() {
        try {
            logger_1.logger.debug('Getting example data');
            const data = {
                message: 'This is example data from the service layer',
                timestamp: new Date().toISOString(),
            };
            logger_1.logger.info('Successfully retrieved example data');
            return data;
        }
        catch (error) {
            logger_1.logger.error('Error in getExampleData', error);
            throw error;
        }
    }
}
exports.ExampleService = ExampleService;
exports.exampleService = new ExampleService();
//# sourceMappingURL=exampleService.js.map